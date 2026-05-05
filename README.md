# 🚀 Wafer BI 企業級數據分析平台 (OKE 部署)

🚀 **Live Demo (雲端演示網址)**: [http://161.33.136.81/](http://161.33.136.81/)

---

> 這是一個專為技術面試設計的高階展示專案，展示了 Kubernetes 如何編排異構技術棧（Heterogeneous Stack）與處理複雜的工業大數據分析工作負載。

## 🏗️ 系統架構

本專案將複雜的業務邏輯拆分為兩個核心子系統，並透過 **Nginx Ingress** 統一對外提供服務：

```
                    ┌─────────────────────────┐
                    │     Ingress (Nginx)      │
                    │   api.k8sdemo.local      │
                    └──────────┬──────────────┘
                               │
               ┌───────────────┼───────────────┐
               │               │               │
      ┌────────▼───────┐ ┌─────▼──────┐ ┌──────▼────────┐
      │   Frontend     │ │API Gateway │ │   Grafana      │
      │ (React+ECharts)│ │ (Node.js)  │ │  (Monitoring)  │
      └────────────────┘ └─────┬──────┘ └────────────────┘
                               │
               ┌───────────────┴───────────────┐
               │                               │
      ┌────────▼───────┐              ┌────────▼────────┐
      │  User Service  │              │ Wafer BI Service│
      │ (Spring Boot 3)│              │ (FastAPI+Delta) │
      └────────┬───────┘              └────────┬────────┘
               │                               │
      ┌────────▼───────┐              ┌────────▼────────┐
      │  PostgreSQL    │              │   Delta Lake    │
      │ (Identity DB)  │              │ (Parquet Table) │
      └────────────────┘              └────────────────┘
```

## 🌟 核心功能

### 1. 身份認證中心 (User Service)
*   **技術棧**：Java 21, Spring Boot 3.3, Spring Security, JWT, PostgreSQL。
*   **功能**：處理企業級的用戶註冊、登入驗證與權限管理，為整個微服務生態系統提供安全屏障。

### 2. 工業數據分析 (Wafer BI)
*   **技術棧**：Python 3.10, FastAPI, Delta Lake (DuckDB/PyArrow), ECharts。
*   **功能**：
    *   **大數據存儲**：利用 **Delta Lake** 實現 Parquet 格式的 ACID 數據管理。
    *   **統計圖表**：提供 25 片晶圓總覽 (Grid View)、晶圓熱圖 (Heatmap)、分佈圖 (CDF)、箱線圖 (Boxplot) 與批次趨勢圖 (Trend)。
    *   **多參數分析**：支援 Thickness (膜厚) 與 Resistance (電阻) 等多維度參數篩選。

## 🛠️ 技術棧一覽

| 服務模組 | 技術關鍵字 | 職責說明 |
| :--- | :--- | :--- |
| **Frontend** | React, ECharts, Lucide | 現代化數據看板，極致的視覺化與互動體驗 |
| **API Gateway** | Node.js, Express | 統一路由轉發、跨域處理、JWT 驗證轉接 |
| **User Service** | Java 21, Spring Boot 3 | 企業級事務處理、安全架構、Relational DB |
| **Wafer BI** | Python, FastAPI, Pandas | 數據科學計算、Delta Lake 讀寫、高效能 API |
| **Infra** | Kubernetes (OKE), Docker | 容器化編排、自動擴展、負載均衡 |

## 📦 K8S 核心概念實踐

本專案深度實踐了以下 K8S 技術點，非常適合作為技術面試的 Demo：
*   **異構編排**：在同一個叢集中管理 Java (JVM) 與 Python (FastAPI) 容器。
*   **數據湖集成**：在 K8S 內部掛載 PersistentVolume 管理 Delta Lake 數據。
*   **自動化部署**：整合 **GitHub Actions** 實現從代碼推送至 Oracle Cloud (OKE) 的 CICD。
*   **服務發現**：利用 Service (ClusterIP) 實現微服務間的內部通信。
*   **流量控制**：透過 Nginx Ingress 控制外部存取路徑。

## 🚀 快速啟動

### 1. 地端開發模式 (Local)
```bash
# 啟動後端 API (Python)
cd services/wafer-bi
python main.py

# 啟動前端專案 (React)
cd services/frontend
npm install
npm run dev
```

### 2. 雲端部署 (Oracle Cloud OKE)
詳情請參閱：[OCI 部署指南](./docs/oci-deployment.md)

## 🎤 面試準備
如果您準備攜帶此專案參加面試，請務必閱讀：[K8S 面試問答指南](./docs/INTERVIEW_GUIDE.md)
