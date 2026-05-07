# 📖 Wafer BI 系統架構文件 (Comprehensive System Architecture)

## 1. 系統概述

本專案是一個**整合式企業微服務生態系統**，部署在 Kubernetes 上。它展示了 K8S 如何編排不同類型的業務負載：
1. **用戶管理系統 (Identity)**：基於 Java Spring Boot 的企業級身份驗證服務，整合 Liquibase 版本控制。
2. **Wafer BI 分析平台 (Data)**：處理工業級晶圓數據，展示 Delta Lake 與高效能分析 API，前端採用 Nginx 生產級部署。

## 2. 技術選型

| 技術 | 選擇 | 理由 |
|------|------|------|
| **Frontend** | React + **Nginx** | 多階段構建，Nginx 託管靜態檔案，效能最優且穩定 |
| **API Gateway** | Node.js (Express) | 輕量、流量轉發與跨域處理 |
| **User Service** | Java (Spring Boot 3) | 企業級架構，使用 **Liquibase** 管理資料庫版本 |
| **Wafer BI** | Python (FastAPI) | 適合數據處理，自動生成測試數據並讀取 Delta Lake |
| **Traffic** | **Ingress + TLS** | 支援 HTTPS 加密，整合 **Cert-Manager** 管理憑證 |
| **CI/CD** | GitHub Actions + **Argo CD** | GitHub 處理建置 (CI)，Argo CD 負責 GitOps 部署 (CD) |

---

## 3. 架構設計

### 3.1 整體流量圖 (Mermaid)
```mermaid
graph TD
    Client((User Browser)) -->|HTTPS| Ingress[Nginx Ingress Controller]
    
    subgraph "k8sdemo Namespace (Business Logic)"
        Ingress -->|/| FE[Frontend - Nginx]
        Ingress -->|/api| GW[API Gateway]
        GW --> US[User Service]
        US --> DB[(PostgreSQL)]
    end
    
    subgraph "wafer-bi Namespace (Data Analysis)"
        GW --> WB[Wafer BI Backend]
        WB --> DL((Delta Lake))
    end
```

### 3.2 Kubernetes 資源說明
- **命名空間 (Namespace)**: 區分業務邏輯 (`k8sdemo`) 與數據分析 (`wafer-bi`)，實現資源隔離。
- **HTTPS 安全性**: 透過 `cert-manager` 實現全站傳輸加密。
- **跨平台相容**: 所有映像檔均支援 `amd64` 與 `arm64` 架構。

---

## 4. GitHub Secrets 與配置管理

### 4.1 OCI 基礎設施相關
| Secret Name | 說明 |
|-------------|------|
| `OCI_REGION` | OCI 區域 (如 `ap-tokyo-1`) |
| `OCI_TENANCY_NAMESPACE` | OCIR 命名空間 |
| `OCI_USER_NAME` | OCI 用戶名 |
| `OCI_AUTH_TOKEN` | OCI 驗證權杖 |
| `OCI_PRIVATE_KEY` | OCI API 私鑰 |
| `OKE_CLUSTER_ID` | OKE 叢集 OCID |

### 4.2 應用程式機密 (由 CICD 注入 K8S Secret)
| Secret Name | 說明 | 預設值 (演示用) |
|-------------|------|-----------------|
| `POSTGRES_USER` | 資料庫管理員帳號 | `admin` |
| `POSTGRES_PASSWORD` | 資料庫管理員密碼 | `postgres_password_123` |
| `JWT_SECRET` | JWT 簽名金鑰 | `super_secret_jwt_key_2024` |

### 4.3 演示用帳號 (Default Demo Accounts)
| 帳號 | 密碼 | 初始群組 | 說明 |
|-------|------|----------|------|
| `admin` | `admin@carrot` | `admin` | 系統管理員 (DB 內以 MD5 加密存儲) |
| `demo01` | `demo01_password_123` | `admin` | 演示專用帳號 (具備 Sudo 權限) |

---

## 5. 網路架構與埠號對照 (Networking & Ports)

### 5.1 環境對照表

| 服務項目 | 本地開發 (Local) | 伺服器生產環境 (OKE) | 說明 |
| :--- | :--- | :--- | :--- |
| **前端入口 (URL)** | `http://localhost:5173` | `https://wafer.carrot-atelier.online` | 生產環境透過 Ingress 反向代理 |
| **API 網關 (Gateway)** | `http://localhost:8080` | K8S 內部轉發 (`port: 8080`) | 生產環境不對外暴露此埠號 |
| **User Service** | `http://localhost:3002` | K8S 內部通訊 (`port: 3002`) | - |
| **Wafer BI Service** | `http://localhost:8000` | K8S 內部通訊 (`port: 8000`) | - |
| **資料庫 (Postgres)** | `localhost:5432` | K8S 內部通訊 (`port: 5432`) | - |

### 5.2 通訊邏輯差異
- **本地端 (Development)**: 前端 Vite 透過 `server.proxy` 將 `/api` 請求代理至 `localhost:8080`。
- **伺服器端 (Production)**: 統一經由 **Port 443 (HTTPS)** 進入，內部透過 K8S Service Name 進行 DNS 通訊。

---

## 6. 相關文件索引
- [🗺️ 業務邏輯與功能圖譜](./function-map.md) (核心必讀)
- [🎡 K8S 核心名詞與架構詳解](./k8s-arch-guide.md)
- [🤖 GitOps 與 Argo CD 實作](./cicd-argo.md)
- [🔐 安全性與 Sealed Secrets](./security-secrets.md)
- [🗄️ 資料庫 Schema 與 Liquibase 指南](./database-architecture.md)
- [🚀 Oracle Cloud (OCI) 部署指南](./oci-deployment.md)
- [📝 面試應對指南](./interview-guide.md)

---

## 7. 分佈式追蹤 (Distributed Tracing)

為了監控微服務之間的請求鏈結，系統預留了追蹤接口，並計畫導入 **OpenTelemetry (OTel)** 標準。

### 7.1 現有實現：Trace ID 傳播
目前 API Gateway 已實作基礎的 Trace ID 生成與傳播機制：
*   **生成器**：API Gateway (Node.js) 會為每個進入系統的請求生成一個唯一的 `X-Trace-Id`。
*   **傳播方式**：透過 HTTP Header 將 ID 傳遞給下游的 `User Service` 與 `Wafer BI Service`。
*   **目的**：當日誌出現錯誤時，可透過同一個 Trace ID 串聯起 Gateway、Java 與 Python 的所有相關日誌。

### 7.2 全面實作：OpenTelemetry + Jaeger
系統已全面升級至標準的 OpenTelemetry 追蹤體系：
1.  **Collector**：已在 K8S 部署 OTel Collector (`otel-collector-service`)。
2.  **Visualization**：使用 **Jaeger** 進行視覺化分析，入口位址：`/jaeger`。
3.  **各端實作細節**：
    *   **Java**：透過 `opentelemetry-javaagent.jar` 實現零侵入追蹤。
    *   **Node.js**：透過 `tracing.js` 整合 `sdk-node` 實現全自動追蹤。
    *   **Python**：透過 `FastAPIInstrumentor` 攔截分析請求。

---
*最後更新：2026-05-07*

