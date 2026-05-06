# 🗄️ Wafer BI 資料庫架構文件

本系統採用 **Polyglot Persistence (多語言持久化)** 策略，針對不同數據特性選擇最佳的存儲方案。

## 1. 關係型資料庫：PostgreSQL 16

*   **職責**: 存儲企業級身份數據、權限設定與業務配置。
*   **優勢**: 
    *   **ACID 事務**: 確保用戶註冊、修改權限時的數據絕對正確。
    *   **關聯查詢**: 方便處理 User、Role、Permission 之間的多對多關係。
    *   **成熟生態**: 支援各種備份與復原機制。

---

## 2. 現代化數據湖：Delta Lake (Parquet 格式)

本專案的核心數據存儲方案，用於存放工業級的晶圓量測數據。

*   **職責**: 存儲海量的 Wafer Die-level 原始數據（如 Thickness, Resistance）。
*   **關鍵技術**:
    *   **Apache Parquet**: 使用「列式存儲 (Columnar Storage)」，大幅壓縮存儲空間，並加速統計聚合運算。
    *   **ACID 事務**: 即使是在檔案系統 (S3/Local PV) 上，也能確保寫入的原子性。
    *   **Schema Enforcement**: 防止不合法的欄位數據寫入數據湖。

### 為什麼選擇 Delta Lake 而非傳統 SQL 資料庫？
1.  **大數據吞吐量**: 傳統資料庫在處理數百萬行 Die 數據時，索引維護開銷極大；Delta Lake 則能以檔案形式進行極速掃描。
2.  **開放格式**: Parquet 檔案可以被 Python、Spark、Presto 等多種大數據工具直接讀取。
3.  **計算下推 (Push-down)**: 配合 DuckDB 或 PyArrow，可以實現「只讀取需要的列」，節省大量記憶體。

---

## 3. 數據流向圖 (Data Flow)

1.  **用戶操作** -> 由 **PostgreSQL** 驗證身分。
2.  **大數據查詢** -> 後端透過 `deltalake` 庫直接讀取 **Persistent Volume** 中的 Parquet 檔案。
3.  **分頁處理** -> 透過 Python 在記憶體中進行分頁切片，最後轉化為 JSON 回傳前端。

---
*本文件旨在說明 Wafer BI 系統中的數據管理策略。*
