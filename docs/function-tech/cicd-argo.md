# 🤖 GitOps 實作指南 — Argo CD

本專案採用 **GitOps** 模式進行持續部署 (CD)，使用 Argo CD 作為 Kubernetes 內部的控制器，確保 OKE 叢集的狀態始終與 GitHub 倉庫中的 `k8s/` 配置保持一致。

## 1. 架構概述

我們將 CI 與 CD 職責分離：
- **CI (GitHub Actions)**：負責測試、構建 Multi-arch (amd64/arm64) Docker 映像檔，並推送到 OCI OCIR。
- **CD (Argo CD)**：偵測到 Git 上的 `k8s/` 目錄變更後，自動同步並更新 OKE 叢集中的資源。

## 2. Argo CD 安裝與配置 (OCI OKE)

### 2.1 安裝指令
由於 Argo CD 的資源較大，在 OKE 上需使用 Server-Side Apply：
```bash
kubectl create namespace argocd
kubectl apply --server-side -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
```

### 2.2 曝露 UI 面板 (HTTPS Ingress)
我們使用 Nginx Ingress 將 Argo CD 面板曝露於特定域名下：
*   **網址**：`https://argo.carrot-atelier.online`
*   **DNS 配置**：請新增 `A 紀錄` 指向 **`141.147.162.214`**。
*   **憑證同步**：由於 K8S 的 Secret 不能跨命名空間，我們需將 TLS 憑證從 `k8sdemo` 拷貝至 `argocd`：
    ```bash
    kubectl get secret wafer-bi-tls -n k8sdemo -o yaml | sed 's/namespace: k8sdemo/namespace: argocd/' | kubectl apply -f -
    ```

### 2.3 獲取管理員密碼
登入帳號為 `admin`，初始密碼獲取指令：
```bash
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d; echo
```

## 3. Application 配置

我們在 Argo CD 中建立了一個名為 `wafer-bi` 的應用程式，其核心配置如下：

- **Repository**: `https://github.com/DarkSchneider1024/wafer-bi.git`
- **Path**: `k8s`
- **Cluster**: `https://kubernetes.default.svc`
- **Namespace**: `wafer-bi`
- **Sync Policy**: `Automated`
  - 勾選 `Prune Resources`：自動刪除 Git 中已移除的資源。
  - 勾選 `Self Heal`：防止手動在叢集中修改資源（確保 Git 為唯一真理）。

## 4. 進階：動態標籤與自動化 GitOps 流程

為了確保 OKE 叢集能 100% 同步到最新代碼，我們實作了「動態標籤 (Dynamic Tagging)」策略：

### 4.1 為什麼需要動態標籤？
如果 YAML 檔中永遠使用 `:latest`，Argo CD 會因為「檔案內容未變動」而不會觸發滾動更新。這會導致即使 Docker Registry 有新映像檔，Pod 依然跑著舊代碼。

### 4.2 運作邏輯
1.  **Unique Tag**: GitHub Actions 每次構建時，會產生一個基於 `GITHUB_SHA` 的唯一標籤。
2.  **Manifest Update**: 構建完成後，GitHub Actions 會自動修改 `k8s/` 目錄下的 Deployment YAML 檔案，將映像檔標籤從 `latest` 改為具體的 `Commit-SHA`。
3.  **Git Push Back**: GHA 將修改後的 YAML 推回 GitHub 倉庫。
4.  **Argo CD Sync**: Argo CD 偵測到 Git 內容變動，立即發動滾動更新 (Rolling Update)。

### 4.3 流程示意圖
```mermaid
graph LR
    Dev[開發者 Push] --> GHA[GitHub Actions]
    GHA --> Build[Build & Push Image]
    Build --> Update[Update YAML with SHA]
    Update --> Push[Push YAML to Git]
    Push --> Argo[Argo CD Detected]
    Argo --> Deploy[Deploy to OKE]
```

透過此流程，我們實現了真正的「版本可追溯性」與「自動化部署閉環」。

## 5. 為什麼選擇 GitOps？

1.  **版本控制一切**：每一次部署都有 Git Commit 紀錄。
2.  **安全性**：GitHub Actions 不再需要擁有叢集的 `admin` 權限，僅需更新 Git 代碼。
3.  **災難復原**：如果叢集崩潰，只需在新叢集安裝 Argo CD 並指向同一個 Git 倉庫，幾分鐘內即可恢復所有服務。
4.  **解決「漂移」問題**：Argo CD 會不斷對比 Git 與實體叢集的差異，確保環境不被手動修改。

---
*Last updated: 2026-05-07*
