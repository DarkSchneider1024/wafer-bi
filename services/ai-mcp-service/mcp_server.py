import asyncio
from mcp.server.models import InitializationOptions
from mcp.server import Server, NotificationOptions
from mcp.server.stdio import stdio_server
import mcp.types as types
from chroma_manager import ChromaManager
import os
from deltalake import DeltaTable
import pandas as pd
import numpy as np

# Initialize ChromaManager
chroma = ChromaManager()

server = Server("wafer-ai-mcp")

def calculate_linear_regression(x, y):
    n = len(x)
    if n < 2:
        return 0.0, 0.0, 0.0
    x_mean = np.mean(x)
    y_mean = np.mean(y)
    num = np.sum((x - x_mean) * (y - y_mean))
    den = np.sum((x - x_mean) ** 2)
    if den == 0:
        return 0.0, y_mean, 0.0
    slope = num / den
    intercept = y_mean - slope * x_mean
    
    y_pred = slope * x + intercept
    ss_res = np.sum((y - y_pred) ** 2)
    ss_tot = np.sum((y - y_mean) ** 2)
    r_squared = 1.0 - (ss_res / ss_tot) if ss_tot != 0 else 0.0
    
    return float(slope), float(intercept), float(r_squared)

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
        types.Tool(
            name="get_regression_analysis",
            description="Perform a linear regression analysis on the wafer parameters sequence in a lot to check for process drift.",
            inputSchema={
                "type": "object",
                "properties": {
                    "lot_id": {"type": "string", "description": "The Lot ID to analyze (e.g., 'Lot1')"},
                    "parameter": {"type": "string", "description": "Optional testing parameter, default is 'Thickness'"}
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

    elif name == "get_regression_analysis":
        lot_id = arguments.get("lot_id")
        parameter = arguments.get("parameter", "Thickness")
        
        DELTA_PATH = os.getenv("DELTA_PATH", "./wafer_delta_table")
        if not os.path.exists(DELTA_PATH):
            DELTA_PATH = "../wafer-bi/wafer_delta_table"
            if not os.path.exists(DELTA_PATH):
                return [types.TextContent(type="text", text="Error: Delta table not found.")]
                
        try:
            dt = DeltaTable(DELTA_PATH)
            df = dt.to_pandas()
            
            lot_df = df[(df["lot_id"] == lot_id) & (df["parameter"] == parameter)]
            if lot_df.empty:
                return [types.TextContent(type="text", text=f"No data found for lot {lot_id} and parameter {parameter}.")]
                
            wafer_means = lot_df.groupby("wafer_id")["value"].mean().reset_index()
            wafer_means = wafer_means.sort_values("wafer_id")
            
            y = wafer_means["value"].values
            x = np.arange(len(y))
            
            slope, intercept, r_squared = calculate_linear_regression(x, y)
            
            drift_direction = "上升 (Upward)" if slope > 0 else ("下降 (Downward)" if slope < 0 else "無明顯趨勢 (No drift)")
            strength = "強烈 (Strong)" if r_squared > 0.7 else ("中等 (Moderate)" if r_squared > 0.3 else "微弱/無相關 (Weak/No correlation)")
            
            analysis = (
                f"📊 **{lot_id} ({parameter}) 線性回歸與製程漂移分析結果**：\n\n"
                f"* **擬合公式 (Formula)**: `y = {slope:.6f}x + {intercept:.4f}` (其中 x 為晶圓生產順序/編號，y 為測試均值)\n"
                f"* **判定係數 (R²)**: `{r_squared:.4f}` (代表 `{r_squared*100:.1f}%` 的變異可由生產順序解釋)\n"
                f"* **漂移方向 (Drift Direction)**: **{drift_direction}**，斜率為 `{slope:.6f}`\n"
                f"* **趨勢關聯強度 (Strength)**: **{strength}**\n\n"
            )
            
            if r_squared > 0.4:
                analysis += f"⚠️ **警報與建議**：偵測到顯著的製程時間漂移趨勢（R² = {r_squared:.2f}）。隨著生產晶圓順序增加，{parameter} 呈 {drift_direction} 趨勢。這通常代表靶材消耗、化學品濃度耗損或機台溫度緩慢變化，建議工程師檢查相關腔體或執行保養流程 (PM)。"
            else:
                analysis += f"✅ **製程評估**：未偵測到明顯的隨時間/順序漂移趨勢（R² = {r_squared:.2f}，斜率極小）。目前製程波動表現為隨機變異，屬於管制狀態內。"
                
            return [types.TextContent(type="text", text=analysis)]
        except Exception as err:
            return [types.TextContent(type="text", text=f"Error performing regression: {str(err)}")]

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
