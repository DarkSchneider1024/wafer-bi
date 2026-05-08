# 🚀 Wafer BI 企業級數據分析平台 (OKE 部署)

🚀 **Live Demo (雲端演示網址)**: [https://wafer.carrot-atelier.online/](https://wafer.carrot-atelier.online/)

---

> 這是一個專為技術展示設計的高階展示專案，展示了 Kubernetes (OKE) 如何編排異構技術棧（Java/Python/Node.js）與處理工業大數據分析工作負載。

## 📚 專案文檔導航中心 (Documentation Portal)

為了維持開發效率與文件一致性，所有技術細節與操作手冊已歸類如下：

### 🏗️ 架構與設計 (Architecture)
- **[系統全架構指南](./docs/function-tech/system-architecture.md)**：包含 整體流程圖、微服務職責、全網址導航圖。
- **[K8S 資源與運作手冊](./docs/function-tech/k8s-arch-guide.md)**：深入了解 Namespace 隔離、Service 通訊與負載均衡。

### 🚀 部署與維運 (Deployment & Ops)
- **[終極部署與 CI/CD 維運全書](./docs/function-tech/deployment-sop.md)**：包含 OKE 搭建、GitHub Actions 動態標籤、Argo CD GitOps 實作。
- **[常用維運指令集 (急救包)](./docs/function-tech/k8s-arch-guide.md#5-常用維運指令集-troubleshooting-cheat-sheet)**：當 Pod 出錯或需要手動清理數據時的快速參考。

### 🔬 業務功能 (Business)
- **[Wafer BI 分析功能](./docs/function-book/wafer-bi-analysis.md)**：熱圖、CDF、箱線圖等數據科學功能說明。
- **[身份認證與權限規範](./docs/function-book/auth-roles.md)**：JWT 安全機制與管理員權限說明。

### 🎤 面試與發展
- **[技術面試準備指南](./docs/INTERVIEW_GUIDE.md)**：如果您準備攜帶此專案參加面試，請必讀此篇。

---

## 🛠️ 核心技術棧 (Core Tech Stack)

| 模組 | 技術關鍵字 |
| :--- | :--- |
| **Frontend** | React, ECharts, Lucide |
| **API Gateway** | Node.js, Express |
| **User Service** | Java 21, Spring Boot 3, Liquibase |
| **Wafer BI** | Python 3.10, FastAPI, Delta Lake |
| **Infrastructure** | Kubernetes (OKE), Docker, Argo CD, OpenTelemetry |

---

## 💻 快速啟動 (Quick Start)

### 1. 地端開發模式 (Local Development)

由於本專案為微服務架構，地端啟動最簡單的方式是使用 **Docker Compose**。

#### A. 一鍵啟動 (推薦)
```bash
# 確保已安裝 Docker Desktop 並啟動
docker-compose up -d --build
```
這將會自動啟動 PostgreSQL、Redis、以及所有的微服務。

#### B. 手動開發模式 (各別啟動)
如果您需要開發特定模組，請按照以下順序啟動：
1. **基礎設施**：啟動 PostgreSQL 資料庫。
2. **User Service (Java)**：進入 `services/user-service` 執行 `./mvnw spring-boot:run`。
3. **Wafer BI Service (Python)**：進入 `services/wafer-bi` 執行 `python main.py`。
4. **API Gateway (Node.js)**：進入 `services/api-gateway` 執行 `npm start`。
5. **Frontend (React)**：進入 `services/frontend` 執行 `npm run dev`。

詳情請參閱：**[地端開發與環境配置指南](./docs/function-tech/system-architecture.md#5-網路架構與埠號對照-networking--ports)**

### 2. 雲端部署與自動化
本專案已全面自動化，只要推送至 `main` 分支，CI/CD 將自動更新雲端環境。
詳情請參閱：**[部署 SOP](./docs/function-tech/deployment-sop.md)**

---
*Last updated: 2026-05-08*
*Maintainer: Golden Carrot Architect*
