#!/usr/bin/env bash
# ============================================================================
# a1-grab-cloud.sh —— 在 OCI 實例上 24 小時重試搶 Ampere A1
# ----------------------------------------------------------------------------
# 跟本機版的差別：用 Instance Principal 認證，機器上不存放任何 API 私鑰。
# 由 systemd 管理，開機自動啟動、失敗自動重啟。
# ============================================================================
set -uo pipefail
export PATH="$PATH:$HOME/bin"
AUTH="--auth instance_principal"

OCPUS="${OCPUS:-1}"
MEM="${MEM:-6}"
NAME="${NAME:-wafer-bi-a1}"
INTERVAL_MIN="${INTERVAL_MIN:-300}"
INTERVAL_MAX="${INTERVAL_MAX:-600}"
LOG="${LOG:-$HOME/a1-grab.log}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"; }

# 這台機器自己所在的 compartment，就是要開 A1 的地方
TENANCY="$(curl -s -H 'Authorization: Bearer Oracle' \
  http://169.254.169.254/opc/v2/instance/compartmentId)"
[ -n "$TENANCY" ] || { log "拿不到 compartment id，退出"; exit 1; }

AD="$(oci iam availability-domain list $AUTH -c "$TENANCY" \
      --query 'data[0].name' --raw-output 2>/dev/null)"
SELF_ID="$(curl -s -H 'Authorization: Bearer Oracle' \
  http://169.254.169.254/opc/v2/instance/id)"
SUBNET="$(oci compute instance list-vnics $AUTH --instance-id "$SELF_ID" \
          --query 'data[0]."subnet-id"' --raw-output 2>/dev/null)"
IMAGE="$(oci compute image list $AUTH -c "$TENANCY" \
          --operating-system 'Canonical Ubuntu' --operating-system-version '24.04' \
          --shape 'VM.Standard.A1.Flex' --sort-by TIMECREATED \
          --query 'data[0].id' --raw-output 2>/dev/null)"
SSH_KEY="$HOME/.ssh/authorized_keys"   # 沿用這台已經授權的公鑰

for v in TENANCY AD SUBNET IMAGE; do
  [ -n "${!v}" ] || { log "探測不到 $v，退出"; exit 1; }
done

log "=== 開始重試：${OCPUS} OCPU / ${MEM} GB，名稱 ${NAME}（Instance Principal）==="
FDS=(FAULT-DOMAIN-1 FAULT-DOMAIN-2 FAULT-DOMAIN-3)
attempt=0

while :; do
  attempt=$((attempt + 1))

  # 防呆：同名實例已存在就停手（可能上一輪其實成功了只是回應逾時）
  existing="$(oci compute instance list $AUTH -c "$TENANCY" --display-name "$NAME" \
    --query 'data[?"lifecycle-state"!=`TERMINATED`].id' --raw-output 2>/dev/null \
    | grep -c ocid1 || true)"
  if [ "${existing:-0}" -gt 0 ]; then
    log "偵測到同名實例已存在，停止重試"; exit 0
  fi

  fd="${FDS[$(( (attempt - 1) % 3 ))]}"
  out="$(oci compute instance launch $AUTH \
      -c "$TENANCY" --availability-domain "$AD" --fault-domain "$fd" \
      --shape VM.Standard.A1.Flex \
      --shape-config "{\"ocpus\":$OCPUS,\"memoryInGBs\":$MEM}" \
      --image-id "$IMAGE" --subnet-id "$SUBNET" --assign-public-ip true \
      --display-name "$NAME" --ssh-authorized-keys-file "$SSH_KEY" 2>&1)"

  if [ $? -eq 0 ]; then
    ocid="$(echo "$out" | grep -o 'ocid1\.instance\.[a-z0-9.]*' | head -1)"
    log "🎉 搶到了！第 ${attempt} 次，FD=${fd}"
    log "   instance: ${ocid}"
    for _ in $(seq 1 30); do
      sleep 10
      ip="$(oci compute instance list-vnics $AUTH --instance-id "$ocid" \
            --query 'data[0]."public-ip"' --raw-output 2>/dev/null)"
      [ -n "$ip" ] && [ "$ip" != "null" ] && { log "   public IP: ${ip}"; break; }
    done
    log "=== 完成 ==="
    exit 0
  fi

  if echo "$out" | grep -qi "Out of host capacity"; then
    reason="Out of host capacity"
  elif echo "$out" | grep -qiE "LimitExceeded|QuotaExceeded"; then
    log "❌ 額度或配額不足，重試沒有意義，停止"; echo "$out" >> "$LOG"; exit 4
  elif echo "$out" | grep -qiE "NotAuthenticated|NotAuthorized|Forbidden"; then
    log "❌ 認證或權限問題，停止"; echo "$out" >> "$LOG"; exit 5
  else
    reason="其他錯誤（見 log）"; echo "$out" >> "$LOG"
  fi

  wait_s=$(( INTERVAL_MIN + RANDOM % (INTERVAL_MAX - INTERVAL_MIN + 1) ))
  log "第 ${attempt} 次失敗（FD=${fd}）：${reason}；${wait_s} 秒後再試"
  sleep "$wait_s"
done
