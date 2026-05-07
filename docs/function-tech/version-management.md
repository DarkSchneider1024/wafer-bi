# 📌 Wafer BI 版本管理與相容性矩陣

## 1. 版本政策 (Versioning Policy)
本系統遵循 [Semantic Versioning 2.0.0](https://semver.org/) 規範。

- **格式**: `MAJOR.MINOR.PATCH`
- **範例**: `1.0.0`

## 2. 服務相容性矩陣 (Compatibility Matrix)

此矩陣用於定義各個微服務之間能夠正常協作的最低版本要求。

| 系統版本 | API Gateway | User Service (Java) | Wafer BI (Python) | 備註 |
| :--- | :--- | :--- | :--- | :--- |
| **1.0.0** | 1.0.x | 1.0.x | 1.0.x | 初始發行版本 |
| **1.1.0** | 1.1.x | 1.0.x | 1.1.x | 增加 OTel 監控支持 |

## 3. 系統資訊 API 規範
存取網址：`https://wafer.carrot-atelier.online/api/system/info`

### 回傳欄位說明：
- `system_version`: 整個產品對外的商業版本號。
- `services`: 列出所有運行中的 Pod 版本。
- `compatibility_status`: 檢查當前運行版本是否符合矩陣要求。

## 4. 如何更新版本？
1.  **代碼更新**: 修改各服務的 `package.json`, `pom.xml` 或 `main.py`。
2.  **K8S 標籤**: 更新 `deployment.yaml` 中的 `version` 標籤與 Image Tag。
3.  **文檔同步**: 更新此文件中的矩陣表。
