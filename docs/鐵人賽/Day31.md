# Day 31: 番外篇：不用公網 IP，透過 Cloudflare Tunnel 將本地 K8S 發布到外網

*把留在本機的整套微服務，安全穿透到公網展示。*

### 1. 為什麼需要本地外網穿透

在 Day 9 與 Day 30 討論過，雲端託管 K8S 往往有免費額度耗盡或規格不足的限制，因此整個系列的大部分實作選擇在開發機的 Docker Desktop K8S 上運行。

本機運行雖然省下雲端成本，但遇到以下情境就會遇到瓶頸：
- 想把成果展示給他人看，無法直接給出 `localhost` 連結。
- 想在手機或其他外網裝置上測試前端介面與 API 響應。
- 需要測試完整的 HTTPS 流程與外部 Webhook。

傳統做法是在家用路由器設定 Port Forwarding、申請 DDNS、手動設定防火牆並處理 Let's Encrypt 憑證。這不僅繁瑣，還會將家中的對外 IP 與通訊埠暴露在網際網路上。

Cloudflare Tunnel（Zero Trust）提供不同的架構思維：由本地主動向 Cloudflare Edge 建立出站加密通道（Outbound Tunnel），外部訪客訪問 Cloudflare CDN，流量經由通道轉發進本機。這種架構不需要公網 IP，也不需要在路由器開放任何連接埠。

### 2. 流量架構與鏈路

整套穿透的流量流轉路徑如下：

```text
[訪客瀏覽器]
       │
       ▼ (HTTPS: wafer.carrot-atelier.online)
[Cloudflare Edge CDN] (處理 SSL 終結與 DDoS 防護)
       │
       │ (Cloudflare Tunnel 加密通道)
       ▼
[Windows 本機 cloudflared 服務]
       │
       ▼ (HTTP: localhost:80)
[Ingress Controller (ingress-nginx)]
       │
       ├─► / ─────► wafer-frontend-svc:80 (React 前端)
       └─► /api/* ─► api-gateway-service:8080 (API Gateway)
                        └──► wafer-backend-svc:8000 (FastAPI 後端)
```

### 3. 部署實作步驟

#### 步驟 1：安裝本地 Ingress Controller

要讓本機的 `cloudflared` 能夠將流量分流給多個微服務，最乾淨的方式是讓 K8S 的 Ingress Controller 監聽本機的 80 Port。

```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update
helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx --create-namespace
```

在 Docker Desktop 上，`ingress-nginx-controller` 服務為 `LoadBalancer` 類型，會自動把容器內的 80/443 映射至 Windows 的 `localhost:80` 與 `localhost:443`。

#### 步驟 2：在 Cloudflare Zero Trust 建立 Tunnel

1. 登入 Cloudflare Dashboard，進入 **Zero Trust** -> **Networks** -> **Tunnels**。
2. 點擊 **Create a Tunnel**，選擇 **Cloudflared**，命名為 `wafer-bi`。
3. 取得安裝指令中的 Token（一長串英數字符號的 Token 字串）。
4. 以系統管理員身分開啟 PowerShell，將 `cloudflared` 安裝為 Windows 常駐服務：

```powershell
cloudflared.exe service install <YOUR_TUNNEL_TOKEN>
```

安裝完成後，Windows 會自動啟動該服務，Cloudflare 後台的 Tunnel 狀態會轉為綠色的 **HEALTHY**。

#### 步驟 3：設定網域託管與路由發布

在 Cloudflare Tunnel 的 **Published application routes** 標籤頁新增路由：
- **Subdomain**：`wafer`
- **Domain**：`carrot-atelier.online`（網域已將 Nameservers 指向 Cloudflare）
- **Path**：留空
- **Service Type**：`HTTP`
- **URL**：`localhost:80`

儲存後，Cloudflare 會自動建立 CNAME 記錄，將 `wafer.carrot-atelier.online` 的訪問請求透過 Tunnel 導向本機的 80 連接埠。

### 4. 實戰踩坑與排查記錄

這次串接過程不是貼上指令就結束，中途踩到了三個問題，依序排查並修正。

#### 坑一：缺少 CRD 導致 Helm 安裝被拒

專案原本的 `helm/wafer-bi/templates/cluster-issuer.yaml` 定義了 `cert-manager.io/v1` 的 `ClusterIssuer` 資源。

在 OKE 雲端環境上有安裝 cert-manager，但在本地開發用叢集並沒有安裝。執行 `helm upgrade` 時，Kubernetes API Server 直接報錯拒絕安裝：

```text
Error: unable to continue with install: no matches for kind "ClusterIssuer" in version "cert-manager.io/v1"
```

