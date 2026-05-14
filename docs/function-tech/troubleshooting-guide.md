# Wafer BI 平台異常處理與除錯指南 (Troubleshooting Guide)

本文件說明如何使用 Argo CD 監控 Wafer BI 平台的運行狀態，並查看應用程式產生的日誌 (Logs) 以進行問題排查。

## 1. 進入 Argo CD 控制台
*   **網址**: [https://argo.carrot-atelier.online](https://argo.carrot-atelier.online)
*   **帳號**: `admin`
*   **密碼**: 請參閱 `.agent/skills/argo-troubleshooter.md` 或詢問系統管理員。

## 2. 如何查看應用程式日誌 (Logs)
Argo CD 提供了直觀的介面來查看每個服務 (Pod) 的即時日誌：

1.  **選取應用程式**: 在 Dashboard 中點擊 `wafer-bi-platform`。
2.  **定位服務**: 在資源樹狀圖中，找到你想檢查的服務（例如 `ai-mcp-service`）。
3.  **點擊 Pod**: 點擊代表該服務的圓形或正方形圖示（通常標註為 `Pod`）。
4.  **切換至 Logs 頁籤**: 在彈出的右側面板中，點擊頂部的 **"LOGS"** 選項。
5.  **日誌操作**:
    *   **搜尋**: 使用放大鏡圖示搜尋特定關鍵字（如 `Error`, `Traceback`, `Exception`）。
    *   **捲動**: 預設會自動捲動到最底端（Tail）。
    *   **複製**: 可以選取文字並複製到剪貼簿。

## 3. 常見問題排查流程
當 AI 助手出現「無法處理請求」或報錯時，請依照以下步驟檢查：

### 步驟 A：檢查同步狀態 (Sync Status)
*   確認 Application 顯示為 **Synced**。
*   如果顯示為 **OutOfSync**，點擊 **SYNC** 按鈕強制同步最新程式碼。

### 步驟 B：檢查服務健康度 (Health Status)
*   **Healthy (綠色)**: 服務運行正常。
*   **Progressing (黃色)**: 正在部署中，請稍候。
*   **Degraded (紅色)**: 服務崩潰。請點擊該 Pod 並查看 **Logs** 或 **Events**。

### 步驟 C：分析 Python 回溯 (Traceback)
在 `ai-mcp-service` 的日誌中，如果看到 `Traceback (most recent call last):`，請記錄最後一行報錯內容（例如 `AttributeError: module 'google.generativeai.types' has no attribute 'Content'`），這通常是程式碼邏輯或依賴庫版本不匹配的問題。

## 4. 進階除錯指令 (kubectl)
如果你有權限使用命令列，也可以使用以下指令：
```bash
# 查看特定命名空間的所有 Pod
kubectl get pods -n k8sdemo

# 查看特定 Pod 的日誌
kubectl logs -f [POD_NAME] -n k8sdemo

# 查看服務事件
kubectl get events -n k8sdemo --sort-by='.lastTimestamp'
```
