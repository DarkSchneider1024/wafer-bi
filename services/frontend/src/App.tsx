import { useState, useEffect, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import axios from 'axios';
import { 
  LayoutGrid, ChevronRight, 
  BarChart3, FlaskConical, Sun, Moon, Languages,
  Settings, Package, Database, Search
} from 'lucide-react';
import './index.css';

const API_BASE = '/api';

// --- i18n Translations ---
const translations = {
  en: {
    title: "Wafer BI",
    lotOverview: "Lot Overview",
    waferDetail: "Wafer Detail",
    statsAnalysis: "Statistical Analysis",
    dataReport: "Data Report",
    searchWafer: "Search Wafer",
    total: "Total",
    loading: "Loading data...",
    noRecords: "No records found.",
    previous: "Previous",
    next: "Next",
    lotStats: "Lot Statistics",
    paramVariation: "Variation (Boxplot)",
    lotTrend: "Lot Trend (Mean)",
    recordsPerPage: "Records per page: 100",
    settings: "Settings",
    language: "Language",
    theme: "Theme",
    product: "Product",
    lot: "Lot",
    parameter: "Parameter",
    filters: "Filters"
  },
  zh: {
    title: "晶圓 BI 分析",
    lotOverview: "批次概覽",
    waferDetail: "晶圓詳情",
    statsAnalysis: "統計分析",
    dataReport: "數據報表",
    searchWafer: "搜尋晶圓",
    total: "總計",
    loading: "資料載入中...",
    noRecords: "查無資料。",
    previous: "前 100 筆",
    next: "後 100 筆",
    lotStats: "批次統計",
    paramVariation: "參數變異 (箱型圖)",
    lotTrend: "批次趨勢 (平均值)",
    recordsPerPage: "每頁顯示: 100 筆",
    settings: "設置",
    language: "語言",
    theme: "主題",
    product: "產品名稱",
    lot: "批次編號",
    parameter: "測試參數",
    filters: "篩選條件"
  }
};

function App() {
  // --- States ---
  const [lang, setLang] = useState<'en' | 'zh'>('zh');
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  const [meta, setMeta] = useState<{ products: string[], lots: string[], wafers: string[], parameters: string[] }>({ 
    products: [], lots: [], wafers: [], parameters: [] 
  });
  
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedLot, setSelectedLot] = useState('Lot1');
  const [selectedWafer, setSelectedWafer] = useState('W01');
  const [selectedParam, setSelectedParam] = useState('Thickness');
  const [view, setView] = useState<'lot-overview' | 'wafer-detail' | 'statistical-analysis' | 'data-report'>('lot-overview');
  
  const [lotData, setLotData] = useState<any>(null);
  const [waferData, setWaferData] = useState<any>(null);
  const [cdfData, setCdfData] = useState<any>(null);
  const [statsData, setStatsData] = useState<any>(null);
  const [reportData, setReportData] = useState<any[]>([]);
  const [reportTotal, setReportTotal] = useState(0);
  const [reportPage, setReportPage] = useState(1);
  const [sortField, setSortField] = useState('wafer_id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterWafer, setFilterWafer] = useState('');
  const [loadingReport, setLoadingReport] = useState(false);

  const t = translations[lang];

  // --- Effects ---
  useEffect(() => {
    document.body.className = theme === 'light' ? 'light-theme' : '';
  }, [theme]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    axios.get(`${API_BASE}/meta`).then(res => {
      if (res.data) {
        setMeta(res.data);
        if (res.data.products?.length > 0) setSelectedProduct(res.data.products[0]);
        if (res.data.parameters?.length > 0) setSelectedParam(res.data.parameters[0]);
      }
    }).catch(err => console.error("Failed to fetch meta:", err));
  }, []);

  useEffect(() => {
    if (view === 'lot-overview') {
      axios.get(`${API_BASE}/lot-wafers/${selectedLot}?parameter=${selectedParam}`).then(res => setLotData(res.data));
    }
  }, [selectedLot, selectedParam, view]);

  useEffect(() => {
    if (view === 'wafer-detail') {
      axios.get(`${API_BASE}/wafer-map/${selectedLot}/${selectedWafer}?parameter=${selectedParam}`).then(res => setWaferData(res.data));
    }
    if (view === 'statistical-analysis' || view === 'lot-overview') {
      axios.get(`${API_BASE}/stats/${selectedLot}?parameter=${selectedParam}`).then(res => setStatsData(res.data));
    }
    axios.get(`${API_BASE}/cdf/${selectedLot}?parameter=${selectedParam}`).then(res => setCdfData(res.data));
  }, [selectedLot, selectedWafer, selectedParam, view]);

  useEffect(() => {
    if (view === 'data-report') {
      fetchReport(1, sortField, sortOrder, filterWafer);
    }
  }, [view, selectedProduct, selectedLot, sortField, sortOrder, filterWafer]);

  const fetchReport = (page: number, sort: string = sortField, order: string = sortOrder, filter: string = filterWafer) => {
    setLoadingReport(true);
    const url = `${API_BASE}/report?page=${page}&limit=100&product_id=${selectedProduct}&lot_id=${selectedLot}&wafer_id=${filter}&sort_by=${sort}&sort_order=${order}`;
    axios.get(url)
      .then(res => {
        setReportData(res.data.data);
        setReportTotal(res.data.total);
        setReportPage(page);
        setLoadingReport(false);
      })
      .catch(() => setLoadingReport(false));
  };

  const handleSort = (field: string) => {
    const newOrder = sortField === field && sortOrder === 'asc' ? 'desc' : 'asc';
    setSortField(field);
    setSortOrder(newOrder);
  };

  const getHeatmapOption = (data: any, isThumbnail = false) => {
    if (!data) return {};
    const gridSize = 30;
    const categories = Array.from({ length: gridSize }, (_, i) => i + 1);
    
    return {
      title: {
        text: isThumbnail ? '' : `[${selectedProduct}] ${selectedLot} - ${selectedWafer} : ${selectedParam} Map`,
        left: 'center',
        top: '2%',
        textStyle: { color: 'var(--text-primary)', fontSize: 16 }
      },
      tooltip: { 
        show: !isThumbnail, 
        position: 'top',
        formatter: (params: any) => {
          const [x, y, val] = params.data;
          return `Die (${x}, ${y})<br/>${selectedParam}: ${val.toFixed(2)}`;
        }
      },
      toolbox: {
        show: !isThumbnail,
        right: '2%',
        top: '2%',
        feature: {
          dataZoom: { yAxisIndex: 'none', title: { zoom: 'Zoom', back: 'Back' } },
          dataView: { readOnly: false, title: 'Data View', lang: ['Data View', 'Close', 'Refresh'] },
          restore: { title: 'Restore' },
          saveAsImage: { title: 'Save' }
        }
      },
      grid: { 
        top: isThumbnail ? '10%' : '15%', 
        bottom: '10%', 
        left: '10%', 
        right: '10%',
        containLabel: false
      },
      xAxis: { type: 'category', data: categories, show: false },
      yAxis: { type: 'category', data: categories, show: false, inverse: true },
      visualMap: {
        min: data.min,
        max: data.max,
        show: !isThumbnail,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: '0%',
        inRange: {
          color: ['#313695', '#4575b4', '#74add1', '#abd9e9', '#e0f3f8', '#ffffbf', '#fee090', '#fdae61', '#f46d43', '#d73027', '#a50026']
        }
      },
      graphic: [{
        type: 'circle',
        shape: { cx: '50%', cy: '50%', r: isThumbnail ? '40%' : '42%' },
        style: { 
          fill: 'transparent', 
          stroke: 'rgba(150, 150, 150, 0.5)', 
          lineWidth: 2,
          shadowBlur: 10,
          shadowColor: 'rgba(0,0,0,0.3)'
        },
        silent: true,
        left: 'center',
        top: 'center',
        z: 10
      }],
      series: [{
        name: 'Wafer Map',
        type: 'heatmap',
        data: data.data.map((item: any) => [item[0] - 1, item[1] - 1, item[2]]),
        label: { show: false },
        itemStyle: {
          borderWidth: 0
        },
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.5)' } }
      }]
    };
  };

  const getCDFOption = () => {
    if (!cdfData) return {};
    return {
      title: { 
        text: `${selectedLot} : ${selectedParam} CDF Distribution`, 
        subtext: `Product: ${selectedProduct}`,
        left: 'center', 
        top: '2%',
        textStyle: { color: 'var(--text-primary)', fontSize: 16 } 
      },
      tooltip: { trigger: 'axis' },
      toolbox: {
        right: '2%',
        top: '2%',
        feature: {
          dataZoom: { yAxisIndex: 'none', title: { zoom: 'Zoom', back: 'Back' } },
          restore: { title: 'Restore' },
          saveAsImage: { title: 'Save' }
        }
      },
      dataZoom: [{ type: 'inside' }, { type: 'slider', bottom: '5%' }],
      grid: { top: '15%', bottom: '20%', left: '10%', right: '10%' },
      xAxis: { 
        name: `Parameter: ${selectedParam}`,
        nameLocation: 'middle',
        nameGap: 30,
        type: 'value', 
        axisLine: { lineStyle: { color: 'var(--text-secondary)' } } 
      },
      yAxis: { 
        name: 'Probability',
        type: 'value', 
        axisLine: { lineStyle: { color: 'var(--text-secondary)' } } 
      },
      series: [{
        data: cdfData.points.map((p: any) => [p.x, p.y]),
        type: 'line',
        smooth: true,
        areaStyle: { opacity: 0.3 },
        lineStyle: { width: 2 }
      }]
    };
  };

  const getBoxplotOption = () => {
    if (!statsData) return {};
    return {
      title: { 
        text: `${selectedLot} : ${selectedParam} Variation`, 
        subtext: `Product: ${selectedProduct}`,
        left: 'center', 
        top: '2%',
        textStyle: { color: 'var(--text-primary)', fontSize: 16 } 
      },
      tooltip: { trigger: 'item' },
      toolbox: {
        right: '2%',
        top: '2%',
        feature: {
          dataZoom: { yAxisIndex: 'none', title: { zoom: 'Zoom', back: 'Back' } },
          restore: { title: 'Restore' },
          saveAsImage: { title: 'Save' }
        }
      },
      dataZoom: [{ type: 'inside' }, { type: 'slider', bottom: '5%' }],
      grid: { top: '15%', bottom: '20%', left: '10%', right: '10%' },
      xAxis: { 
        name: 'Wafer ID',
        nameLocation: 'middle',
        nameGap: 30,
        type: 'category', 
        data: statsData.wafer_ids, 
        axisLine: { lineStyle: { color: 'var(--text-secondary)' } } 
      },
      yAxis: { 
        name: 'Measured Value',
        type: 'value', 
        splitLine: { lineStyle: { color: 'var(--border-color)' } } 
      },
      series: [{
        name: 'Boxplot',
        type: 'boxplot',
        data: statsData.boxplot,
        itemStyle: { borderColor: 'var(--accent-color)', color: 'rgba(99, 102, 241, 0.3)' }
      }]
    };
  };

  const getTrendOption = () => {
    if (!statsData) return {};
    return {
      title: { 
        text: `${selectedLot} : ${selectedParam} Trend (Mean)`, 
        subtext: `Product: ${selectedProduct}`,
        left: 'center', 
        top: '2%',
        textStyle: { color: 'var(--text-primary)', fontSize: 16 } 
      },
      tooltip: { trigger: 'axis' },
      toolbox: {
        right: '2%',
        top: '2%',
        feature: {
          dataZoom: { yAxisIndex: 'none', title: { zoom: 'Zoom', back: 'Back' } },
          restore: { title: 'Restore' },
          saveAsImage: { title: 'Save' }
        }
      },
      dataZoom: [{ type: 'inside' }, { type: 'slider', bottom: '5%' }],
      grid: { top: '15%', bottom: '20%', left: '10%', right: '10%' },
      xAxis: { 
        name: 'Wafer ID',
        nameLocation: 'middle',
        nameGap: 30,
        type: 'category', 
        data: statsData.wafer_ids, 
        axisLine: { lineStyle: { color: 'var(--text-secondary)' } } 
      },
      yAxis: { 
        name: 'Mean Value',
        type: 'value', 
        axisLine: { lineStyle: { color: 'var(--text-secondary)' } } 
      },
      series: [{
        data: statsData.trend,
        type: 'line',
        symbolSize: 8,
        lineStyle: { width: 3 }
      }]
    };
  };

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <BarChart3 size={28} color="var(--accent-color)" />
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{t.title}</h2>
        </div>

        <div className="sidebar-group">
          <div className="sidebar-title">{t.filters}</div>
          
          <div className="control-group" style={{ background: 'transparent', padding: 0, border: 'none' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
              <Package size={14} style={{ marginRight: '4px' }} /> {t.product}
            </label>
            <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)} style={{ width: '100%' }}>
              {(meta?.products || []).map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div className="control-group" style={{ background: 'transparent', padding: 0, border: 'none', marginTop: '1rem' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
              <Database size={14} style={{ marginRight: '4px' }} /> {t.lot}
            </label>
            <select value={selectedLot} onChange={(e) => setSelectedLot(e.target.value)} style={{ width: '100%' }}>
              {(meta?.lots || []).map(lot => <option key={lot} value={lot}>{lot}</option>)}
            </select>
          </div>

          <div className="control-group" style={{ background: 'transparent', padding: 0, border: 'none', marginTop: '1rem' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
              <FlaskConical size={14} style={{ marginRight: '4px' }} /> {t.parameter}
            </label>
            <select value={selectedParam} onChange={(e) => setSelectedParam(e.target.value)} style={{ width: '100%' }}>
              {(meta?.parameters || []).map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        <div className="sidebar-footer" style={{ marginTop: 'auto', paddingTop: '2rem', fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
          <p>© 2026 Carrot Design Atelier.<br/>All rights reserved.</p>
        </div>
      </aside>

      <main className="main-content">
        <header className="header">
          <nav className="nav-tabs" style={{ marginBottom: 0 }}>
            {[
              { id: 'lot-overview', label: t.lotOverview },
              { id: 'wafer-detail', label: t.waferDetail },
              { id: 'statistical-analysis', label: t.statsAnalysis },
              { id: 'data-report', label: t.dataReport }
            ].map(tab => (
              <div 
                key={tab.id}
                className={`nav-tab ${view === tab.id ? 'active' : ''}`}
                onClick={() => setView(tab.id as any)}
              >
                {tab.label}
              </div>
            ))}
          </nav>
          
          <div className="settings-container" ref={settingsRef}>
            <button className="btn-icon" onClick={() => setShowSettings(!showSettings)}>
              <Settings size={20} />
            </button>
            {showSettings && (
              <div className="settings-menu">
                <div className="settings-item">
                  <span><Languages size={16} style={{ verticalAlign: 'middle', marginRight: '8px' }}/>{t.language}</span>
                  <select value={lang} onChange={(e) => setLang(e.target.value as any)} style={{ padding: '2px 8px', fontSize: '0.8rem' }}>
                    <option value="zh">繁體中文</option>
                    <option value="en">English</option>
                  </select>
                </div>
                <div className="settings-item">
                  <span>{theme === 'dark' ? <Moon size={16} style={{ verticalAlign: 'middle', marginRight: '8px' }}/> : <Sun size={16} style={{ verticalAlign: 'middle', marginRight: '8px' }}/>}{t.theme}</span>
                  <button className="btn-icon" style={{ width: '32px', height: '32px' }} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                    {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        {view === 'lot-overview' && (
          <div className="lot-view">
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '2rem' }}>
              <div className="wafer-grid">
                {lotData && Object.keys(lotData).sort().map(wId => (
                  <div key={wId} className="glass-card wafer-thumbnail" onClick={() => { setSelectedWafer(wId); setView('wafer-detail'); }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: 600 }}>{wId}</span>
                      <ChevronRight size={14} />
                    </div>
                    <div style={{ flex: 1, minHeight: 0, aspectRatio: '1/1', margin: '0 auto' }}>
                      <ReactECharts option={getHeatmapOption(lotData[wId], true)} style={{ height: '100%', width: '100%' }} notMerge={true} />
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <div className="glass-card" style={{ position: 'sticky', top: '2rem' }}>
                  <h3 style={{ marginTop: 0 }}>{t.lotStats} ({selectedParam})</h3>
                  <div style={{ height: '300px' }}>
                    <ReactECharts option={getCDFOption()} style={{ height: '100%' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'wafer-detail' && (
          <div className="detail-view">
            <div className="grid">
              <div className="glass-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <LayoutGrid size={20} /> {t.waferDetail} ({selectedWafer})
                  </h3>
                  <select value={selectedWafer} onChange={(e) => setSelectedWafer(e.target.value)}>
                    {meta.wafers.map(w => <option key={w} value={w}>{w}</option>)}
                  </select>
                </div>
                <div className="chart-container" style={{ height: '500px', aspectRatio: '1/1', margin: '0 auto' }}>
                  <ReactECharts option={getHeatmapOption(waferData)} style={{ height: '100%' }} />
                </div>
              </div>
              <div className="glass-card">
                <h3 style={{ marginTop: 0 }}>CDF Distribution</h3>
                <div className="chart-container" style={{ height: '500px' }}>
                  <ReactECharts option={getCDFOption()} style={{ height: '100%' }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'statistical-analysis' && (
          <div className="stats-view">
            <div className="grid" style={{ gridTemplateColumns: '1fr', gap: '2rem' }}>
              <div className="glass-card"><div style={{ height: '400px' }}><ReactECharts option={getBoxplotOption()} style={{ height: '100%' }} /></div></div>
              <div className="glass-card"><div style={{ height: '400px' }}><ReactECharts option={getTrendOption()} style={{ height: '100%' }} /></div></div>
            </div>
          </div>
        )}

        {view === 'data-report' && (
          <div className="report-view">
            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h3 style={{ margin: 0 }}>{t.dataReport} (Lot: {selectedLot})</h3>
                <div className="controls">
                  <div className="control-group">
                    <Search size={16} />
                    <input type="text" value={filterWafer} placeholder={t.searchWafer} onChange={(e) => setFilterWafer(e.target.value.toUpperCase())} style={{ width: '120px' }} />
                  </div>
                  <span>{t.total}: {reportTotal}</span>
                </div>
              </div>
              <div className="table-container" style={{ overflowX: 'auto', maxHeight: '600px' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th onClick={() => handleSort('lot_id')}>Lot ID</th>
                      <th onClick={() => handleSort('wafer_id')}>Wafer ID</th>
                      <th>Parameter</th>
                      <th>X</th>
                      <th>Y</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingReport ? (
                      <tr><td colSpan={7} style={{ textAlign: 'center' }}>{t.loading}</td></tr>
                    ) : reportData.length === 0 ? (
                      <tr><td colSpan={7} style={{ textAlign: 'center' }}>{t.noRecords}</td></tr>
                    ) : reportData.map((row, idx) => (
                      <tr key={idx}>
                        <td style={{ fontSize: '0.85rem' }}>{row.product_id}</td>
                        <td>{row.lot_id}</td>
                        <td>{row.wafer_id}</td>
                        <td>{row.parameter}</td>
                        <td>{row.x}</td>
                        <td>{row.y}</td>
                        <td style={{ color: 'var(--accent-color)', fontWeight: 600 }}>{row.value.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="pagination" style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '2rem' }}>
                <button className="btn-page" disabled={reportPage <= 1} onClick={() => fetchReport(reportPage - 1)}>{t.previous}</button>
                <span>{reportPage}</span>
                <button className="btn-page" disabled={reportData.length < 100} onClick={() => fetchReport(reportPage + 1)}>{t.next}</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