**解法**：
修改 `cluster-issuer.yaml`，利用 Helm 的內建能力偵測叢集是否支援該 API 版本，只有在具備該 CRD 時才渲染：

```yaml
{{- if and .Values.ingress.enabled (.Capabilities.APIVersions.Has "cert-manager.io/v1") }}
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
...
{{- end }}
```

這樣同一份 Helm Chart 就能兼顧本地純 Ingress 環境與雲端 cert-manager 環境。

#### 坑二：SSL 重定向造成的無窮迴圈 (308 Permanent Redirect)

安裝完 Ingress 並打通網址後，在瀏覽器打開網頁卻顯示連線錯誤。用 `curl` 檢視發現回傳了 308 重定向：

```bash
curl.exe -s -H "Host: wafer.carrot-atelier.online" http://localhost:80
# 回傳：<title>308 Permanent Redirect</title>
```

**原因**：
`templates/ingress.yaml` 原本設定了 `nginx.ingress.kubernetes.io/ssl-redirect: "true"`。
Cloudflare 在邊緣已經完成了 SSL 終結（訪客連 Cloudflare 是 HTTPS），但 Cloudflare Tunnel 連入本機時走的是一般 HTTP（`localhost:80`）。
本地的 Ingress-nginx 預設不信任未經設定的反向代理標頭，以為訪客使用的是不安全的 HTTP，於是回傳 308 要求轉跳至 HTTPS，造成重定向迴圈。

**解法**：
1. 修改 Ingress-nginx Controller 的 ConfigMap，開啟轉發標頭信任：
   ```bash
   kubectl patch configmap ingress-nginx-controller -n ingress-nginx \
     --type merge -p '{"data":{"use-forwarded-headers":"true"}}'
   ```
2. 將本地 Ingress 的 `ssl-redirect` 設為 `"false"`，由 Cloudflare 邊緣節點統一負責 HTTPS 加密：
   ```bash
   kubectl patch ingress wafer-bi-ingress -n k8sdemo \
     --type merge -p '{"metadata":{"annotations":{"nginx.ingress.kubernetes.io/ssl-redirect":"false"}}}'
   ```

#### 坑三：數據報表查無資料，後端容器被 OOMKilled

成功開啟網頁並登入系統後，切換到「數據報表」分頁，畫面卻顯示「查無資料，總計: 0」。

直覺可能以為是 API 路由沒接通或資料庫連線失敗。但檢查 API Gateway 日誌時，發現了異常：

```text
[Proxy BI] -> http://wafer-backend-svc.k8sdemo.svc.cluster.local:8000/report?...
[HPM] Error occurred while proxying request ... [ECONNRESET]
GET /api/report?... HTTP/1.1 504
```

API Gateway 回傳 504，代表後端在處理過程中斷開了連線。接著檢查後端 Pod 狀態：

```bash
kubectl describe pod -l app=wafer-backend -n k8sdemo
```

輸出中出現了關鍵線索：

```text
Last State:     Terminated
  Reason:       OOMKilled
  Exit Code:    137
Limits:
  memory:  512Mi
```

**原因**：
當使用者進入數據報表頁面，後端 FastAPI 會讀取 Delta Table 載入該批次（約 28,000 筆測試點），並在 Pandas 中進行全量排序與分頁切片。
原本在 Helm `values.yaml` 中配置給 `waferBackend` 的記憶體上限只有 `512Mi`。在做 DataFrame 拷貝與排序時瞬間超出 512MB，直接觸發 Kubernetes 的 OOMKilled（Exit Code 137）將容器強制終止。容器重啟導致 Gateway 逾時，前端捕捉到錯誤後將清單重設為空，才顯示查無資料。

**解法**：
將 `helm/wafer-bi/values.yaml` 中 `waferBackend` 的記憶體限制從 `512Mi` 提高至 `1Gi`（CPU 上限調升至 `1000m`），並執行滾動更新：

```yaml
waferBackend:
  resources:
    requests:
      cpu: 100m
      memory: 256Mi
    limits:
      cpu: 1000m
      memory: 1Gi
```

更新完成後重新發送請求，API 在 1 秒內回傳 28,000 筆數據的前 100 筆切片，前端數據報表正常渲染出完整清單。

### 5. 小結

透過 Cloudflare Tunnel 搭配本地 Kubernetes 的 Ingress Controller，不必依賴雲端主機的高昂費用或公網 IP，就能將整套異構微服務安全地發布到外網。

更重要的是，經過這輪穿透測試，排查出了 Ingress 反向代理標頭的信任問題，以及大數據查詢在生產規格下的記憶體瓶頸。這些在本地單機測試時容易被忽略的細節，在對外發布的過程中都得到了驗證與修正。
