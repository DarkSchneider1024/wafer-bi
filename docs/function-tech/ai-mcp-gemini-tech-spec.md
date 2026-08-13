# AI MCP & Gemini 整合技術規格書

本文件記錄了 AI 服務的底層實作、架構設計與 K8s 整合細節。

## 1. 技術架構
- **服務名稱**: `ai-mcp-service` (Python 3.11)
- **核心協議**: Model Context Protocol (MCP)
- **向量資料庫**: ChromaDB (掛載持久化 PVC)
- **LLM 引擎**: Google Gemini 1.5 Flash

## 2. 核心組件實作
- **MCP Server (`mcp_server.py`)**: 
    - 定義了工具集：`get_wafer_status`, `search_wafer_issues`。
    - 透過 StdIO 與核心服務通訊。
- **Chroma Manager (`chroma_manager.py`)**:
    - 使用 `google-generativeai` 進行 Embedding 生成。
    - 支援從 Delta Table (`wafer_delta_table`) 進行 Batch Ingestion。
    - **自動化**: 服務啟動時會自動檢查資料庫，若為空則自動觸發一次同步。
- **API Gateway 整合**:
    - 配置 `/api/ai/*` 路由轉發。
    - 實作了 401 錯誤處理與 API Key 失效判定。

### 2.3 RAG 與 Function Calling 混合驅動模式
系統在處理晶圓數據查詢與良率診斷時，採用了 **RAG (檢索增強生成)** 與 **Function Calling (MCP 工具呼叫)** 結合的混合架構：

1. **RAG 檢索增強模式**：
   * **應用場景**：自然語言異常搜尋（例如：「搜尋 Lot1 異常」、「哪些晶圓有刮痕」）。
   * **檢索 (Retrieval)**：`ChromaManager` 透過 `models/gemini-embedding-001` 模型將查詢轉換為 Embedding 向量，並從 ChromaDB 中檢索相似度最高的前 $N$ 筆晶圓統計文檔。
   * **生成 (Generation)**：Gemini LLM 將檢索到的文檔片段作為 Context，並以專業的繁體中文生成診斷與後續操作建議。

2. **精準數據運算 (Function Calling) 模式**：
   * **應用場景**：時間與生產順序上的趨勢回歸分析（例如：「針對 Lot1 做回歸分析」）。
   * **Delta Lake 讀取**：為防止 LLM 進行數值擬合時產生計算幻覺，`get_regression_analysis` 工具會直接讀取本地 **Delta Table** (`wafer_delta_table`) 的晶圓原始量測數據。
   * **實時計算**：在 Python 後端使用 `numpy` 進行線性回歸計算，精準求得斜率 (Slope)、截距與判定係數 $R^2$。
   * **專家解讀**：將真實的計算數值與趨勢指標傳回給 Gemini，由 LLM 解讀為靶材耗損、腔體 PM 保養等半導體製程領域的專家見解。

## 3. Kubernetes 部署與 CI/CD
- **資源清單**: `Deployment`, `Service`, `PVC` (2Gi)。
- **機密管理**: 透過 `app-secrets` 管理 `GEMINI_API_KEY`。
- **CI/CD**: GitHub Actions 自動構建鏡像並更新 K8s 部署時間戳以觸發 Rollout。

## 4. 監控與告警
- **API 狀態**: 前端對 401 錯誤進行攔截並彈出 `alert()` 提示。
- **日誌**: 服務運行日誌輸出至標準輸出，供 Loki/Fluentd 收集。
