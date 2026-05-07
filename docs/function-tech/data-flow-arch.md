# 🏗️ 數據流與追蹤架構規範 (Data Flow & Tracing)

## 1. 資料庫架構 (Database & Schema)
*   **Version Control**：使用 **Liquibase** 管理 PostgreSQL Schema。
*   **Migrations**：所有表格變更必須寫入 `db.changelog-master.xml`，實現開發與生產環境同步。

## 2. 數據存儲層 (Storage Layer)
*   **Delta Lake**：Wafer BI 後端使用 **Delta Lake (Parquet)** 格式存儲大數據。
*   **優勢**：支援 ACID 事務、版本回溯 (Time Travel) 以及高效的分區查詢。
*   **路徑**：`/app/wafer_delta_table`。

## 3. 分佈式追蹤 (Distributed Tracing)
系統採用 **OpenTelemetry (OTel)** 標準實現全鏈路追蹤：

### 3.1 鏈路流程
1.  **Gateway**：生成 `X-Trace-Id` 並注入到 HTTP Header。
2.  **User Service (Java)**：使用 OTel Agent 自動擷取 Span 並發送到 Collector。
3.  **Wafer BI (Python)**：使用 `FastAPIInstrumentor` 關聯請求並發送 Span。

### 3.2 數據收集
*   **Collector**：`otel-collector` 接收 OTLP 協議數據。
*   **Visualizer**：**Jaeger** UI 展示請求的時序圖與效能瓶頸。

## 4. API 轉發邏輯
網關採用 **"First Match"** 規則：
*   `/api/auth` -> User Service
*   `/api/users` -> User Service (Auth Required)
*   `/api` (Catch-all) -> Wafer BI Service
