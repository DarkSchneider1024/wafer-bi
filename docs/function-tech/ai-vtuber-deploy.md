# AI VTuber 部署手冊（OCI Always Free）

AI VTuber 的原始碼在 [`DarkSchneider1024/ai-vtuber`](https://github.com/DarkSchneider1024/ai-vtuber)，部署設定放在這個 repo，和 Wafer BI 共用同一條 GHCR + ArgoCD 鏈路。

## 1. 架構

```
[觀眾 A] [觀眾 B] [主播自己] ...
   │  POST /api/live/comment（送留言）
   │  GET  /api/live/stream （SSE，即時收留言／佇列／主播回覆）
   ▼
Cloudflare Edge ── Tunnel ──► ingress-nginx ──► ai-vtuber-svc:80 ──► Pod ai-vtuber:3000
                                                                      │
                                                         記憶體內的共享直播間（單一房間）
                                                         留言佇列 → Gemini → TTS → 廣播給所有人
```

- 所有觀眾連到同一個房間，留言由後端依序處理：一次只回覆一則，等主播講完（依字數估算）才處理下一則。
- SuperChat 會排到一般留言前面，但不會插到其他 SuperChat 前面。
- 狀態放在行程記憶體，所以 Deployment 固定 `replicas: 1`、`strategy: Recreate`。Pod 重啟後留言紀錄會清空。

### 發言限制

| 規則 | 預設 | Helm values |
|------|------|-------------|
| 上一則留言還沒被回覆前不能再發言 | 固定 | - |
| 同一位觀眾兩次發言最短間隔 | 20 秒 | `aiVtuber.live.cooldownSeconds` |
| 同一 IP 每分鐘最多留言數（防止清 localStorage 換身分） | 6 則 | `aiVtuber.live.ipLimitPerMin` |
| 佇列上限，滿了回 503 | 30 則 | `aiVtuber.live.maxQueue` |

觀眾身分是瀏覽器 localStorage 裡的隨機 ID（`ai_vtuber_live_viewer_id_v1`），不需要登入。

## 2. 部署流程（K8s + ArgoCD）

```
ai-vtuber push main
   → .github/workflows/deploy.yml 建置 linux/amd64 + linux/arm64 映像
   → ghcr.io/darkschneider1024/ai-vtuber:<sha>
   → 用 WAFER_BI_DEPLOY_TOKEN 回填本 repo helm/wafer-bi/values.yaml 的 aiVtuber.image.tag
   → ArgoCD 自動同步
```

相關檔案：

| 檔案 | 用途 |
|------|------|
| `helm/wafer-bi/templates/ai-vtuber.yaml` | Deployment / Service / Ingress |
| `helm/wafer-bi/values.yaml` 的 `aiVtuber:` 區塊 | 網域、image、發言限制、資源配置 |

Ingress 對 SSE 做了三個設定：`proxy-buffering: off`、`proxy-read-timeout: 3600`、`proxy-send-timeout: 3600`。程式端每 15 秒送一次心跳，避免 Cloudflare 約 100 秒的閒置斷線。

### 首次部署 checklist

1. ai-vtuber 第一次跑完 CI 後，到 GitHub `Packages → ai-vtuber → Package settings` 把 Visibility 改成 Public（同 `deployment-sop.md` 1.1，否則會 `ImagePullBackOff`）。
2. 在 ai-vtuber repo 設定 secret `WAFER_BI_DEPLOY_TOKEN`：fine-grained PAT，只授權 `wafer-bi` 的 `Contents: Read and write`。
3. `app-secrets` 裡要有 `GEMINI_API_KEY`（沒有也能啟動，會改用內建兜底回覆）。
4. Cloudflare Tunnel 新增一條 Published application route：Subdomain `vtuber`、Domain `carrot-atelier.online`、Service `HTTP` → `localhost:80`（與 Day 31 的 wafer 路由相同做法）。

確認指令：

```bash
kubectl get pods -n k8sdemo -l app=ai-vtuber
kubectl logs -n k8sdemo deploy/ai-vtuber
curl -N https://vtuber.carrot-atelier.online/api/live/stream   # 應該立刻收到 snapshot 事件
```

## 3. 替代方案：單台 A1 VM，不跑 K8s

A1 只有 1 OCPU / 6 GB 時，跑整套 K8s 會很吃緊。ai-vtuber repo 的 `deploy/oci-vm/` 提供 Docker Compose 版本（ai-vtuber + cloudflared）：

```bash
sudo apt-get update && sudo apt-get install -y docker.io docker-compose-v2
git clone https://github.com/DarkSchneider1024/ai-vtuber.git
cd ai-vtuber/deploy/oci-vm
cp .env.example .env    # 填 GEMINI_API_KEY 與 TUNNEL_TOKEN
sudo docker compose up -d
```

Cloudflare Tunnel 的 route Service 填 `http://ai-vtuber:3000`。容器只綁 `127.0.0.1:3000`，OCI 安全清單不需要開任何 port。

## 4. 已知限制

- 只能單一 replica。要水平擴展需要把佇列與廣播搬到 Redis（pub/sub + list）。
- 每位觀眾的瀏覽器各自向 `/api/tts` 取語音，伺服器端有 200 筆記憶體快取，同一句話只會合成一次。
- 瀏覽器自動播放政策：觀眾要先點過畫面任一處，才聽得到別人觸發的主播語音。

*Last updated: 2026-10-30*
