# 🔐 安全性實踐 — Sealed Secrets (密鑰加密託管)

在 GitOps 的實踐中，我們面臨一個挑戰：**如何安全地將數據庫密碼、API Key 等敏感資訊存放在公開的 GitHub 倉庫中？**

本專案採用 Bitnami 出品的 **Sealed Secrets** 來解決這個問題。

## 1. 核心原理：非對稱加密

Sealed Secrets 使用「非對稱加密」技術：
1.  **控制器 (Controller)**：運行在 OKE 叢集內部，持有唯一的 **私鑰**。
2.  **客戶端 (kubeseal)**：開發者在本地使用叢集的 **公鑰** 加密敏感數據。
3.  **加密結果 (SealedSecret)**：加密後的 YAML 檔案是安全的，即使在公開 GitHub 倉庫中也無法被破解。
4.  **自動解密**：當 Argo CD 將 `SealedSecret` 部署到叢集時，控制器會自動用私鑰將其還原為標準的 `Kubernetes Secret`。

## 2. 安裝流程

### 2.1 叢集端安裝 (OKE)
```bash
# 安裝 Sealed Secrets 控制器
kubectl apply -f https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.24.5/controller.yaml
```

### 2.2 本地端安裝 (kubeseal CLI)
- **Windows (Go install)**: `go install github.com/bitnami-labs/sealed-secrets/cmd/kubeseal@latest`
- **Mac/Linux**: `brew install kubeseal`

## 3. 操作流程 (實踐 `system-config.properties`)

### 步驟 A：建立原始 Secret (僅在本地)
```bash
# 不要將此檔案推送到 Git!
kubectl create secret generic system-config \
  --from-file=system-config.properties=./system-config.properties \
  --dry-run=client -o yaml > system-config-raw.yaml
```

### 步驟 B：加密 (產生可公開的檔案)
```bash
kubeseal --format=yaml < system-config-raw.yaml > k8s/system-config-sealed.yaml
```

### 步驟 C：提交 Git
現在您可以放心地將 `k8s/system-config-sealed.yaml` 推送到 GitHub。Argo CD 會同步它，而 Sealed Secrets 控制器會將它還原成程式可以讀取的 `system-config` Secret。

## 4. 安全優勢

- **符合開源規範**：敏感資訊不落地，倉庫中僅存放加密後的代碼。
- **GitOps 友好的**：密碼變更與代碼變更一樣，都可以透過 Git Commit 追蹤（雖然是加密的）。
- **權限最小化**：GitHub Actions 不需要知道任何真實密碼，它只需要負責將加密後的 YAML 送入叢集。

---
*Last updated: 2026-05-07*
