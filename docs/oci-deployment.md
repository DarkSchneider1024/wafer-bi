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

> [!TIP]
> 如果您想透過指令查看，可以在 Cloud Shell 執行：
> `kubectl get svc frontend-service -n k8sdemo`

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

### A. 已經幫您找出的值 (直接複製貼上)
*   **`OKE_CLUSTER_ID`**: `ocid1.cluster.oc1.ap-tokyo-1.aaaaaaaa7k366si4cixyzm3qxms6emhocd3tvbnt3g43btuu2chtlr3vnqoq`
*   **`OCI_REGION`**: `ap-tokyo-1`
*   **`OCI_USER_OCID`**: `ocid1.user.oc1..aaaaaaaaial3eluyqo562nhiq26zza3trdnryku3bofjjcclpku2w42dqela`
*   **`OCI_TENANCY_OCID`**: `ocid1.tenancy.oc1..aaaaaaaa6b7x5ugoiJuasi4nui6y37vrnj5ooo3dwiajv4vgwqbomx3cwjyq`
*   **`OCI_FINGERPRINT`**: `97:77:f5:19:77:80:0b:cc:08:de:57:b1:11:a8:c2:ae`

### B. 尚未完成的值 (需手動操作)

#### 1. `OCI_PRIVATE_KEY` (最重要)
*   **問題**：下載的 `.pem` 檔案打不開或被瀏覽器擋住。
*   **解法**：
    1.  到 OCI 的 **API Keys** 頁面點擊 **Add API Key**。
    2.  點擊下載私鑰後，若瀏覽器警告，請點擊「保留」。
    3.  在下載資料夾找到檔案後，**按右鍵 -> 開啟方式 -> 記事本**。
    4.  複製裡面所有文字（包含橫線）貼到 GitHub。

#### 2. `OCI_AUTH_TOKEN`
*   **解法**：
    1.  進入 OCI 的 **Auth Tokens** 頁面。
    2.  點擊 **Generate Token**，輸入名字後產生。
    3.  **立刻複製**那一串亂碼，貼到 GitHub。

#### 3. `OCI_TENANCY_NAMESPACE`
*   **解法**：在 OCI 租戶 (Tenancy) 詳情頁面，尋找 **Object Storage Namespace** 欄位（通常是一串英文字）。

### C. 部署順序
1.  在 GitHub 設定好這 9 個 Secrets。
2.  推送代碼：`git push origin main`。
3.  到 GitHub **Actions** 頁面看結果。
