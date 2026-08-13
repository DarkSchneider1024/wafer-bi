# k8s/ 目錄說明

> ⚠️ **K8S 部署的唯一真相來源 (Source of Truth) 是 [`helm/wafer-bi/`](../helm/wafer-bi/)，不是這裡。**

## 目前的部署鏈路

```
git push (services/**)
   → GitHub Actions 建置 Image 推上 GHCR
   → CI 更新 helm/wafer-bi/values.yaml 的 image tag（[skip ci] commit）
   → ArgoCD（k8s/argocd-app.yaml）監看 helm/wafer-bi/ → 自動同步到 OKE
```

## 檔案結構

| 路徑 | 狀態 | 用途 |
|------|------|------|
| `argocd-app.yaml` | ✅ 使用中 | ArgoCD Application 定義，指向 `helm/wafer-bi/`（只在初始化叢集時手動 apply 一次） |
| `cluster-issuer.yaml` | ✅ 使用中 | cert-manager ClusterIssuer 引導設定 |

## 修改設定前必讀（連動規則）

本專案有**兩份**服務組態，修改任何一邊都要想到另一邊：

| 面向 | 檔案 | 用途 |
|------|------|------|
| 本地開發 | [`docker-compose.yml`](../docker-compose.yml) | `docker compose up` 一鍵起本地環境 |
| K8S 部署 | [`helm/wafer-bi/`](../helm/wafer-bi/)（templates + values） | ArgoCD 實際部署的內容 |

**新增／刪除／改名一個服務時，checklist：**

1. `services/<name>/` 建立服務與 Dockerfile
2. `docker-compose.yml` 加入服務（前端例外：本地用 `npm run dev`）
3. `helm/wafer-bi/templates/` 新增模板 + `values.yaml` 新增區塊
4. `.github/workflows/deploy.yml` 的 build matrix 與 tag bump 清單加入該服務
5. `scripts/check-config-sync.py` 的 `MAPPING` 登記對應關係

CI 會在每次 push / PR 跑 `scripts/check-config-sync.py`，五處對不起來就會直接紅燈提醒你。本地也可以隨時自己跑：

```bash
python scripts/check-config-sync.py
```
