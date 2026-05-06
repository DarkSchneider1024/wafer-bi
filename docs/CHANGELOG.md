# 📝 異動紀錄 (Changelog)

## [2026-05-06] - UI/UX 重構與數據維度擴展

### 🎨 前端優化 (Frontend)
- **佈局重構**：導入**左側側邊欄 (Sidebar)** 篩選模式，將 Product、Lot、Parameter 篩選條件統一歸類，提升大螢幕操作體驗。
- **預設亮色模式**：回應使用者需求，將預設主題改為亮色 (Light Mode)，並優化文字與背景對比。
- **設置選單**：新增右上角設置按鈕，收納語言切換與亮暗模式切換功能，保持 Header 簡潔。
- **Wafer Map 修正**：
    - 修正座標軸範圍，解決因數據分佈導致的晶圓形狀畸變（比例失真）。
    - 加入圓形 Graphic 邊框，強化「晶圓」視覺辨識度。
    - 使用固定 30x30 網格佈局，解決部分數據顯示不全的問題。

### ⚙️ 後端擴充 (Backend)
- **數據生成器更新**：`data_generator.py` 現在支援產出包含 `product_id` 的多維度數據。
- **API 擴展**：
    - `/api/meta`：新增回傳 `products` 清單。
    - `/api/report`：支援根據 `product_id` 進行過濾，並在報表結果中包含產品欄位。

### 📂 文件更新 (Documentation)
- 更新 `frontend-tech-stack.md` 與 `backend-tech-stack.md` 以反映上述技術變動。
- 同步更新 `TODO.md` 狀態。
