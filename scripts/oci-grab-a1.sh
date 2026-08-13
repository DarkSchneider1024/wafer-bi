#!/usr/bin/env bash
# ============================================================================
# oci-grab-a1.sh —— 背景重試搶 OCI Always Free 的 Ampere A1 實例
# ----------------------------------------------------------------------------
# 背景：A1 的額度一直都在（standard-a1-core-count = 2），缺的是實體容量，
#       建立時會拿到 "Out of host capacity"。這支腳本輪流換 Fault Domain
#       慢速重試，搶到就停。
#
# 用法：
#   bash scripts/oci-grab-a1.sh                  # 先看計畫，要你確認才會開始
#   bash scripts/oci-grab-a1.sh --yes            # 直接開跑（背景執行用）
#   bash scripts/oci-grab-a1.sh --dry-run        # 只印出要送的指令，不建立任何東西
#   OCPUS=2 MEM=12 bash scripts/oci-grab-a1.sh   # 改規格（預設 1 OCPU / 6GB）
#
# 建議背景執行：
#   nohup bash scripts/oci-grab-a1.sh --yes > /dev/null 2>&1 &
#   tail -f scripts/a1-grab.log
# ============================================================================
set -uo pipefail

# OCI CLI 每次呼叫都會對 ~/.oci 的檔案權限碎念，長時間重試時 log 會被洗版
export OCI_CLI_SUPPRESS_FILE_PERMISSIONS_WARNING=True

# ---- 可調參數 --------------------------------------------------------------
OCPUS="${OCPUS:-1}"              # 1 OCPU / 6GB 命中率明顯高於 2/12
MEM="${MEM:-6}"
NAME="${NAME:-wafer-bi-a1}"
INTERVAL_MIN="${INTERVAL_MIN:-300}"   # 每次重試間隔下限（秒）
INTERVAL_MAX="${INTERVAL_MAX:-600}"   # 上限，實際取區間亂數，避免固定節奏
MAX_ATTEMPTS="${MAX_ATTEMPTS:-0}"     # 0 = 無限
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519.pub}"
LOG="${LOG:-$(dirname "$0")/a1-grab.log}"

DRY_RUN=false
ASSUME_YES=false
for a in "$@"; do
  case "$a" in
    --dry-run) DRY_RUN=true ;;
    --yes|-y)  ASSUME_YES=true ;;
    *) echo "未知參數：$a"; exit 2 ;;
  esac
done

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"; }

# ---- 探測環境 --------------------------------------------------------------
command -v oci >/dev/null || { echo "找不到 oci CLI"; exit 1; }
[ -f "$SSH_KEY" ] || { echo "找不到 SSH 公鑰：$SSH_KEY（用 SSH_KEY=... 指定）"; exit 1; }

TENANCY="$(grep -i '^tenancy' ~/.oci/config | head -1 | cut -d= -f2 | tr -d ' \r')"
[ -n "$TENANCY" ] || { echo "從 ~/.oci/config 讀不到 tenancy"; exit 1; }

echo "正在探測 AD / subnet / image ..."
AD="${AD:-$(oci iam availability-domain list -c "$TENANCY" --query 'data[0].name' --raw-output 2>/dev/null)}"

# 沿用現有 K3s 實例所在的 subnet
# 注意：這裡刻意不用 xargs——xargs 會吃掉 JMESPath 裡的雙引號，
#       '"subnet-id"' 會變成無效的 subnet-id（減號需要引號包住）
if [ -z "${SUBNET:-}" ]; then
  _inst="$(oci compute instance list -c "$TENANCY" --lifecycle-state RUNNING \
           --query 'data[0].id' --raw-output 2>/dev/null)"
  if [ -n "$_inst" ]; then
    SUBNET="$(oci compute instance list-vnics --instance-id "$_inst" \
              --query 'data[0]."subnet-id"' --raw-output 2>/dev/null)"
  fi
fi

# 每次啟動時重新查最新的 Ubuntu ARM image（image OCID 會隨官方更新而變）
IMAGE="${IMAGE:-$(oci compute image list -c "$TENANCY" \
  --operating-system 'Canonical Ubuntu' --operating-system-version '24.04' \
  --shape 'VM.Standard.A1.Flex' --sort-by TIMECREATED \
  --query 'data[0].id' --raw-output 2>/dev/null)}"

for v in AD SUBNET IMAGE; do
  [ -n "${!v}" ] || { echo "探測不到 $v，請用環境變數指定"; exit 1; }
done

FDS=(FAULT-DOMAIN-1 FAULT-DOMAIN-2 FAULT-DOMAIN-3)

cat <<EOF

