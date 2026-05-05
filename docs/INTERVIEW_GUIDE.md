# 🎤 K8S 面試指南

## 常見問題與回答策略

### Q1: 你用過 Kubernetes 嗎？做過什麼？

> 我實作了一個異質微服務架構，核心圍繞在「身份認證」與「大數據分析」：
> 1. **Identity 權限中心**：基於 Java Spring Boot 3，負責處理 JWT 認證與用戶授權邏輯。
> 2. **Wafer BI 分析系統**：這是我專案的核心，利用 Python FastAPI 結合 **Delta Lake** 數據湖技術，處理半導體晶圓的量測數據（如 Thickness、Resistance），並提供多維度的統計圖表（Heatmap、Boxplot、Trend）。
>
> 透過這個專案，我展示了 Kubernetes 如何同時管理異構技術棧（Java vs Python）以及異構負載（事務型 Identity vs 計算型 BI Analysis）。
> 此外，我還建立了一套基於 **GitHub Actions** 的 CICD 流水線，實現了從代碼推送至 Oracle Cloud (OKE) 的自動化部署。

---

### Q2: K8S 和 Docker 是什麼關係？K8S 有用到 Docker 嗎？

> Docker 和 K8S 是**不同層級**的工具，分工如下：
>
> | | Docker | Kubernetes |
> |---|---|---|
> | **角色** | 打包工人 | 調度指揮官 |
> | **負責什麼** | 把程式碼打包成 Image，跑成 Container | 決定 Container 在哪台機器跑、跑幾個、掛了怎麼辦 |
> | **最小單位** | Container | Pod（包裝 1~N 個 Container） |
>
> 實際運作流程：
> 1. **Docker Build** — 用 Dockerfile 把程式碼打包成 Image
> 2. **Push to Registry** — Image 推到 Container Registry
> 3. **K8S Pull & Run** — kubelet 透過 Container Runtime（containerd）拉取 Image，啟動 Container，包在 Pod 裡管理
>
> ⚠️ **重點**：K8S 從 **v1.24 起移除了 dockershim**，不再直接使用 Docker Engine 來跑容器，而是改用 `containerd`。
> 但 Docker 打包出來的 Image 完全不受影響，因為 Image 格式遵循 OCI 標準。
>
> 一句話總結：**Docker 是「做便當盒」，K8S 是「管便當盒放哪、放幾個、壞了換新的」。**
>
> 在我的專案中，User Service（Java/Spring Boot）與 Wafer BI Service（Python FastAPI）各自用 Dockerfile 打包，
> K8S 的 Deployment 引用這些 Image，再透過 Pod、Service、HPA 來管理它們的生命週期。

---

### Q3: 什麼是 Pod？為什麼不直接用 Container？

> Pod 是 K8S 最小的部署單位，一個 Pod 可以包含多個 Container，它們共享網路和存儲。
> 在我的專案中，我使用了 sidecar pattern，例如日誌收集的 container 和主服務跑在同一個 Pod 裡。
> Pod 的好處是可以讓緊密相關的 container 共享 localhost 通訊，比跨 Pod 通訊更高效。

---

### Q4: Deployment 和 StatefulSet 有什麼差異？

> Deployment 適合**無狀態**服務，Pod 可以隨意替換，例如我的 API Gateway 和 Product Service。
> StatefulSet 適合**有狀態**服務，Pod 有穩定的網路身份和持久化存儲，例如資料庫。
> 在我的專案中，PostgreSQL 使用了 PVC 做持久化存儲，確保 Pod 重啟後資料不會遺失。

---

### Q5: Service 的類型有哪些？你用了哪些？

> - **ClusterIP**（預設）：只在叢集內部存取，我的 Product/Order/User Service 都用 ClusterIP，因為它們只需要被 API Gateway 呼叫。
> - **NodePort**：暴露在 Node 的固定 Port 上，我在開發環境用來直接連接 PostgreSQL 除錯。
> - **LoadBalancer**：雲端環境用，會自動建立雲端的 Load Balancer。
> - **Ingress**：我使用 Nginx Ingress Controller 做路徑路由，例如 `/api/products` → Product Service，`/api/orders` → Order Service。

---

### Q6: 怎麼做自動伸縮（HPA）？

