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

## 3. Kubernetes 部署與 CI/CD
- **資源清單**: `Deployment`, `Service`, `PVC` (2Gi)。
- **機密管理**: 透過 `app-secrets` 管理 `GEMINI_API_KEY`。
- **CI/CD**: GitHub Actions 自動構建鏡像並更新 K8s 部署時間戳以觸發 Rollout。

## 4. 監控與告警
- **API 狀態**: 前端對 401 錯誤進行攔截並彈出 `alert()` 提示。
- **日誌**: 服務運行日誌輸出至標準輸出，供 Loki/Fluentd 收集。
