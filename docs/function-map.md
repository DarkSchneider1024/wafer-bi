# 🗺️ Wafer BI 業務邏輯與功能圖譜 (Function Map)

這份文件旨在提供 Wafer BI 系統的核心業務邏輯總覽，幫助開發者理解各模組之間的協作關係。

---

## 1. 身份認證與權限管理 (Identity & RBAC)

### 1.1 混合加密登入邏輯 (Hybrid Auth)
為了兼顧演示的便利性與系統安全性，`user-service` 實作了自動辨識的驗證機制：
*   **MD5 相容模式**：如果資料庫中的 Hash 長度為 32 位元，系統會使用 MD5 進行校驗（適用於 Liquibase 預設寫入的 `admin` 帳號）。
*   **BCrypt 標準模式**：對於透過系統介面註冊的新用戶，一律採用現代化的 `BCrypt` 加密。
*   **邏輯位置**：`UserService.java` -> `login()`。

### 1.2 JWT 認證機制：飯店房卡比喻 (The Hotel Metaphor)
本系統採用 **JWT (JSON Web Token)** 作為認證載體，其運作邏輯可比喻為「飯店入住」：

| 階段 | 動作 | 技術細節 |
| :--- | :--- | :--- |
| **1. 櫃檯登記** | 用戶輸入帳號密碼。 | **Authentication**：後端驗證身份並核發 Token。 |
| **2. 核發房卡** | 伺服器回傳 JWT 字符串。 | **Token Issuance**：Token 內含加密的 User ID 與 Group。 |
| **3. 攜帶卡片** | 瀏覽器將 Token 存入 LocalStorage。 | **Client-side Storage**：後續請求自動帶入 Header。 |
| **4. 刷卡進入** | 網關檢查 Token 簽名與有效期。 | **Authorization**：API Gateway 驗證房卡，不需查詢 DB。 |

### 1.3 權限群組 (RBAC)
*   **admin**：具備完整權限，包含「用戶管理」與「敏感數據報表」。
*   **demo01 (Sudo)**：預設為 `admin` 群組，專為快速功能展示設計。
*   **權限傳遞**：登入成功後，`group` 資訊會被編碼進 **JWT Token** 的 Payload 中：
    ```json
    { "sub": "admin", "group": "admin", "exp": 1715050000 }
    ```
    前端依此 `group` 值動態過濾導覽選單，後端 Gateway 則進行路徑級別的防護。

---

## 2. 數據分析業務流 (Data Analysis Workflow)

### 2.1 批次概覽 (Lot Overview)
*   **入口**：前端 Dashboard。
*   **邏輯**：從 PostgreSQL 提取特定 Lot 的彙整數據，計算該批次所有 Wafer 的良率分佈與參數均值。

### 2.2 晶圓詳情與熱力圖 (Wafer Detail & Heatmap)
*   **核心功能**：展示單片晶圓的 Die-level 分佈。
*   **處理細節**：
    *   `wafer-bi` (Python) 服務負責處理矩陣運算，將原始測量數據轉換為 30x30 的熱力圖座標。
    *   前端使用 ECharts 將座標映射至圓形晶圓地圖。

### 2.3 統計變異分析 (Statistical Analysis)
*   **箱型圖 (Boxplot)**：跨 Wafer 比較參數穩定性，識別製程漂移 (Process Drift)。
*   **趨勢圖 (Trend)**：監控批次內數據的連續性變化。

---

## 3. 自動化與基礎設施 (DevOps Logic)

### 3.1 機密管理流程
1.  **GitHub Secrets**：開發者在 GitHub 設定密碼。
2.  **CI/CD Pipeline**：在編譯時將 Secrets 注入 Kubernetes 的 `Secret` 物件。
3.  **應用程式讀取**：各服務透過環境變數 `${VAR}` 讀取機密，確保代碼中不留任何明文密碼。

### 3.2 資料庫遷移 (Liquibase)
*   所有資料庫變動（含初始數據寫入）一律透過 Liquibase 指令化管理，確保開發與生產環境的資料庫結構 100% 一致。

---

## 4. 服務通訊圖譜

| 請求發起端 | 接收端 | 通訊協議 | 目的 |
| :--- | :--- | :--- | :--- |
| 使用者瀏覽器 | API Gateway | HTTPS | 所有外部請求入口 |
| API Gateway | User Service | HTTP/JSON | 身份驗證與用戶查詢 |
| API Gateway | Wafer BI (Python) | HTTP/JSON | 複雜數學運算與圖表生成 |
| 各微服務 | PostgreSQL | JDBC/SQL | 持久化數據存取 |

---
*最後更新：2026-05-07*