────────────── 這支腳本會做的事 ──────────────
  規格      : VM.Standard.A1.Flex  ${OCPUS} OCPU / ${MEM} GB
  名稱      : ${NAME}
  區域/AD   : ${AD}
  Subnet    : ${SUBNET:0:60}...
  Image     : ${IMAGE:0:60}...
  SSH 公鑰  : ${SSH_KEY}
  重試間隔  : ${INTERVAL_MIN}~${INTERVAL_MAX} 秒，輪流換 FD-1/2/3
  上限次數  : $([ "$MAX_ATTEMPTS" = 0 ] && echo "無限（搶到才停）" || echo "$MAX_ATTEMPTS")
  Log       : ${LOG}

  ⚠ 搶到後會在你的 OCI 帳號建立一台實例。A1 在 Always Free 額度內不收費，
    但請自行確認帳號狀態與額度（standard-a1-core-count）。
──────────────────────────────────────────────

EOF

if $DRY_RUN; then
  echo "[dry-run] 會送出的指令："
  echo "oci compute instance launch -c $TENANCY --availability-domain $AD \\"
  echo "  --fault-domain ${FDS[0]} --shape VM.Standard.A1.Flex \\"
  echo "  --shape-config '{\"ocpus\":$OCPUS,\"memoryInGBs\":$MEM}' \\"
  echo "  --image-id $IMAGE --subnet-id $SUBNET --assign-public-ip true \\"
  echo "  --display-name $NAME --ssh-authorized-keys-file $SSH_KEY"
  exit 0
fi

if ! $ASSUME_YES; then
  read -r -p "確認開始重試？(yes/N) " ans
  [ "$ans" = "yes" ] || { echo "已取消"; exit 0; }
fi

# ---- 主迴圈 ----------------------------------------------------------------
log "=== 開始重試：${OCPUS} OCPU / ${MEM} GB，名稱 ${NAME} ==="
attempt=0
while :; do
  attempt=$((attempt + 1))
  [ "$MAX_ATTEMPTS" != 0 ] && [ "$attempt" -gt "$MAX_ATTEMPTS" ] && {
    log "已達重試上限 ${MAX_ATTEMPTS} 次，結束"; exit 3; }

  # 防呆：如果同名實例已經存在（可能上一輪其實成功了只是回應逾時），就停手
  existing="$(oci compute instance list -c "$TENANCY" --display-name "$NAME" \
    --query 'data[?"lifecycle-state"!=`TERMINATED`].id' --raw-output 2>/dev/null | grep -c ocid || true)"
  if [ "${existing:-0}" -gt 0 ]; then
    log "偵測到同名實例已存在，停止重試（避免重複建立）"; exit 0
  fi

  fd="${FDS[$(( (attempt - 1) % 3 ))]}"
  out="$(oci compute instance launch \
      -c "$TENANCY" \
      --availability-domain "$AD" \
      --fault-domain "$fd" \
      --shape VM.Standard.A1.Flex \
      --shape-config "{\"ocpus\":$OCPUS,\"memoryInGBs\":$MEM}" \
      --image-id "$IMAGE" \
      --subnet-id "$SUBNET" \
      --assign-public-ip true \
      --display-name "$NAME" \
      --ssh-authorized-keys-file "$SSH_KEY" 2>&1)"
  rc=$?

  if [ $rc -eq 0 ]; then
    ocid="$(echo "$out" | grep -o 'ocid1\.instance\.[a-z0-9.]*' | head -1)"
    log "🎉 搶到了！第 ${attempt} 次嘗試，FD=${fd}"
    log "   instance: ${ocid}"
    log "   等待進入 RUNNING 並取得 public IP ..."
    for _ in $(seq 1 30); do
      sleep 10
      ip="$(oci compute instance list-vnics --instance-id "$ocid" \
            --query 'data[0]."public-ip"' --raw-output 2>/dev/null)"
      [ -n "$ip" ] && [ "$ip" != "null" ] && { log "   public IP: ${ip}"; break; }
    done
    log "=== 完成，腳本結束 ==="
    exit 0
  fi

  # 分類錯誤：不是每種都值得重試
  if echo "$out" | grep -qi "Out of host capacity"; then
    reason="Out of host capacity（沒容量，繼續等）"
  elif echo "$out" | grep -qiE "LimitExceeded|QuotaExceeded"; then
    log "❌ 額度不足（LimitExceeded/QuotaExceeded）——重試沒有意義，停止"
    log "$out" ; exit 4
  elif echo "$out" | grep -qiE "NotAuthenticated|NotAuthorized|Forbidden"; then
    log "❌ 認證或權限問題——停止"
    log "$out" ; exit 5
  else
    reason="其他錯誤（見 log）"
    echo "$out" >> "$LOG"
  fi

  wait_s=$(( INTERVAL_MIN + RANDOM % (INTERVAL_MAX - INTERVAL_MIN + 1) ))
  log "第 ${attempt} 次失敗（FD=${fd}）：${reason}；${wait_s} 秒後再試"
  sleep "$wait_s"
done
