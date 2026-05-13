from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import os
import google.generativeai as genai
from dotenv import load_dotenv
from mcp_server import handle_call_tool, handle_list_tools
import json

load_dotenv()

app = FastAPI(title="Wafer AI Assistant API (Gemini)")

import uuid
import time
from fastapi import Request

@app.middleware("http")
async def trace_middleware(request: Request, call_next):
    trace_id = request.headers.get("x-trace-id", str(uuid.uuid4())[:8])
    # Store trace_id in request state for access in routes
    request.state.trace_id = trace_id
    
    start_time = time.time()
    response = await call_next(request)
    duration = time.time() - start_time
    
    response.headers["X-Trace-Id"] = trace_id
    print(f"[{trace_id}] {request.method} {request.url.path} - {response.status_code} ({duration:.2f}s)")
    return response

# --- Rate Limiting Logic ---
# Simple in-memory rate limiter
# In production, use Redis for distributed rate limiting
user_history = {} # IP -> list of timestamps
blocked_until = {} # IP -> block end timestamp

RATE_LIMIT_WINDOW = 60    # 1 minute window
MAX_REQUESTS = 30         # Max requests per window (increased from 10)
BLOCK_TIME = 600         # 10 minutes block duration

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    if request.url.path != "/api/ai/chat":
        return await call_next(request)

    client_ip = request.headers.get("x-forwarded-for", request.client.host).split(",")[0]
    now = time.time()

    # Check if user is blocked
    if client_ip in blocked_until:
        if now < blocked_until[client_ip]:
            retry_after = int(blocked_until[client_ip] - now)
            raise HTTPException(
                status_code=429, 
                detail=f"Rate limit exceeded. Please try again after {retry_after // 60} minutes."
            )
        else:
            del blocked_until[client_ip]

    # Update request history
    history = user_history.get(client_ip, [])
    # Filter out old requests
    history = [t for t in history if now - t < RATE_LIMIT_WINDOW]
    history.append(now)
    user_history[client_ip] = history

    # Check if threshold reached
    if len(history) > MAX_REQUESTS:
        blocked_until[client_ip] = now + BLOCK_TIME
        raise HTTPException(
            status_code=429, 
            detail="Too many requests. You are blocked for 10 minutes."
        )

    return await call_next(request)

# Configure Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("OPENAI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "ai-mcp-service"}

@app.on_event("startup")
async def startup_event():
    """Perform initial ingestion on startup if DB is empty"""
    print("AI service starting up...")
    try:
        from chroma_manager import ChromaManager
        manager = ChromaManager()
        # Check if collection has data
        count = manager.collection.count()
        print(f"Current ChromaDB count: {count}")
        if count == 0:
            print("ChromaDB is empty. Performing initial ingestion...")
            # Use local baked-in path as fallback
            DELTA_PATH = os.getenv("DELTA_PATH", "./wafer_delta_table")
            manager.ingest_from_delta(DELTA_PATH)
            print("Initial ingestion complete.")
        else:
            print(f"ChromaDB already contains {count} records. Skipping initial ingestion.")
    except Exception as e:
        print(f"CRITICAL: Failed to initialize AI service: {e}")
        # We don't raise here to allow the container to stay up for debugging if needed,
        # but the health check might fail if we can't initialize.

class ChatRequest(BaseModel):
    message: str
    history: list = []

@app.post("/api/ai/chat")
async def chat(request: ChatRequest, req: Request):
    trace_id = getattr(req.state, "trace_id", "unknown")
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=401, detail="API_KEY_MISSING")

    try:
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        # 1. Prepare history for Gemini
        gemini_history = []
        for msg in request.history:
            role = "user" if msg['role'] == "user" else "model"
            gemini_history.append({"role": role, "parts": [msg['content']]})
            
        chat_session = model.start_chat(history=gemini_history)

        # 2. Get tools from MCP
        tools_list = await handle_list_tools()
        # For simplicity in this adaptation, we'll use a manual loop or 
        # a more advanced tool integration if using vertex AI, 
        # but for standard Gemini API we'll handle tool calls manually or 
        # use the provided tools in the generation config.
        
        # Mapping MCP tools to Gemini tools
        # Gemini expects a list of Tool objects, where each Tool contains function_declarations
        gemini_tools = [
            {
                "function_declarations": [
                    {
                        "name": t.name,
                        "description": t.description,
                        "parameters": t.inputSchema
                    } for t in tools_list
                ]
            }
        ]

        # 3. Generate content with tools
        response = chat_session.send_message(
            request.message,
            tools=gemini_tools
        )

        # 4. Handle tool calls (Function Calling)
        if response.candidates and response.candidates[0].content.parts and \
           response.candidates[0].content.parts[0].function_call:
            
            fn_call = response.candidates[0].content.parts[0].function_call
            function_name = fn_call.name
            function_args = dict(fn_call.args)
            
            print(f"[{trace_id}] Executing tool: {function_name} with {function_args}")
            
            # Execute tool using our MCP handler
            try:
                tool_result = await handle_call_tool(function_name, function_args)
                result_text = tool_result[0].text if tool_result else "No result"
            except Exception as tool_err:
                print(f"[{trace_id}] Tool Execution Error: {tool_err}")
                result_text = f"Error executing tool: {str(tool_err)}"
            
            # Send tool response back to Gemini
            second_response = chat_session.send_message(
                genai.types.Content(
                    parts=[genai.types.Part.from_function_response(
                        name=function_name,
                        response={"result": result_text}
                    )]
                )
            )
            return {"answer": second_response.text}
        
        if not response.candidates or not response.candidates[0].content.parts:
            return {"answer": "抱歉，我無法生成回應。這可能是因為內容觸發了安全過濾器。"}

        return {"answer": response.text}

    except Exception as e:
        print(f"[{trace_id}] Gemini Chat Error: {str(e)}")
        if "API_KEY_INVALID" in str(e) or "401" in str(e):
            raise HTTPException(status_code=401, detail="API_KEY_INVALID")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ai/ingest")
async def ingest_data():
    """Trigger data ingestion from Delta to ChromaDB"""
    from chroma_manager import ChromaManager
    try:
        manager = ChromaManager()
        DELTA_PATH = os.getenv("DELTA_PATH", "../wafer-bi/wafer_delta_table")
        manager.ingest_from_delta(DELTA_PATH)
        return {"status": "success", "message": "Data ingested into ChromaDB using Gemini embeddings"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
