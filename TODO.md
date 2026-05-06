# 📋 專案待辦事項與技術精進清單

## 🏗️ ArgoCD & GitOps 實作 (目前暫停)
- [x] 在本地 K8S (Docker Desktop) 建立 `argocd` 命名空間。
- [x] 安裝 ArgoCD 基礎資源。
- [ ] **[下一步]** 調整 `.wslconfig` 以增加 WSL2 記憶體至 6GB+，解決 Pod 崩潰問題。
- [ ] 取得 `argocd-initial-admin-secret` 密碼並登入 `localhost:8080`。
- [ ] 將 GitHub 上的 `wafer-bi` 倉庫連接至 ArgoCD。
- [ ] 設定本地同步策略，達成「地端自動追隨雲端代碼」的效果。

## 🧪 台積電 (TSMC) 面試專項補強
- [ ] **IaC 導入**：將 OCI 資源（VCN, OKE）改用 Terraform 腳本定義。
- [ ] **Helm 化**：將 `k8s/` 目錄下的 YAML 檔案封裝成 Helm Chart，支援多環境配置。
- [ ] **可觀測性升級**：在 K8S 中佈署 Prometheus + Grafana 監控指標。
- [ ] **情境演練**：針對「跨架構 (amd64/arm64) 部署失敗」撰寫詳細的事後檢討 (Postmortem)。

## 🎨 UI/UX 優化
- [x] 修正晶圓小圖比例失真 (aspect-ratio)。
- [ ] **Dark Mode 深度調整**：針對圖表顏色進行更細緻的工業風配色調整。

---
*註：ArgoCD 相關進度停留在 Pod 啟動階段，待記憶體資源調整後即可恢復。*
