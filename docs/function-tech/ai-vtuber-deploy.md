# AI VTuber 部署手冊（OCI Always Free A1 VM）

AI VTuber 的原始碼在 [`DarkSchneider1024/ai-vtuber`](https://github.com/DarkSchneider1024/ai-vtuber)。正式環境是一台 OCI Always Free 的 Ampere A1 VM（Ubuntu 24.04 arm64，即 `scripts/oci-grab-a1.sh` 開出來的機器），用 Docker Compose 跑 ai-vtuber 與 cloudflared。

網址：`https://vtuber.carrot-atelier.online`

## 1. 架構

```
[觀眾 A] [觀眾 B] [主播自己] ...
   │  POST /api/live/comment（送留言）
   │  GET  /api/live/stream （SSE，即時收留言／佇列／主播回覆）
   ▼
Cloudflare Edge (vtuber.carrot-atelier.online)
   │  Cloudflare Tunnel（VM 主動往外連，不用開 port）
   ▼
OCI A1 VM ── docker compose
   ├─ cloudflared ──► http://ai-vtuber:3000
   └─ ai-vtuber（Next.js）
        記憶體內的共享直播間：留言佇列 → Gemini → TTS → 廣播給所有人
```

- 所有觀眾連到同一個房間，留言由後端依序處理：一次只回覆一則，等主播講完（依字數估算）才處理下一則。
- SuperChat 會排到一般留言前面，但不會插到其他 SuperChat 前面。
- 狀態放在行程記憶體，容器重啟後留言紀錄會清空。

### 發言限制

| 規則 | 預設 | `.env` 變數 |
|------|------|-------------|
| 上一則留言還沒被回覆前不能再發言 | 固定 | - |
| 同一位觀眾兩次發言最短間隔 | 20 秒 | `LIVE_COOLDOWN_SECONDS` |
| 同一 IP 每分鐘最多留言數（防止清 localStorage 換身分） | 6 則 | `LIVE_IP_LIMIT_PER_MIN` |
| 佇列上限，滿了回 503 | 30 則 | `LIVE_MAX_QUEUE` |

觀眾身分是瀏覽器 localStorage 裡的隨機 ID（`ai_vtuber_live_viewer_id_v1`），不需要登入。

## 2. 更新流程

```
ai-vtuber push main
   → .github/workflows/deploy.yml 建置 linux/amd64 + linux/arm64 映像
   → ghcr.io/darkschneider1024/ai-vtuber:latest（與 :<sha>）
   → VM 上的 ai-vtuber-update.timer 每 5 分鐘執行 deploy/oci-vm/update.sh
     （docker compose pull → 有新版才重建容器）
```

VM 不需要 GitHub 憑證，也不用對外開 SSH 給 CI。

## 3. 首次部署

### 3.1 GitHub

1. ai-vtuber 的 PR 合併進 `main`，等 Actions 的「CI - Build AI VTuber Image」跑完（約 8 分鐘）。arm64 不經 QEMU 模擬，做法見 ai-vtuber 的 `Dockerfile` 開頭說明。
2. 到 GitHub 個人頁面 `Packages → ai-vtuber → Package settings`，把 Visibility 改成 Public（同 `deployment-sop.md` 1.1，否則 VM 拉不到 image）。

### 3.2 VM

```bash
ssh ubuntu@<VM 公網 IP>
git clone https://github.com/DarkSchneider1024/ai-vtuber.git
cd ai-vtuber/deploy/oci-vm
bash setup.sh
```

`setup.sh` 會依序：

1. 安裝 Docker
2. 詢問 `GEMINI_API_KEY`（直接 Enter 可跳過，主播會改用內建的固定回覆）
3. 印出 `https://dash.cloudflare.com/argotunnel?...` 授權連結。用瀏覽器打開，選 `carrot-atelier.online`，按 Authorize
4. 自動執行 `cloudflared tunnel create ai-vtuber`、`cloudflared tunnel route dns`，在 Cloudflare 建立 `vtuber` 的 CNAME，並產生 `cloudflared/config.yml`
5. 安裝自動更新 timer，啟動服務

不需要到 Cloudflare 後台手動建立 Tunnel 或新增 Published application route。Tunnel 是 locally-managed，路由寫在 VM 上的 `deploy/oci-vm/cloudflared/config.yml`；這個目錄有 Cloudflare 登入憑證，已列入 `.gitignore`。

`carrot-atelier.online` 的 Nameserver 在 Namecheap 設成 Cloudflare（`bart` / `treasure.ns.cloudflare.com`），所以 DNS 記錄要在 Cloudflare 管理，在 Namecheap 的 Advanced DNS 新增記錄不會生效。

### 3.3 驗證

```bash
sudo docker compose ps                       # 兩個容器都是 running
sudo docker compose logs -f ai-vtuber
systemctl list-timers ai-vtuber-update.timer # 下次自動更新時間
curl -N https://vtuber.carrot-atelier.online/api/live/stream   # 應該立刻收到 snapshot 事件
```

Cloudflare Zero Trust → Networks → Tunnels 裡的 `ai-vtuber` 狀態應為 HEALTHY。

## 4. 維運

| 情境 | 指令（在 `deploy/oci-vm/` 下） |
|------|------|
| 立即更新到最新版 | `sudo bash update.sh` |
| 改發言限制 | 編輯 `.env` 後 `sudo docker compose up -d` |
| 換網域 | 改 `.env` 的 `LIVE_HOSTNAME` 後重跑 `bash setup.sh` |
| 回滾到某個版本 | `docker-compose.yml` 的 image 改成 `:<commit sha>`，先停掉 timer：`sudo systemctl stop ai-vtuber-update.timer` |
| 看資源用量 | `sudo docker stats` |

## 5. 已知限制

- 只能跑一個 ai-vtuber 容器。要多台需要把佇列與廣播搬到 Redis（pub/sub + list）。
- 每位觀眾的瀏覽器各自向 `/api/tts` 取語音，伺服器端有 200 筆記憶體快取，同一句話只會合成一次。
- 瀏覽器自動播放政策：觀眾要先點過畫面任一處，才聽得到別人觸發的主播語音。

## 6. 之後要搬進 K8s

`helm/wafer-bi/templates/ai-vtuber.yaml` 已經寫好（單一 replica、Recreate、Ingress 關閉 buffering 支援 SSE），目前 `values.yaml` 裡 `aiVtuber.enabled: false`。搬遷時改成 `true`，並停掉 VM 上的容器，避免兩邊各跑一個直播間。

*Last updated: 2026-10-30*
