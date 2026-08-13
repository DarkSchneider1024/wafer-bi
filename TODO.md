# 📋 專案待辦事項與技術精進清單

## 🔴 安全性緊急事項
- [x] **撤銷已外洩的 OCI API Key**：commit `35e55dc`（2026-05-06）誤將私鑰檔案 `gueiwan1024@gmail.com-2026-05-05T18_42_52.071Z.pem` 推上 repo，該 commit 仍存在於 public 的 `origin/main` 歷史中。已比對外洩金鑰的公鑰指紋（`13:09:73:25:86:08:0c:4f:39:fe:d8:c2:b5:8f:13:3a`），確認就是 2026-05-05T18:44 建立、且仍為 ACTIVE 的那把 OCI API Key；同時確認本機 `~/.oci/oci_api_key.pem`（指紋 `12:80:...a1:71`，2026-06-03 建立）是另一把、CI/CD workflow 也沒有引用任何 OCI 憑證，確定不影響現有存取後，已於 2026-08-03 用 `oci iam user api-key delete` 撤銷該外洩金鑰
- [x] **git 歷史改寫完成（2026-08-13）**：用 `git filter-repo` 一次清掉三類敏感內容並 force push（`6bdc539` → `d4467a7`，312 個 commit 全部重寫）。已驗證：重新從 GitHub clone 下來查不到任何一筆命中
  - 面試筆記的三個歷史路徑——檔案保留在本機、已列入 `.gitignore`
  - 上面那條已撤銷的外洩 OCI 金鑰檔
  - **改寫過程中新發現的第三把 RSA 私鑰**（2048-bit，早期 commit 加入、後來刪除但仍留在歷史）。查證後確認它**沒有註冊在 OCI 帳號**（帳號目前只有一把 ACTIVE，即本機 `~/.oci/oci_api_key.pem`），repo 裡也沒有任何程式引用，研判是當初金鑰下載失敗時另外產生、最後沒用上的棄用金鑰，不需輪替憑證，但仍一併清除
  - *（各檔案的確切路徑與 commit 位置不寫在這裡——這份 TODO 是公開的，寫明等於幫還留著舊歷史的人指路。細節見本機備份。）*
- [ ] **殘留風險追蹤（force push 不等於內容消失）**
  - GitHub 會保留一段時間的無主 commit，知道舊 SHA 的人仍可能透過 URL 直接存取；要徹底清除需另外寫信請 GitHub Support 執行 GC
  - 任何在 2026-08-13 之前 fork 或 clone 過本 repo 的人，手上那份舊歷史不受影響
  - 文章截圖裡引用的舊 hash（`6bdc539`、`29cca35` 等，出現在 Day18/19/20/29 的五張圖與 `Day18.md` 內文一處）在新歷史中已不存在，屬預期內的副作用，不影響閱讀
- [ ] 檢視 `docs/function-tech/` 底下其他 13 個檔案是否也屬於不該公開的私人筆記（目前只排除了 interview-guide.md）
- [x] **種子帳號密碼移出原始碼（2026-08-13）**：`DataSeeder.java` 原本把 `admin` / `admin@carrot` 與 `demo01` / `demo01_password_123` 寫死在程式裡，而且 `demo01`（名為 Demo Sudo User）其實掛在 **admin 群組**。已改成從 `SEED_ADMIN_PASSWORD` / `SEED_DEMO_PASSWORD` 讀取，**沒設定就不建立帳號並記一筆 warn**；本地預設值放在 `docker-compose.yml`，Helm Chart 刻意不提供這兩個變數，正式環境不會自動長出可登入帳號。種子帳號的 email 也從真實網域改成 `@example.com`
- [x] **公開文件移除真實帳密（2026-08-13）**：`docs/function-tech/system-architecture.md` 原本用表格明文列出 `POSTGRES_PASSWORD` / `JWT_SECRET` 的預設值與兩組可用帳密。已確認那兩把「機密」的預設值**沒有真的在用**（叢集 Secret 是另一組），所以不需要輪替金鑰；文件改為只列變數名稱與來源。另外 `docs/function-tech/license-kms.md` 的 License 範例把 `customer_name` 寫成真實公司 TSMC，已改為虛構名稱
- [x] **前端一鍵登入改用低權限 demo 帳號（2026-08-13）**：`App.tsx` 原本寫死的是 `admin` / `admin@carrot`，已改成 `demo01` / `demo@carrot`。同時 `demo01` 從 admin 群組降到 `user` 群組（Liquibase changeset `004`），並補上三張分析選單讓它真的有東西可以看（changeset `005`）——降權後才發現 `user` 群組在 `001` 只被分配到 ai-assistant 一張選單。實測：新密碼登入成功、token 的 group 是 `user`、看不到用戶管理、舊密碼回 401
- [ ] **🔴 `admin` 的密碼仍寫死在 Liquibase `001-initial-schema.xml` 裡**：那串 BCrypt 雜湊經驗證就是 `admin@carrot`，只要跑過 `001` 的資料庫（含任何人 clone 下來自己建的）都有一個密碼已公開的管理員帳號。`DataSeeder` 那邊改成環境變數並不能解決，因為 Liquibase 先跑、帳號已存在，DataSeeder 就直接跳過
  - 不能直接改 `001`（既有資料庫的 checksum 會驗證失敗）
  - 可行做法：新增一個 changeset，把「密碼雜湊仍等於那組公開值」的 admin 停用或刪除，讓它只能由 `SEED_ADMIN_PASSWORD` 重建
  - **風險**：正式環境若沒設 `SEED_ADMIN_PASSWORD`，執行後會沒有任何管理員帳號可登入，等於把自己鎖在外面。要做之前先確認每個環境的 Secret 都備好
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