> 我為 API Gateway 和 Product Service 配置了 HPA。
> 設定為 CPU 使用率超過 70% 時自動擴容，最少 2 個 Pod、最多 10 個。
> 我還寫了一個壓力測試腳本，用 `hey` 工具模擬大量請求，可以即時觀察 Pod 數量增加：
> ```bash
> kubectl get hpa -n k8sdemo -w
> ```

---

### Q7: ConfigMap 和 Secret 有什麼差異？

> - **ConfigMap**：存放非敏感配置，例如服務的 PORT、LOG_LEVEL、REDIS_HOST。
> - **Secret**：存放敏感資訊，例如 DB_PASSWORD、JWT_SECRET，以 base64 編碼存儲。
> 在我的專案中，所有資料庫密碼都放在 Secret 中，透過環境變數注入到 Pod。
> 要注意 Secret 的 base64 只是編碼不是加密，生產環境應該搭配 Vault 或 AWS KMS。

---

### Q8: 健康檢查（Probe）怎麼做？

> 我為每個服務都配置了三種 Probe：
> - **Liveness Probe**：檢查服務是否活著，失敗就重啟 Pod。例如 HTTP GET `/healthz`。
> - **Readiness Probe**：檢查服務是否準備好接收流量，失敗就從 Service Endpoint 移除。例如 HTTP GET `/readyz`，會檢查 DB 連線。
> - **Startup Probe**：給予服務啟動時間，避免慢啟動服務被 liveness kill。

---

### Q9: 資料持久化怎麼處理？

> PostgreSQL 使用 **PersistentVolumeClaim (PVC)** 申請存儲空間。
> PVC 會綁定到 **PersistentVolume (PV)**。在雲端通常使用 StorageClass 動態配置。
> 這確保 Pod 被重新調度到其他 Node 時，資料不會遺失。

---

### Q10: CI/CD 怎麼整合 K8S？

> 我的 GitHub Actions pipeline 包含：
> 1. **Build** — 執行單元測試
> 2. **Docker Build** — 建構 Docker Image 並 push 到 Registry
> 3. **Deploy** — 使用 `kubectl set image` 或 Helm upgrade 更新部署
> 4. **Verify** — 檢查 rollout 狀態

---

### Q11: 遇到過什麼問題？怎麼解決的？

> 1. **Pod CrashLoopBackOff**：Order Service 啟動時 Redis 還沒就緒，解法是加 Init Container 等待 Redis。
> 2. **OOMKilled**：Java 服務沒設 memory limit 導致被 kill，解法是設定 resource requests/limits。
> 3. **Ingress 路由衝突**：多個 path 匹配到同一個 backend，解法是使用 pathType: Prefix 並注意路徑優先級。
> 4. **Secret 更新不生效**：Pod 不會自動重啟讀取新 Secret，解法是用 Reloader 或 rolling restart。

---

## 進階問題

### Q12: Network Policy 是什麼？

> 限制 Pod 之間的網路通訊。例如我可以設定只有 API Gateway 能存取後端服務，
> 其他 Pod 不能直接連線，實現零信任網路架構。

### Q13: RBAC 怎麼用？

> Role-Based Access Control，我設定了不同的 ServiceAccount：
> - 開發者只能 read pods/logs
> - CI/CD 帳號只能 update deployments
> - Admin 有全部權限

### Q14: Rolling Update vs Blue-Green vs Canary？

> - **Rolling Update**（K8S 預設）：逐步替換舊 Pod，我的專案預設用這個。
> - **Blue-Green**：同時跑兩套環境，切換流量，適合需要快速回滾的場景。
> - **Canary**：先導入少量流量到新版本，觀察後再全量，可用 Istio 實現。
### Q10: 你的專案如何處理更新與維護？(DevOps)

> 我在專案中實踐了 **DevOps** 精神。我利用 **GitHub Actions** 建立了自動化流水線：
> 1. **自動構建**：每當代碼推送到 main 分支，會自動觸發 Docker Image 建置。
> 2. **安全性**：利用 GitHub Secrets 嚴格管理 Oracle Cloud 的 API Key 與憑證。
> 3. **自動更新**：透過 `kubectl rollout restart` 實現無縫更新，讓 OKE 叢集自動拉取最新版本的分析算法，確保系統始終運行最新的業務邏輯。
