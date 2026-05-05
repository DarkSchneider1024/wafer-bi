# 🚀 Oracle Cloud (OCI) 部署指南

本指南說明如何將 Wafer BI 與用戶管理系統部署至 Oracle Cloud 的託管 K8S 環境 (OKE)。

## 1. 建立 K8S 叢集 (OKE)

1. 登錄 OCI 主控台 -> **Developer Services** -> **Kubernetes Clusters (OKE)**。
2. 點擊 **Create Cluster** -> 選擇 **Quick Create**。
3. **重要配置**：
   - **Name**: `wafer-bi-demo`
   - **Node Shape**: 選擇 **Ampere (ARM) - VM.Standard.A1.Flex**。
   - **Node Count**: 2 (享受 Always Free 的 24GB RAM 額度)。
4. 點擊 **Create Cluster** 並等待就緒。

## 2. 連線至叢集 (使用 Cloud Shell)

1. 在叢集頁面點擊 **Access Cluster**。
2. 選擇 **Cloud Shell Access**。
3. 執行頁面提供的 `oci ce cluster create-kubeconfig` 指令。
4. 驗證連線：`kubectl get nodes`。

## 3. 部署應用程式

在 Cloud Shell 中建立或上傳 `deployment.yaml`，然後執行：

```bash
# 1. 建立 Namespace
kubectl create ns wafer-bi

# 2. 部署系統
kubectl apply -f wafer-bi-deployment.yaml -n wafer-bi
```

## 4. 外部存取 (Load Balancer)

部署完成後，OKE 會自動為前端服務配發一個公網 IP。請依照以下步驟找到您的網址：

1.  登錄 OCI 主控台。
2.  點擊左上角導覽菜單 -> **Networking (網路)** -> **Load Balancers (負載平衡器)**。
3.  在列表中尋找狀態為 **Active** 且健康狀態為 **Ok** 的項目。
4.  複製其 **IP Address** 欄位（例如：`161.33.136.81`）。
5.  在瀏覽器輸入 `http://[您的IP]` 即可訪問。

> [!IMPORTANT]
> **通訊埠映射說明**：
> 雖然前端開發伺服器 (Vite) 運行在容器內的 `5173` 埠，但透過 K8S Service 的映射 (`port: 80` -> `targetPort: 5173`)，外部使用者只需透過標準的 **80 埠**（即直接輸入 IP）即可存取，不需要在網址後方加上 `:5173`。

## 5. 資源清理

展示結束後，若要節省資源，可刪除 Namespace：
```bash
kubectl delete ns wafer-bi
```
## 5. 自動化部署 (GitHub Actions CICD)

您可以透過 GitHub Actions 實現自動化構建與部署：

### GitHub Secrets 設定
請在 GitHub 倉庫設定以下 Secrets：
- `OCI_USER_OCID`, `OCI_TENANCY_OCID`, `OCI_REGION`, `OCI_FINGERPRINT`, `OCI_PRIVATE_KEY` (API 認證)
- `OCI_TENANCY_NAMESPACE` (OCIR 命名空間)
- `OCI_USER_NAME` (OCI 登入帳號)
- `OCI_AUTH_TOKEN` (用於 Docker Login)
- `OKE_CLUSTER_ID` (叢集 OCID)

### Workflow 範例 (.github/workflows/deploy.yml)
```yaml
name: OCI Deployment
on: [push]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Login to OCIR
        run: echo "${{ secrets.OCI_AUTH_TOKEN }}" | docker login ${{ secrets.OCI_REGION }}.ocir.io -u "${{ secrets.OCI_TENANCY_NAMESPACE }}/${{ secrets.OCI_USER_NAME }}" --password-stdin
      - name: Build & Push
        run: |
          docker build -t ${{ secrets.OCI_REGION }}.ocir.io/${{ secrets.OCI_TENANCY_NAMESPACE }}/wafer-bi:latest ./services/wafer-bi
          docker push ${{ secrets.OCI_REGION }}.ocir.io/${{ secrets.OCI_TENANCY_NAMESPACE }}/wafer-bi:latest
      - name: Install OCI CLI
        run: pip install oci-cli
      - name: Deploy to OKE
        run: |
          oci ce cluster create-kubeconfig --cluster-id ${{ secrets.OKE_CLUSTER_ID }} --file $HOME/.kube/config --region ${{ secrets.OCI_REGION }} --token-version 2.0.0
          kubectl apply -f k8s/
          kubectl rollout restart deployment wafer-backend
        env:
          OCI_CLI_USER: ${{ secrets.OCI_USER_OCID }}
          OCI_CLI_TENANCY: ${{ secrets.OCI_TENANCY_OCID }}
          OCI_CLI_FINGERPRINT: ${{ secrets.OCI_FINGERPRINT }}
          OCI_CLI_KEY_CONTENT: ${{ secrets.OCI_PRIVATE_KEY }}
          OCI_CLI_REGION: ${{ secrets.OCI_REGION }}

## 6. 救援指南：如果 Secrets 設定遇到困難

如果您在設定 GitHub Secrets 時遇到檔案打不開或找不到值的問題，請參考以下整理好的資訊：

## 6. 安全性與參數獲取 SOP (Secrets Management)

為了保障安全性，GitHub Secrets 應手動從 OCI 控制台獲取。請依照以下 SOP 填寫 GitHub 倉庫的 **Settings > Secrets > Actions**。

### A. 認證參數獲取 SOP

| 參數名稱 | 獲取路徑 (SOP) |
| :--- | :--- |
| **`OKE_CLUSTER_ID`** | **Developer Services** > **Kubernetes Clusters** > 點擊您的叢集 > 複製頁面頂部的 **OCID**。 |
| **`OCI_USER_OCID`** | 點擊右上角 **個人頭像** > **User Settings** > 複製 **OCID**。 |
| **`OCI_TENANCY_OCID`** | 點擊右上角 **個人頭像** > **Tenancy** > 複製 **OCID**。 |
| **`OCI_REGION`** | 查看網址或右上角區域。例如東京為 `ap-tokyo-1`。 |
| **`OCI_FINGERPRINT`** | **User Settings** > 左側 **API Keys** > 複製列表中對應 Key 的 **Fingerprint**。 |
| **`OCI_PRIVATE_KEY`** | 生成 API Key 時下載的 `.pem` 檔案內容（需包含 `BEGIN/END` 橫線）。 |

### B. 映像檔倉庫 (OCIR) 參數

| 參數名稱 | 獲取路徑 (SOP) |
| :--- | :--- |
| **`OCI_TENANCY_NAMESPACE`** | 點擊右上角 **個人頭像** > **Tenancy** > 找 **Object Storage Namespace**。 |
| **`OCI_USER_NAME`** | 您的 OCI 登入帳號（通常是您的 Email）。 |
| **`OCI_AUTH_TOKEN`** | **User Settings** > 左側 **Auth Tokens** > **Generate Token**。 |

> [!CAUTION]
> **絕對不要**將上述任何真實數值直接寫入代碼或 Markdown 文件並推送到 Git 分支。請務必使用 GitHub Secrets 進行管理。
