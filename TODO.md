# 📋 專案待辦事項與技術精進清單

## 🔴 安全性緊急事項
- [x] **撤銷已外洩的 OCI API Key**：commit `35e55dc`（2026-05-06）誤將私鑰檔案 `gueiwan1024@gmail.com-2026-05-05T18_42_52.071Z.pem` 推上 repo，該 commit 仍存在於 public 的 `origin/main` 歷史中。已比對外洩金鑰的公鑰指紋（`13:09:73:25:86:08:0c:4f:39:fe:d8:c2:b5:8f:13:3a`），確認就是 2026-05-05T18:44 建立、且仍為 ACTIVE 的那把 OCI API Key；同時確認本機 `~/.oci/oci_api_key.pem`（指紋 `12:80:...a1:71`，2026-06-03 建立）是另一把、CI/CD workflow 也沒有引用任何 OCI 憑證，確定不影響現有存取後，已於 2026-08-03 用 `oci iam user api-key delete` 撤銷該外洩金鑰
- [ ] （選擇性、非替代方案，尚未執行）用 `git filter-repo` 改寫歷史並 force push，把該私鑰檔案徹底從 git 歷史清除——金鑰已撤銷所以不再是資安風險，純粹是清潔歷史紀錄；**注意 force push 會改變所有 commit hash**，Day 18/19 文章截圖裡引用了具體 commit hash（如 `48d794f`），改寫前要評估是否影響
- [x] **面試筆記從版控移除（第一層，2026-08-13）**：`docs/function-tech/interview-guide.md` 已 `git rm --cached` 並加入 `.gitignore`，檔案保留在本機；同時移除 `README.md` 的「🎤 面試與發展」區塊（那個連結本來就是壞的，指向不存在的 `docs/INTERVIEW_GUIDE.md`）與 `TODO.md` 標題裡的「面試準備」字樣
- [ ] **面試筆記清除 git 歷史（第二層，鐵人賽結束後再做）**：上面那步只擋住未來的 commit，**內容從 initial commit `b662c8e` 就在公開 repo 的歷史裡**（舊路徑 `INTERVIEW_GUIDE.md`，後來搬到 `docs/function-tech/`，commit `87a924c`），任何人現在都翻得到。要真正清掉必須 `git filter-repo` + force push
  - 敏感點：檔案裡指名了真實人物「邱宏瑋 (hwchiuk) 主管」並轉述其要求、明確寫出目標公司台積電 (TSMC) 與職缺、以及「面試說法」這類求職策略語言
  - **排程：等 30 天鐵人賽全部發完再執行**。理由是 force push 會改變所有 commit hash，而發文中的截圖引用了具體 hash（跟上面那條私鑰清除是同一個顧慮，建議兩件事一次做完）
  - 執行時順便確認：`docs/function-tech/` 底下其他 13 個檔案是否也屬於不該公開的私人筆記（目前只排除了 interview-guide.md）
- [ ] 評估 `services/frontend/src/App.tsx` 裡寫死的一鍵登入 admin 帳密（`admin@carrot`）是否要移除，公開後任何人都能用這組登入正式站台
- [x] **移除 API Gateway 的硬編碼 JWT 預設密鑰**（2026-08-08）：`services/api-gateway/src/index.js` 原本寫 `jwt.verify(token, process.env.JWT_SECRET || 'wafer_bi_platform_default_secret_key_32_bytes_long', ...)`，而這串預設值就在 public repo 裡——只要部署時漏掉 `JWT_SECRET`，Gateway 就會用一組公開的密鑰驗簽，任何人都能自簽 token 通過 `/api/users`，且服務照常啟動、健康檢查全綠。Java 端（`application.yml` 的 `${JWT_SECRET}`）本來就沒有預設值、少了會啟動失敗，Node 端現在對齊成同樣的 fail-fast，並加上 32 bytes 長度檢查（對齊 `Keys.hmacShaKeyFor()` 的 256 bit 下限）與 `algorithms: ['HS256','HS384','HS512']` 白名單（擋 `alg=none` 之類的演算法混淆）
  - [ ] **部署前置條件（因上一項而來的副作用）**：`JWT_SECRET` 現在是硬性需求，缺了會 exit 1 → Pod CrashLoopBackOff。Helm chart 只有 `envFrom: secretRef: app-secrets`（`helm/wafer-bi/templates/api-gateway.yaml`），但 chart **不負責建立** `app-secrets`，部署前務必確認每個環境的這個 Secret 裡都有 `JWT_SECRET`，且與 user-service 用的是同一組
  - [x] 已確認 `services/user-service/target/classes/application.yml` 這個舊編譯產物（裡面仍留著 `${JWT_SECRET:wafer_bi_platform_default_secret_key_32_bytes_long}` 的舊預設值）不會進到 image——Dockerfile 的 builder stage 只 `COPY pom.xml` 與 `src/`，`target/` 從未被複製，image 裡的是 build 階段用 `src/main/resources/application.yml`（無預設值）重新編譯的版本

