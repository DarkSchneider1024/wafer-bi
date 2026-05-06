# 📝 專業面試應對與技術精進指南

本文件旨在將本專案的開發經驗轉化為面試中的「硬核實力」，特別針對 **台積電 (TSMC) IT Computing Platform Engineer** 等高階職位。

---

## 🎯 台積電 IT 運算平台：關鍵補強計畫

根據邱宏瑋 (hwchiuk) 主管的要求，我們將專案從「會用」提升到「平台維運專家」等級。

### 1. 從 CI/CD 轉向 GitOps (ArgoCD)
*   **目標**：消除手動 `kubectl apply`，實現「代碼即真相」。
*   **面試說法**：我不只會寫流水線，我更懂如何解決「配置漂移」問題。
*   **實作**：在本地/雲端佈署 ArgoCD，監控 GitHub 倉庫的變動並自動同步至 K8S。

### 2. 核心組件與網路深挖 (Deep Dive)
*   **目標**：理解 OKE 隱藏的底層。
*   **研究重點**：
    *   **CNI (Container Network Interface)**：研究 OCI 的網路外掛程式如何實作。
    *   **DNS 解析**：徹底理解為什麼 Ingress 轉發需要 `ExternalName` 或 FQDN。
    *   **Linux 除錯**：練習在 Pod 崩潰時進入容器進行 `strace` 或核心層級分析。

### 3. 可觀測性 (Observability)
*   **目標**：證明你有 7x24 維運能力。
*   **實作**：導入 Prometheus + Grafana，設定晶圓數據 API 的回應時間監控。

### 4. AI Agentic Workflow (核心亮點)
*   **目標**：展示如何利用 AI 工具優化 SRE 流程。
*   **亮點**：描述你如何利用 **Gemini CLI** 進行「Pair Programming」與「自動 RCA 分析」。強調 AI 是你的助手，而你掌握所有的底層判斷邏輯。

---

## 🚀 目前首要任務：地端 ArgoCD 實作計畫

我們的目標是建立一個「雲地結合」的架構：
1. **GitHub Actions (雲)**：負責 Build 映像檔並更新 `k8s/` 中的版本號。
2. **ArgoCD (地/雲)**：負責偵測 K8S 設定變更並「拉取 (Pull)」部署。

### 步驟 A：地端環境準備 (立即執行)
1.  **啟動本地 K8S**：請確保您的 Docker Desktop (K8S) 或 Minikube 是開啟的。
2.  **安裝 ArgoCD**：
    ```bash
    kubectl create namespace argocd
    kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
    ```

### 步驟 B：取得管理權限
1.  **取得密碼**：
    ```bash
    kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
    ```
2.  **存取 UI**：將服務暴露出來後透過瀏覽器登入。

---

## 🛠️ 技術問答挑戰 (TSMC 模擬題)

1.  **Q: 為什麼 Ingress 不直接寫 Pod IP？**
    *   *A: 因為 Pod 的生命週期是短暫的，IP 會隨時變動。我們透過 Service 名稱進行抽象化，並在跨命名空間時使用 ExternalName 代理，以確保 Ingress Controller 始終能透過 DNS 找到正確的後端。*

2.  **Q: 遇到 ImagePullBackOff，你的排查 SOP 是什麼？**
    *   *A: 1. 檢查 Events 訊息；2. 驗證映像檔名稱與標籤是否正確；3. 檢查 ImagePullSecrets (憑證)；4. 檢查節點架構 (amd64/arm64) 與映像檔是否相容。*

---
*本計畫將隨專案進度持續更新，確保每一項技術都能講出底層邏輯。*
