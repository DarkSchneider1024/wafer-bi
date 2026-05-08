# 🚀 Oracle Cloud (OCI) 部署與流量管理指南

本專案採用 OCI OKE (Kubernetes) 託管服務，並透過 GitHub Actions 實現 CICD 自動化部署。

## 1. 基礎環境建立 (一次性)

1.  **建立 OKE 叢集**：
    - 進入 OCI 控制台 -> **Developer Services** -> **Kubernetes Clusters (OKE)**。
    - 點擊 **Create Cluster** -> **Quick Create**。
    - 建議選擇 **Ampere (ARM)** 節點以使用 Always Free 額度。
2.  **安裝 Ingress Controller (總機系統)**：
    - 在叢集詳情頁面點擊 **Access cluster** -> **Cloud Shell Access**。
    - 複製並執行該視窗提供的 `oci ce cluster create-kubeconfig ...` 指令（此為授權動作）。
    - 接著在 Cloud Shell 執行以下安裝指令：
      ```bash
      kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.2/deploy/static/provider/cloud/deploy.yaml
      ```

## 2. GitHub Secrets 設定 SOP

請在 GitHub 倉庫的 **Settings > Secrets and variables > Actions** 中設定以下 9 個變數。

### A. 帳號與叢集身分 (OCID)

| 參數名稱 | 獲取路徑 | 說明 |
| :--- | :--- | :--- |
| **`OKE_CLUSTER_ID`** | **Developer Services** > **Kubernetes Clusters** > 點擊您的叢集名字。 | 頁面中間的 **OCID** 欄位。 |
| **`OCI_USER_OCID`** | 右上角個人頭像 > **My profile**。 | **User Details** 區塊中的 **OCID**。 |
| **`OCI_TENANCY_OCID`** | 右上角個人頭像 > **Tenancy: [您的名字]**。 | **Tenancy Information** 中的 **OCID**。 |
| **`OCI_REGION`** | 控制台右上角顯示的區域代碼。 | 例如東京為 `ap-tokyo-1`。 |
| **`OCI_FINGERPRINT`** | **My profile** > 左側選單 **API keys**。 | 對應私鑰的 **Fingerprint** 字串。 |
| **`OCI_PRIVATE_KEY`** | 下載的 `.pem` 檔案內容。 | 請用 **記事本** 打開，複製包含 `---BEGIN/END---` 的全文。 |

### B. 映像檔倉庫 (OCIR) 與 認證

| 參數名稱 | 獲取路徑 | 說明 |
| :--- | :--- | :--- |
| **`OCI_TENANCY_NAMESPACE`** | 右上角個人頭像 > **Tenancy: [您的名字]**。 | 找 **Object Storage Namespace** 欄位。 |
| **`OCI_USER_NAME`** | 同您的登入帳號。 | 通常是 Email 格式。 |
| **`OCI_AUTH_TOKEN`** | **My profile** > 左側選單 **Auth tokens**。 | 點擊 **Generate Token** 產生的隨機字串（只會顯示一次）。 |

## 3. 獲取最終網址 (IP 辨識)

部署完成後，進入 **Networking** > **Load balancers** 頁面，您通常會看到兩個 IP：

1.  **Frontend Service IP**：這是「純前端」門牌，通常無法正常抓取後端資料（因為跨域與路由問題）。
2.  **Ingress Controller IP** (推薦)：這是在執行完 `kubectl apply nginx` 指令後產生的 **新 IP**。
    - **識別特徵**：通常是在您手動執行安裝指令後約 2 分鐘出現。
    - **功能**：它能根據路徑（`/` 指向網頁，`/api` 指向後端）正確導流。
    - **最終網址**：`http://[這個新的IP]`。

## 4. 常見問題排除

- **ERR_CONNECTION_RESET**：通常是 K8S Service 的 `targetPort` 與容器內的埠 (5173/8000) 不匹配。
- **404 Not Found**：請檢查 `k8s/ingress.yaml` 中的 `host` 設定是否已移除或改為通配符。
- **ImagePullBackOff (Ambiguous list)**：在 OKE 上部署公有映像檔時，建議加上完整 Registry 前綴（如 `docker.io/`），避免因為短名稱限制導致抓取失敗。
- **無數據顯示**：檢查前端 `App.tsx` 中的 `API_BASE` 是否已改為動態路徑 `/api`。

---
*本文件由開發團隊實測紀錄，確保部署流程之安全性與準確性。*
