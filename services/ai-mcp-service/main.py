from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import os
import google.generativeai as genai
from dotenv import load_dotenv
from mcp_server import handle_call_tool, handle_list_tools
import json

load_dotenv()

app = FastAPI(title="Wafer AI Assistant API (Gemini)")

# Configure Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("OPENAI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

@app.on_event("startup")
async def startup_event():
    """Perform initial ingestion on startup if DB is empty"""
    from chroma_manager import ChromaManager
    try:
        manager = ChromaManager()
        # Check if collection has data
        count = manager.collection.count()
        if count == 0:
            print("ChromaDB is empty. Performing initial ingestion...")
            DELTA_PATH = os.getenv("DELTA_PATH", "../wafer-bi/wafer_delta_table")
            manager.ingest_from_delta(DELTA_PATH)
        else:
            print(f"ChromaDB already contains {count} records. Skipping initial ingestion.")
    except Exception as e:
        print(f"Failed to perform initial ingestion: {e}")

class ChatRequest(BaseModel):
    message: str
    history: list = []

@app.post("/api/ai/chat")
async def chat(request: ChatRequest):
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
        # (Gemini tools are just function declarations)
        gemini_tools = []
        for t in tools_list:
            gemini_tools.append({
                "function_declarations": [
                    {
                        "name": t.name,
                        "description": t.description,
                        "parameters": t.inputSchema
                    }
                ]
            })

        # 3. Generate content with tools
        response = chat_session.send_message(
            request.message,
            tools=gemini_tools
        )

        # 4. Handle tool calls (Function Calling)
        if response.candidates[0].content.parts[0].function_call:
            fn_call = response.candidates[0].content.parts[0].function_call
            function_name = fn_call.name
            function_args = dict(fn_call.args)
            
            # Execute tool using our MCP handler
            tool_result = await handle_call_tool(function_name, function_args)
            result_text = tool_result[0].text if tool_result else "No result"
            
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
        
        return {"answer": response.text}

    except Exception as e:
        print(f"Gemini Chat Error: {str(e)}")
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
