import asyncio
from mcp.server.models import InitializationOptions
from mcp.server import Server, NotificationOptions
from mcp.server.stdio import stdio_server
import mcp.types as types
from chroma_manager import ChromaManager
import os

# Initialize ChromaManager
chroma = ChromaManager()

server = Server("wafer-ai-mcp")

@server.list_tools()
async def handle_list_tools() -> list[types.Tool]:
    """
    List available tools.
    Each tool specifies its arguments using JSON Schema.
    """
    return [
        types.Tool(
            name="get_wafer_status",
            description="Get the current status and statistics of a specific wafer",
            inputSchema={
                "type": "object",
                "properties": {
                    "wafer_id": {"type": "string", "description": "The ID of the wafer to query"},
                    "lot_id": {"type": "string", "description": "Optional Lot ID for more specific search"},
                },
                "required": ["wafer_id"],
            },
        ),
        types.Tool(
            name="search_wafer_issues",
            description="Search for potential issues or anomalies in wafers using natural language",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "The search query (e.g., 'wafers with high thickness variation')"},
                },
                "required": ["query"],
            },
        ),
        types.Tool(
            name="analyze_lot_yield",
            description="Automatically analyze yield issues in a lot and identify problematic parameters",
            inputSchema={
                "type": "object",
                "properties": {
                    "lot_id": {"type": "string", "description": "The Lot ID to analyze (e.g., 'Lot1')"},
                },
                "required": ["lot_id"],
            },
        ),
    ]

@server.call_tool()
async def handle_call_tool(
    name: str, arguments: dict | None
) -> list[types.TextContent | types.ImageContent | types.EmbeddedResource]:
    """
    Handle tool execution requests.
    Tools can modify server state or fetch external data.
    """
    if name == "get_wafer_status":
        wafer_id = arguments.get("wafer_id")
        lot_id = arguments.get("lot_id", "")
        
        query = f"status of wafer {wafer_id}"
        if lot_id:
            query += f" in lot {lot_id}"
            
        results = chroma.query_wafer(query, n_results=1)
        
        if not results['documents'] or not results['documents'][0]:
            return [types.TextContent(type="text", text=f"No information found for wafer {wafer_id}.")]
        
        return [types.TextContent(type="text", text=f"Status: {results['documents'][0][0]}")]

    elif name == "search_wafer_issues":
        query = arguments.get("query")
        results = chroma.query_wafer(query, n_results=5)
        
        if not results['documents'] or not results['documents'][0]:
            return [types.TextContent(type="text", text="No matching issues found.")]
            
        response_text = "Found the following relevant wafer data:\n"
        for doc in results['documents'][0]:
            response_text += f"- {doc}\n"
            
        return [types.TextContent(type="text", text=response_text)]

    elif name == "analyze_lot_yield":
        lot_id = arguments.get("lot_id")
        # Query for lot status focusing on yield
        results = chroma.query_wafer(f"low yield wafers in lot {lot_id}", n_results=10)
        
        if not results['metadatas'] or not results['metadatas'][0]:
            return [types.TextContent(type="text", text=f"No data found for {lot_id}.")]
            
        low_yield_info = []
        for meta, doc in zip(results['metadatas'][0], results['documents'][0]):
            if meta.get("lot_id") == lot_id and meta.get("yield", 100) < 96.5:
                low_yield_info.append({
                    "wafer": meta.get("wafer_id"),
                    "param": meta.get("parameter"),
                    "yield": meta.get("yield"),
                    "std": meta.get("std")
                })
        
        if not low_yield_info:
            return [types.TextContent(type="text", text=f"{lot_id} 的良率狀況良好，所有測試晶圓皆高於 96.5%。")]
            
        summary = f"分析報告 - {lot_id}:\n"
        for item in low_yield_info:
            summary += f"- 晶圓 {item['wafer']}: 良率 {item['yield']:.2f}% (受 {item['param']} 影響, 標準差 {item['std']:.4f})\n"
        
        summary += "\n自動化分析結論：該批次的良率損失主要與參數穩定度有關。建議檢查相關製程機台。"
        return [types.TextContent(type="text", text=summary)]

    else:
        raise ValueError(f"Unknown tool: {name}")

async def main():
    # Run the server using stdin/stdout streams
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name="wafer-ai-mcp",
                server_version="0.1.0",
                capabilities=server.get_capabilities(
                    notification_options=NotificationOptions(),
                    experimental_capabilities={},
                ),
            ),
        )

if __name__ == "__main__":
    asyncio.run(main())
