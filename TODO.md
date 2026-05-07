# 📋 專案待辦事項與技術精進清單

## ✅ ArgoCD & GitOps 實作 (已完成於 OCI)
- [x] 在 OKE 建立 `argocd` 命名空間。
- [x] 安裝 ArgoCD 基礎資源 (使用 `--server-side` 解決 CRD 過大問題)。
- [x] 透過 `LoadBalancer` 曝露 ArgoCD Server 介面。
- [x] 取得 `argocd-initial-admin-secret` 密碼並登入 UI。
- [x] 將 GitHub 上的 `wafer-bi` 倉庫連接至 ArgoCD。
- [x] 設定自動同步策略 (Automated Sync Policy)，實現 GitOps 流程。
- [ ] **[進行中]** 導入 **Sealed Secrets**：加密 `system-config.properties` 以支持開源環境下的安全部署。

## 🧪 技術深度補強 (面試準備)
- [ ] **IaC 導入**：將 OCI 資源（VCN, OKE）改用 Terraform 腳本定義。
- [ ] **Helm 化**：將 `k8s/` 目錄下的 YAML 檔案封裝成 Helm Chart，支援多環境配置。
- [ ] **可觀測性升級**：在 K8S 中佈署 Prometheus + Grafana 監控指標。
- [ ] **灰度發布**：評估導入 Argo Rollouts 以支援 Canary 部署。

## 🎨 UI/UX 優化
- [x] 修正晶圓小圖「披薩半圓」比例失真問題。
- [x] 導入側邊欄篩選與設置選單，優化操作流程。
- [x] 圖表新增 Download 下載功能與數據視圖。
- [x] 統計分析圖表新增動態標題與 DataZoom 縮放功能。

---
*註：ArgoCD 現已正式接管 OCI 部署流程，本地 WSL2 實驗暫告一段落。*
