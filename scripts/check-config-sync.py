#!/usr/bin/env python3
"""檢查「本地開發 (docker-compose.yml)」與「K8S 部署 (helm/wafer-bi)」兩份服務組態是否同步。

本專案的服務組態存在於三個地方，任何一處增刪服務都必須連動：
  1. docker-compose.yml            —— 本地開發環境
  2. helm/wafer-bi/values.yaml     —— K8S 部署（ArgoCD 的唯一真相來源）
  3. .github/workflows/deploy.yml  —— CI 建置 Image 與 bump image tag

新增／刪除服務時，請同步更新下方 MAPPING，並照 k8s/README.md 的 checklist 操作。
CI（.github/workflows/config-sync.yml）與本機都可直接執行：python scripts/check-config-sync.py
"""
from __future__ import annotations

import pathlib
import re
import sys

# Windows 主控台預設 cp950，印不出下面的 ✅／❌ 會直接丟 UnicodeEncodeError，
# 讓「檢查其實通過了」看起來像腳本壞掉。CI 跑在 UTF-8 的 Linux 上不受影響。
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = pathlib.Path(__file__).resolve().parents[1]

# services/<目錄名>: (compose 服務名, helm values 區塊名, GHCR image 名)
# compose 服務名為 None 表示「刻意不進 compose」（原因寫在行尾註解）
MAPPING: dict[str, tuple[str | None, str, str]] = {
    "wafer-bi":        ("wafer-backend",   "waferBackend",   "wafer-bi-backend"),
    "frontend":        (None,              "waferFrontend",  "wafer-bi-frontend"),  # 本地用 npm run dev（vite 熱更新）
    "api-gateway":     ("api-gateway",     "apiGateway",     "api-gateway"),
    "user-service":    ("user-service",    "userService",    "user-service"),
    "ai-mcp-service":  ("ai-mcp-service",  "aiMcpService",   "ai-mcp-service"),
    "license-service": ("license-service", "licenseService", "license-service"),
}


def main() -> int:
    errors: list[str] = []

    compose = (ROOT / "docker-compose.yml").read_text(encoding="utf-8")
    values = (ROOT / "helm" / "wafer-bi" / "values.yaml").read_text(encoding="utf-8")
    workflow = (ROOT / ".github" / "workflows" / "deploy.yml").read_text(encoding="utf-8")

    # 1. services/ 下有 Dockerfile 的目錄都必須登記在 MAPPING
    services_dir = {p.name for p in (ROOT / "services").iterdir() if (p / "Dockerfile").is_file()}
    for name in sorted(services_dir - set(MAPPING)):
        errors.append(
            f"services/{name} 尚未登記：請在 scripts/check-config-sync.py 的 MAPPING 加入對應，"
            f"並依 k8s/README.md 的 checklist 同步 docker-compose.yml / helm / deploy.yml"
        )

    # 2. MAPPING 裡登記的服務必須真的存在
    for name in sorted(set(MAPPING) - services_dir):
        errors.append(
            f"MAPPING 裡的 services/{name} 已不存在：請將它從 MAPPING、docker-compose.yml、"
            f"helm/wafer-bi、deploy.yml 一併移除"
        )

    # 3. 三份設定逐一比對
    for svc_dir, (compose_name, helm_key, image_name) in MAPPING.items():
        if svc_dir not in services_dir:
            continue  # 已在第 2 步報錯
        if compose_name and not re.search(rf"^  {re.escape(compose_name)}:", compose, re.M):
            errors.append(f"docker-compose.yml 缺少服務「{compose_name}」（對應 services/{svc_dir}）")
        if not re.search(rf"^{re.escape(helm_key)}:", values, re.M):
            errors.append(f"helm/wafer-bi/values.yaml 缺少區塊「{helm_key}:」（對應 services/{svc_dir}）")
        if image_name not in workflow:
            errors.append(f"deploy.yml 的 build matrix 缺少 image「{image_name}」（對應 services/{svc_dir}）")
        if helm_key not in workflow:
            errors.append(f"deploy.yml 的 image tag bump 清單缺少「{helm_key}」（對應 services/{svc_dir}）")

    if errors:
        print("❌ 組態不同步！本地開發 (compose) / K8S 部署 (helm) / CI (deploy.yml) 有漏改：\n")
        for e in errors:
            print(f"  - {e}")
        print("\n連動規則詳見 k8s/README.md")
        return 1

    print("✅ docker-compose.yml / helm/wafer-bi / deploy.yml 三方服務清單一致")
    return 0


if __name__ == "__main__":
    sys.exit(main())
