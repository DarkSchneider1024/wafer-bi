# 🔐 認證與安全性技術規範 (Auth & Security Spec)

## 1. 混合加密架構 (Hybrid Password Hashing)
為了支援舊資料導入並符合現代安全標準，`user-service` 採用雙模式驗證：

### 1.1 MD5 模式 (Legacy Support)
*   **觸發條件**：資料庫存儲的密碼長度為 32 字元。
*   **用途**：支援由 Liquibase 初始寫入的系統管理員帳號 (`admin`)。
*   **實作**：使用 Java 的 `MessageDigest` 計算 MD5 並進行字串比對。

### 1.2 BCrypt 模式 (Standard)
*   **觸發條件**：一般用戶註冊，長度為 60 字元 (BCrypt 格式)。
*   **用途**：所有生產環境的新用戶認證。
*   **實作**：使用 Spring Security 的 `BCryptPasswordEncoder`。

## 2. JWT 運作機制 (Hotel Metaphor)
系統使用 JWT 作為無狀態認證工具：

### 2.1 核發與簽名
*   **金鑰**：使用 `JWT_SECRET` (HS256) 進行簽名。
*   **Payload** 包含：
    ```json
    {
      "sub": "username",
      "group": "admin",
      "iat": 1715050000,
      "exp": 1715053600
    }
    ```

### 2.2 驗證流程 (Gateway Side)
API Gateway 負責攔截所有 `/api` 請求，解析 `Authorization: Bearer <Token>`。
*   **效驗簽名**：確保 Token 未被偽造。
*   **解析 Role**：根據 `group` 欄位判斷是否允許存取敏感路徑（如 `/api/users`）。

## 3. 機密管理 (Secrets)
*   所有金鑰透過 K8S SealedSecrets 或 Environment Variables 注入，嚴禁硬編碼在原始碼中。
