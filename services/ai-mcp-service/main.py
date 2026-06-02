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
    context: str = ""
    model: str = "gemini-3-flash-preview"
    history: list = []

SYSTEM_INSTRUCTION = """
你是一個專業的晶圓製造商業智慧 (BI) 駐守助手，具備豐富的半導體製程與數據分析經驗。
你的目標是透過引導式對話，協助用戶利用 MCP 工具精準掌握晶圓狀態並診斷生產異常。

你擁有的工具：
1. get_wafer_status(wafer_id, lot_id): 當用戶提供具體的晶圓編號與批次編號時，查詢該晶圓的統計數據與當前狀態。
2. search_wafer_issues(query): 當用戶描述一個現象（例如：「厚度變異大」、「有刮痕」）但沒有具體 ID 時，使用此工具進行自然語言檢索。
3. analyze_lot_yield(lot_id): 當用戶詢問「良率為何降低」、「幫我分析這個批次」或提到「自動分析」時，必須優先使用此工具。這能自動篩選異常晶圓並追蹤問題參數。

專業行為準則：
- **主動性**：如果用戶的請求涉及良率或異常，請主動調用工具。不要只說「我可以幫你分析」，而是直接開始分析並展示結果。
- **直觀解釋**：在回傳工具數據後，請將技術指標轉化為易懂的商務見解（例如：將「標準差 3.5」解釋為「製程變異度顯著高於管制標準」）。
- **引導後續**：分析完成後，請主動建議下一步操作（例如：建議檢查特定機台或查詢相關晶圓的詳情）。
- **語氣與格式**：使用專業且親切的繁體中文。適當使用粗體和列表使資訊易於閱讀。

如果用戶提供的資訊不足（例如：只有 Wafer ID 但缺 Lot ID），請參考[使用者當前畫面上下文]來獲取相關的 ID 資訊。
"""

from openai import AsyncOpenAI

@app.post("/api/ai/chat")
async def chat(request: ChatRequest, req: Request):
    trace_id = getattr(req.state, "trace_id", "unknown")
    background_errors = []
    
    user_message_with_context = request.message
    if request.context:
        user_message_with_context = f"[使用者當前畫面上下文: {request.context}]\n\n" + request.message

    if "gemini" in request.model:
        if not GEMINI_API_KEY:
            raise HTTPException(status_code=401, detail="API_KEY_MISSING")

        try:
            model = genai.GenerativeModel(
                request.model,
                system_instruction=SYSTEM_INSTRUCTION
            )
            
            gemini_history = []
            for msg in request.history:
                role = "user" if msg['role'] == "user" else "model"
                gemini_history.append({"role": role, "parts": [msg['content']]})
                
            chat_session = model.start_chat(history=gemini_history)
            tools_list = await handle_list_tools()
            
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

            response = chat_session.send_message(
                user_message_with_context,
                tools=gemini_tools
            )

            MAX_TURNS = 5
            turns = 0
            while turns < MAX_TURNS:
                turns += 1
                fn_calls = [part.function_call for part in response.candidates[0].content.parts if part.function_call]
                
                if not fn_calls:
                    break
                    
                tool_responses = []
                for fn_call in fn_calls:
                    function_name = fn_call.name
                    function_args = dict(fn_call.args)
                    print(f"[{trace_id}] Executing tool: {function_name} with {function_args}")
                    
                    try:
                        tool_result = await handle_call_tool(function_name, function_args)
                        result_text = tool_result[0].text if tool_result else "No result"
                    except Exception as tool_err:
                        error_msg = f"Tool Execution Error ({function_name}): {str(tool_err)}"
                        print(f"[{trace_id}] {error_msg}")
                        background_errors.append(error_msg)
                        result_text = f"Error executing tool: {str(tool_err)}"
                    
                    tool_responses.append({
                        "function_response": {
                            "name": function_name,
                            "response": {"result": result_text}
                        }
                    })
                
                response = chat_session.send_message(tool_responses)

            try:
                final_text = response.text
            except ValueError:
                text_parts = [part.text for part in response.candidates[0].content.parts if part.text]
                final_text = "".join(text_parts) if text_parts else "抱歉，我現在無法產生文字回應。"

        except Exception as e:
            error_msg = str(e)
            print(f"[{trace_id}] Gemini Chat Error: {error_msg}")
            if "API_KEY_INVALID" in error_msg or "401" in error_msg:
                raise HTTPException(status_code=401, detail="API_KEY_INVALID")
            raise HTTPException(status_code=500, detail=f"System Error: {error_msg}")

    else:
        # Local model via OpenAI client (Ollama)
        try:
            client = AsyncOpenAI(base_url="http://localhost:11434/v1", api_key="ollama")
            messages = [{"role": "system", "content": SYSTEM_INSTRUCTION}]
            for msg in request.history:
                # ollama doesn't support 'error' role, map to assistant
                role = "assistant" if msg['role'] == "error" else msg['role']
                messages.append({"role": role, "content": msg['content']})
            messages.append({"role": "user", "content": user_message_with_context})
            
            tools_list = await handle_list_tools()
            openai_tools = [
                {
                    "type": "function",
                    "function": {
                        "name": t.name,
                        "description": t.description,
                        "parameters": t.inputSchema
                    }
                } for t in tools_list
            ]
            
            MAX_TURNS = 5
            turns = 0
            while turns < MAX_TURNS:
                turns += 1
                response = await client.chat.completions.create(
                    model=request.model,
                    messages=messages,
                    tools=openai_tools
                )
                
                message = response.choices[0].message
                messages.append(message)
                
                if not message.tool_calls:
                    final_text = message.content or ""
                    break
                    
                for tool_call in message.tool_calls:
                    function_name = tool_call.function.name
                    try:
                        function_args = json.loads(tool_call.function.arguments)
                    except:
                        function_args = {}
                        
                    print(f"[{trace_id}] Executing tool: {function_name} with {function_args}")
                    
                    try:
                        tool_result = await handle_call_tool(function_name, function_args)
                        result_text = tool_result[0].text if tool_result else "No result"
                    except Exception as tool_err:
                        error_msg = f"Tool Execution Error ({function_name}): {str(tool_err)}"
                        print(f"[{trace_id}] {error_msg}")
                        background_errors.append(error_msg)
                        result_text = f"Error executing tool: {str(tool_err)}"
                        
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": result_text
                    })
            else:
                final_text = "抱歉，工具調用次數過多，請重新提問。"
                
        except Exception as e:
            error_msg = str(e)
            print(f"[{trace_id}] Local Model Chat Error: {error_msg}")
            raise HTTPException(status_code=500, detail=f"Local Model Error: {error_msg}")

    # Extract suggestions
    suggestions = []
    if "wafer" not in final_text.lower() and "lot" not in final_text.lower():
        suggestions = ["搜尋異常晶圓", "查詢特定 Wafer 狀態", "有哪些可用工具？"]
    elif "get_wafer_status" in str(final_text):
        suggestions = ["再查另一個晶圓", "搜尋相似異常"]
    else:
        suggestions = ["搜尋 Lot1 異常", "查詢 Wafer_001 狀態", "幫助我分析數據"]

    return {
        "answer": final_text,
        "suggestions": suggestions,
        "errors": background_errors
    }

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
