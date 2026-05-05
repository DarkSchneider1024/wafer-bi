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

若要獲得公網 IP，請將 Service 類型更改為 `LoadBalancer`：

```yaml
# 修改範例
kind: Service
metadata:
  name: wafer-frontend-svc
spec:
  type: LoadBalancer  # OCI 會自動配發公網 IP
  ports:
  - port: 80
    targetPort: 5173
```

執行 `kubectl get svc -n wafer-bi` 獲取 `EXTERNAL-IP`。

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
      - name: Setup OCI CLI & Kubeconfig
        uses: oracle-actions/setup-oci-cli@v1
        with:
          user_ocid: ${{ secrets.OCI_USER_OCID }}
          tenancy_ocid: ${{ secrets.OCI_TENANCY_OCID }}
          fingerprint: ${{ secrets.OCI_FINGERPRINT }}
          region: ${{ secrets.OCI_REGION }}
          private_key: ${{ secrets.OCI_PRIVATE_KEY }}
      - name: Deploy to OKE
        run: |
          oci ce cluster create-kubeconfig --cluster-id ${{ secrets.OKE_CLUSTER_ID }} --file $HOME/.kube/config --region ${{ secrets.OCI_REGION }} --token-version 2.0.0
          kubectl apply -f k8s/
          kubectl rollout restart deployment wafer-backend
```
