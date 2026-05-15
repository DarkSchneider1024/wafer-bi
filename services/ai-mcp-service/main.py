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

# Rate limiting middleware removed to prevent unintended blocks in demo environment
@app.middleware("http")
async def skip_rate_limit_middleware(request: Request, call_next):
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

SYSTEM_INSTRUCTION = """
你是一個專業的晶圓製造商業智慧 (BI) 助手，專門協助用戶查詢晶圓 (Wafer) 數據和分析異常。
你的目標是透過引導式對話，幫助用戶利用你擁有的 MCP (Model Context Protocol) 工具來解決問題。

你擁有的工具：
1. get_wafer_status(wafer_id, lot_id): 查詢特定晶圓的目前狀態和統計數據。
2. search_wafer_issues(query): 使用自然語言搜尋晶圓的潛在問題或異常（例如：搜尋厚度變異高的晶圓）。

引導原則：
- 如果用戶的問題太模糊（例如：「幫我看看」），請主動詢問他們是想查詢特定晶圓狀態還是搜尋異常，並提供範例。
- 如果用戶要求的內容目前無法直接提供（例如：「計算 Lot 良率」），請說明局限性，並建議一個相關的替代操作（例如：「雖然我目前無法直接計算良率，但我可以幫你搜尋該批次中是否有異常晶圓。你想試試看嗎？」）。
- 如果用戶提供了不完整的資訊（例如只給了 Wafer ID 但沒給 Lot ID，且你需要 Lot ID 才能更準確查詢時），請禮貌地請求補充。
- 始終使用繁體中文回答。
- 你的回答應該包含對數據的解釋，而不僅僅是原始數據。
"""

@app.post("/api/ai/chat")
async def chat(request: ChatRequest, req: Request):
    trace_id = getattr(req.state, "trace_id", "unknown")
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=401, detail="API_KEY_MISSING")

    try:
        # Use gemini-3-flash-preview as per user confirmation
        model = genai.GenerativeModel(
            'gemini-3-flash-preview',
            system_instruction=SYSTEM_INSTRUCTION
        )
        
        # 1. Prepare history for Gemini
        gemini_history = []
        for msg in request.history:
            role = "user" if msg['role'] == "user" else "model"
            gemini_history.append({"role": role, "parts": [msg['content']]})
            
        chat_session = model.start_chat(history=gemini_history)

        # 2. Get tools from MCP
        tools_list = await handle_list_tools()
        
        # Mapping MCP tools to Gemini tools
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
           any(part.function_call for part in response.candidates[0].content.parts):
            
            # Find the function call part
            fn_call = next(part.function_call for part in response.candidates[0].content.parts if part.function_call)
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
                [{
                    "function_response": {
                        "name": function_name,
                        "response": {"result": result_text}
                    }
                }]
            )
            final_text = second_response.text
        else:
            if not response.candidates or not response.candidates[0].content.parts:
                final_text = "抱歉，我無法生成回應。這可能是因為內容觸發了安全過濾器。"
            else:
                final_text = response.text

        # Extract suggestions if the model provided any in its text or generate default ones
        # For simplicity, we can also use a second pass or just simple regex if the model follows a pattern
        # But here we will just generate some based on context if not present
        suggestions = []
        if "wafer" not in final_text.lower() and "lot" not in final_text.lower():
            suggestions = ["搜尋異常晶圓", "查詢特定 Wafer 狀態", "有哪些可用工具？"]
        elif "get_wafer_status" in str(response):
            suggestions = ["再查另一個晶圓", "搜尋相似異常"]
        else:
            suggestions = ["搜尋 Lot1 異常", "查詢 Wafer_001 狀態", "幫助我分析數據"]

        return {
            "answer": final_text,
            "suggestions": suggestions
        }


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
