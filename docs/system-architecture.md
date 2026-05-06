# 📖 K8S Microservices Demo — 系統架構文件

## 1. 系統概述

本專案是一個**整合式企業微服務生態系統**，部署在 Kubernetes 上。它展示了 K8S 如何編排不同類型的業務負載：
1. **用戶管理系統 (Identity)**：基於 Java Spring Boot 的企業級身份驗證服務。
2. **Wafer BI 分析平台 (Data)**：處理工業級晶圓數據，展示 Delta Lake 與高效能分析 API。

## 2. 技術選型

| 技術 | 選擇 | 理由 |
|------|------|------|
| API Gateway | Node.js (Express) | 輕量、適合反向代理與認證攔截 |
| User Service | Java (Spring Boot 3) | 展示 JVM 容器化最佳實踐與企業級架構 |
| Wafer BI Service | Python (FastAPI) | 適合數據處理與統計計算 |
| Data Layer | Delta Lake | 展示現代化數據湖架構 |
| Database | PostgreSQL 16 | 用戶資料持久化 |
| Orchestration | Kubernetes | 容器編排、自動伸縮 |

---

## 相關文件
- [Oracle Cloud (OCI) 部署指南](./oci-deployment.md)
- [面試指南](./interview-guide.md)

## 3. 架構設計

### 整體架構圖

```
                        ┌──────────────────────────────┐
                        │      Ingress Controller       │
                        │      (Nginx Ingress)          │
                        └──────┬──────────┬─────────────┘
                               │          │
                 ┌─────────────▼──┐  ┌────▼──────────┐
                 │   Frontend     │  │  API Gateway   │
                 │ (React+Nginx)  │  │  (Node.js)     │
                 └───────────────┬┘  └────┬───────────┘
                                 │        │
           ┌─────────────────────┼────────┼───────────────────────┐
           │ Namespace: identity │        │ Namespace: wafer-bi   │
           └─────────────────────┘        └───────────────────────┘
                     │                            │
            ┌────────▼────────┐          ┌────────▼────────┐
            │  User Service   │          │ Wafer BI Service│
            │ (Spring Boot 3) │          │ (FastAPI)       │
            └────────┬────────┘          └────────┬────────┘
                     │                            │
            ┌────────▼────────┐          ┌────────▼────────┐
            │   PostgreSQL    │          │   Delta Lake    │
            │   (Users DB)    │          │  (Parquet Files)│
            └─────────────────┘          └─────────────────┘
```

## 4. Kubernetes 資源說明

### 命名空間 (Namespace)
- `identity`: 存放 User Service 與 PostgreSQL。
- `wafer-bi`: 存放 Wafer BI Backend 與 Frontend。

### 服務特性
- **User Service**: 使用 RollingUpdate 策略，配置了 Readiness Probe 檢查資料庫連線。
- **Wafer BI**: 展示了高效能數據讀取，並透過 NodePort 暴露前端。

## 5. 部署流程

### 本地 K8S (Minikube)
1. 建立命名空間：`kubectl apply -f k8s/namespace.yaml`
2. 部署 User Service：`kubectl apply -f k8s/user-service/`
3. 部署 Wafer BI：`kubectl apply -f k8s/wafer-bi-deployment.yaml`

---
> **面試重點**：本專案刻意減少了重複的 CRUD 服務（如電商商品/訂單），轉而強化了**數據分析 (BI)** 與 **企業級認證 (Spring Boot)** 的整合，展示了在 K8S 上處理複雜異質負載的能力。
