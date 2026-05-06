# 🚀 Wafer BI 前端技術架構文件

本專案的前端系統旨在提供半導體工業級的數據視覺化體驗，結合了極致的效能與現代化的視覺設計。

## 🛠️ 技術棧 (Tech Stack)

| 技術 | 說明 | 優勢 |
| :--- | :--- | :--- |
| **React 19** | 核心 UI 框架 | 組件化開發，狀態驅動視圖 |
| **Vite 8** | Next-Gen 構建工具 | 秒級熱更新 (HMR)，優化開發體驗 |
| **Apache ECharts 6** | 大數據視覺化引擎 | 支援 Canvas/SVG 雙引擎，處理萬級數據點不卡頓 |
| **Lucide React** | 向量圖標庫 | 輕量級、支援 Tree-shaking |
| **Axios** | 異步請求處理 | 支援請求/回應攔截器，簡化 API 調用 |
| **Glassmorphism** | UI 設計風格 | 玻璃擬態質感，營造企業級的高級感 |

## 📊 數據視覺化 (Data Visualization with ECharts)

本專案將 ECharts 的功能發揮到極致，以應對半導體數據的高複雜度：

### 1. 晶圓地圖 (Wafer Map)
*   **圖表類型**：`heatmap` (熱力圖)
*   **實作細節**：透過矩陣座標定位每一個 Die，並使用 `visualMap` 組件進行數據映射。這讓用戶能直觀地發現晶圓邊緣失效 (Edge Defect) 或特定區域的製程異常。

### 2. 統計分佈 (CDF Plot)
*   **圖表類型**：`line` (折線圖) + `areaStyle` (面積圖)
*   **優化**：前端進行數據抽樣 (Sampling)，確保在處理數千個數據點時仍能保持 60fps 的流暢縮放與平移。

### 3. 製程變異分析 (Boxplot)
*   **圖表類型**：`boxplot` (箱線圖)
*   **實作細節**：自動計算數據的五數概括（Min, Q1, Median, Q3, Max），用於跨 Wafer 的數據對比，是良率工程師最常用的分析工具。

### 4. 批次趨勢 (Trend Line)
*   **圖表類型**：`line` + `markPoint` (標記點)
*   **實作細節**：展示 Lot 內均值的變化趨勢，並利用 `markPoint` 自動標註該批次的最高與最低點。

## 🏗️ 核心組件設計 (Component Architecture)

### 1. 晶圓視覺化 (Wafer Map)
*   **技術實現**：使用 ECharts 的 `heatmap` 座標系。
*   **亮點**：
    *   動態顏色映射：透過 `visualMap` 自動計算 Lot 內的數據範圍，並映射到色彩梯度。
    *   互動提示：自定義 `tooltip` 格式化函數，顯示 Die 的精確坐標 (X, Y) 與物理數值。

### 2. 統計分析工具 (Statistical Tools)
*   **CDF 分佈圖**：前端接收採樣後的數據點，使用平滑曲線 (smooth line) 展示分佈趨勢，並配合線性漸變陰影。
*   **Boxplot (箱線圖)**：直觀呈現批次中 25 片晶圓的數據離散程度 (Q1, Q3, Median, Min, Max)。

### 3. 分頁報表系統 (Paginated Report)
*   **邏輯**：採用 **On-demand Loading (按需載入)** 策略。
*   **分頁規格**：固定每頁 100 筆紀錄，當用戶點擊「下一頁」時才發送 API 請求。
*   **效能**：避免一次性渲染數萬行 DOM 元素，維持極佳的滾動流暢度。

## 🎨 視覺與體驗 (UX/UI)

*   **色調**：採用深色模式 (`#0f172a`)，降低長時間觀察螢幕的眼部疲勞。
*   **玻璃擬態**：卡片組件使用 `backdrop-filter: blur(12px)`，模擬霧面玻璃質感。
*   **響應式**：針對筆記型電腦與大螢幕監視器進行優化，使用 CSS Grid 進行彈性布局。

## 📂 目錄結構
```text
services/frontend/src/
├── App.tsx          # 應用程式主進入點與狀態管理中心
├── index.css        # 全域設計系統與玻璃擬態樣式定義
├── main.tsx         # React 渲染根節點
└── assets/          # 靜態資源與圖片
```

---
*本文件旨在為開發者提供 Wafer BI 前端架構的快速導覽。*
