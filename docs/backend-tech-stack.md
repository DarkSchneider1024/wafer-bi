# ⚙️ Wafer BI 後端技術架構文件

本專案的後端採用的異構開發模式，旨在展示如何根據業務需求選擇最適當的開發語言與框架。

## 🐍 核心分析服務 (Wafer BI Service)

*   **語言**: Python 3.10
*   **框架**: FastAPI (基於 Starlette 與 Pydantic 的高效能非同步框架)
*   **計算庫**: 
    *   **Pandas**: 用於靈活的數據變換與過濾。
    *   **NumPy / SciPy**: 用於統計採樣 (Sampling) 與機率分佈 (CDF) 計算。
    *   **deltalake-python**: 直接與 Rust 編寫的 Delta Lake 核心交互，獲取極致的讀取速度。

### 核心架構亮點：
1.  **非同步 I/O**: 充分利用 FastAPI 的 `async` 特性，在高併發請求下仍能保持低延遲。
2.  **分頁處理**: 實作 `iloc` 切片邏輯，確保海量工業數據在回傳給前端時是有序且可控的。
3.  **異質整合**: 後端可同時處理來自 Parquet 格式的科學數據與來自 PostgreSQL 的權限數據。

---

## ☕ 身份認證服務 (User Service)

*   **語言**: Java 21 (LTS)
*   **框架**: Spring Boot 3.3
*   **安全**: Spring Security + JWT (無狀態認證)
*   **資料存取**: Spring Data JPA (Hibernate)

### 核心架構亮點：
1.  **企業級設計**: 遵循 SOLID 原則，展示 Service-Repository 設計模式。
2.  **自動化遷移**: 使用 Flyway/Liquibase 的概念進行資料庫 Schema 管理。
3.  **K8S 整合**: 配置了 Spring Boot Actuator 提供實時的 Liveness 與 Readiness 檢查指標。

---

## 🌐 路由網關 (API Gateway)

*   **技術**: Node.js + Express + http-proxy-middleware
*   **功能**: 
    *   **統一入口**: 負責將前端請求根據路徑轉發至對應微服務（`/api/auth` -> User, `/api/wafer` -> Wafer BI）。
    *   **認證攔截**: 驗證 JWT Token 的有效性。
    *   **Prometheus 監控**: 收集 HTTP 請求延遲與錯誤率指標。