## ✅ ArgoCD & GitOps 實作 (已完成於 OCI)
- [x] 在 OKE 建立 `argocd` 命名空間。
- [x] 安裝 ArgoCD 基礎資源 (使用 `--server-side` 解決 CRD 過大問題)。
- [x] 透過 `LoadBalancer` 曝露 ArgoCD Server 介面。
- [x] 取得 `argocd-initial-admin-secret` 密碼並登入 UI。
- [x] 將 GitHub 上的 `wafer-bi` 倉庫連接至 ArgoCD。
- [x] 設定自動同步策略 (Automated Sync Policy)，實現 GitOps 流程。
- [ ] **[進行中]** 導入 **Sealed Secrets**：加密 `system-config.properties` 以支持開源環境下的安全部署。

## 🟠 GitOps 鏈路健康度（2026-08-07 實測發現）

> 起因：為 Day 20 補「Rolling Update / Rollback」實測截圖時，順手盤點本機叢集，發現自動化鏈路早已斷開但無人察覺。詳細現場記錄在 `docs/鐵人賽/Day29.md` §8。

- [ ] **本機 docker-desktop 叢集與 Git 完全脫鉤**：`kubectl get applications -A` 回 `No resources found`（ArgoCD 的 Pod 全部健康，但手上沒有任何 Application），k8sdemo 的 4 個 Deployment 是 2026-07-20 手動 `kubectl apply` 起來的，跑的是本機 build 的 `wafer-api-gateway:ironman` / `wafer-user-service:ironman` / `wafer-bi-backend:ironman` / `postgres:16-alpine`，而 `helm/wafer-bi/values.yaml` 指向 `ghcr.io/darkschneider1024/*`；Git 最後一筆 deploy commit 是 8/04，叢集停在 7/20。**所有 Pod 都 Running，沒有任何監控會為這件事亮紅燈**
  - 要接回 GitOps 得 `kubectl apply -f k8s/argocd-app.yaml`，但要先評估兩件事：(1) 整份 chart 會一起同步下來（含 ollama / openbao / jaeger / otel-collector），本機資源吃不吃得下；(2) GHCR 私有 image 配的是 `ocirsecret`，本機多半拉不動
- [ ] **`argocd-applicationset-controller` 長期 CrashLoopBackOff**：2026-08-07 觀測到重啟 3990 次、已持續 93 天。目前沒用到 ApplicationSet 所以無感，但它一直在燒資源，要嘛修好要嘛關掉
- [ ] **OKE context `context-chtlr3vnqoq` 已無法連線**：`kubectl get nodes` 直接逾時掛住。確認該叢集是否已刪除／停用，是的話把 kubeconfig 裡的死 context 清掉，避免每次操作都先卡兩分鐘（本機請用 `kubectl config use-context docker-desktop`）
- [ ] **把「自動化還活著嗎」變成固定檢查**：`scripts/check-config-sync.py` 守的是「CI 改的檔案 = ArgoCD 看的檔案」，但守不住「ArgoCD 根本沒在跑」。建議補四道對帳（Day 29 §8 有完整指令）：控制迴路是否存在、Git 與叢集的 image 是否一致、最後部署時間是否合理、資源上有沒有被自動化管過的指紋
- [ ] **Chart 裡的 `deployed-at: {{ now }}` 是把雙面刃**：5 個模板（ai-mcp-service / api-gateway / user-service / wafer-backend / wafer-frontend）都有這行 Pod annotation。好處是強制重新部署，壞處是每次渲染結果都不同 → ArgoCD 永遠 OutOfSync、`kubectl rollout history` 被灌滿無意義的 revision。要保留就接受噪音，要乾淨就改用 image tag 驅動

## 🧪 技術深度補強
- [ ] **IaC 導入**：將 OCI 資源（VCN, OKE）改用 Terraform 腳本定義。
- [x] **Helm 化**：將 `k8s/` 目錄下的 YAML 檔案封裝成 Helm Chart，支援多環境配置。
- [ ] **可觀測性升級**：在 K8S 中佈署 Prometheus + Grafana 監控指標。
- [x] **灰度發布**：評估導入 Argo Rollouts 以支援 Canary 部署。已在叢集實測跑完一次完整金絲雀發布（4 replica，`setWeight` 25% → pause 等人工 promote → 50% → 100%，舊 revision ScaledDown，全程零中斷），紀錄見 `docs/鐵人賽/Day20.md`。`rollouts.argoproj.io` CRD 仍留在叢集（2026-07-20 安裝），demo 資源已清除
  - [ ] 後續：正式服務目前仍是一般 Deployment，尚未改用 `Rollout` 資源；要落地還缺 AnalysisTemplate（接 Prometheus 自動判斷 promote／abort）

## 🎨 UI/UX 優化
- [x] 修正晶圓小圖「披薩半圓」比例失真問題。
- [x] 導入側邊欄篩選與設置選單，優化操作流程。
- [x] 圖表新增 Download 下載功能與數據視圖。
- [x] 統計分析圖表新增動態標題與 DataZoom 縮放功能。

---
*註：ArgoCD 現已正式接管 OCI 部署流程，本地 WSL2 實驗暫告一段落。*

*註（2026-08-07 更新）：上面這句話目前只對「當初的 OKE」成立——該 context 已連不上，而本機 docker-desktop 叢集實測是手動部署狀態，ArgoCD 沒有接管任何東西。詳見上方「GitOps 鏈路健康度」。*
