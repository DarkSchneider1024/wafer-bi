import { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import axios from 'axios';
import { 
  LayoutGrid, TrendingUp, Filter, ChevronRight, 
  BarChart3, FlaskConical, Sun, Moon, Languages 
} from 'lucide-react';
import './index.css';

const API_BASE = '/api';

// --- i18n Translations ---
const translations = {
  en: {
    title: "Wafer BI Analytics",
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
    recordsPerPage: "Records per page: 100"
  },
  zh: {
    title: "晶圓商業智能分析",
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
    recordsPerPage: "每頁顯示: 100 筆"
  }
};

function App() {
  // --- States ---
  const [lang, setLang] = useState<'en' | 'zh'>('zh');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [meta, setMeta] = useState<{ lots: string[], wafers: string[], parameters: string[] }>({ 
    lots: [], wafers: [], parameters: [] 
  });
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
    axios.get(`${API_BASE}/meta`).then(res => {
      setMeta(res.data);
      if (res.data.parameters?.length > 0) setSelectedParam(res.data.parameters[0]);
    });
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
  }, [view, selectedLot, sortField, sortOrder, filterWafer]);

  const fetchReport = (page: number, sort: string = sortField, order: string = sortOrder, filter: string = filterWafer) => {
    setLoadingReport(true);
    axios.get(`${API_BASE}/report?page=${page}&limit=100&lot_id=${selectedLot}&wafer_id=${filter}&sort_by=${sort}&sort_order=${order}`)
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
    return {
      tooltip: { 
        show: !isThumbnail, 
        position: 'top',
        formatter: (params: any) => {
          const [x, y, val] = params.data;
          return `Die (${x}, ${y})<br/>${selectedParam}: ${val.toFixed(2)}`;
        }
      },
      grid: { 
        top: isThumbnail ? '5%' : '10%', 
        bottom: isThumbnail ? '5%' : '15%', 
        left: isThumbnail ? '5%' : '10%', 
        right: isThumbnail ? '5%' : '10%',
        containLabel: false
      },
      xAxis: { type: 'category', show: false },
      yAxis: { type: 'category', show: false },
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
      series: [{
        name: 'Wafer Map',
        type: 'heatmap',
        data: data.data,
        label: { show: false },
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.5)' }
        }
      }]
    };
  };

  const getCDFOption = () => {
    if (!cdfData) return {};
    return {
      title: { text: `CDF - ${selectedParam}`, left: 'center', textStyle: { color: 'var(--text-primary)', fontSize: 14 } },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'value', axisLine: { lineStyle: { color: 'var(--text-secondary)' } } },
      yAxis: { type: 'value', axisLine: { lineStyle: { color: 'var(--text-secondary)' } } },
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
      title: { text: `${selectedParam} ${t.paramVariation}`, left: 'center', textStyle: { color: 'var(--text-primary)' } },
      tooltip: { trigger: 'item' },
      xAxis: { type: 'category', data: statsData.wafer_ids, axisLine: { lineStyle: { color: 'var(--text-secondary)' } } },
      yAxis: { type: 'value', splitLine: { lineStyle: { color: 'var(--border-color)' } } },
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
      title: { text: `${selectedParam} ${t.lotTrend}`, left: 'center', textStyle: { color: 'var(--text-primary)' } },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: statsData.wafer_ids, axisLine: { lineStyle: { color: 'var(--text-secondary)' } } },
      yAxis: { type: 'value', axisLine: { lineStyle: { color: 'var(--text-secondary)' } } },
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
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <BarChart3 size={32} color="var(--accent-color)" />
          <h1>{t.title}</h1>
        </div>
        
        <div className="controls">
          <div className="control-group">
            <Languages size={18} />
            <select value={lang} onChange={(e) => setLang(e.target.value as any)}>
              <option value="zh">繁體中文</option>
              <option value="en">English</option>
            </select>
          </div>
          
          <button className="btn-icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          <div className="control-group">
            <Filter size={18} />
            <select value={selectedLot} onChange={(e) => setSelectedLot(e.target.value)}>
              {meta.lots.map(lot => <option key={lot} value={lot}>{lot}</option>)}
            </select>
          </div>
          
          <div className="control-group">
            <FlaskConical size={18} />
            <select value={selectedParam} onChange={(e) => setSelectedParam(e.target.value)}>
              {meta.parameters.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
      </header>

      <nav className="nav-tabs">
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

      {view === 'lot-overview' && (
        <div className="lot-view">
          <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '2rem' }}>
            <div className="wafer-grid">
              {lotData && Object.keys(lotData).sort().map(wId => (
                <div 
                  key={wId} 
                  className="glass-card wafer-thumbnail"
                  onClick={() => {
                    setSelectedWafer(wId);
                    setView('wafer-detail');
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 600 }}>{wId}</span>
                    <ChevronRight size={14} />
                  </div>
                  <div style={{ flex: 1, minHeight: 0 }}>
                    <ReactECharts 
                      option={getHeatmapOption(lotData[wId], true)} 
                      style={{ height: '100%', width: '100%' }} 
                    />
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
              <div className="chart-container">
                <ReactECharts option={getHeatmapOption(waferData)} style={{ height: '100%' }} />
              </div>
            </div>
            <div className="glass-card">
              <h3 style={{ marginTop: 0 }}>CDF Distribution</h3>
              <div className="chart-container">
                <ReactECharts option={getCDFOption()} style={{ height: '100%' }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {view === 'statistical-analysis' && (
        <div className="stats-view">
          <div className="grid" style={{ gridTemplateColumns: '1fr', gap: '2rem' }}>
            <div className="glass-card">
              <div style={{ height: '400px' }}>
                <ReactECharts option={getBoxplotOption()} style={{ height: '100%' }} />
              </div>
            </div>
            <div className="glass-card">
              <div style={{ height: '400px' }}>
                <ReactECharts option={getTrendOption()} style={{ height: '100%' }} />
              </div>
            </div>
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
                  <span>{t.searchWafer}:</span>
                  <input 
                    type="text" 
                    value={filterWafer}
                    onChange={(e) => setFilterWafer(e.target.value.toUpperCase())}
                    style={{ width: '80px' }}
                  />
                </div>
                <span>{t.total}: {reportTotal}</span>
              </div>
            </div>

            <div className="table-container" style={{ overflowX: 'auto', maxHeight: '600px' }}>
              <table className="data-table">
                <thead>
                  <tr>
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
                    <tr><td colSpan={6} style={{ textAlign: 'center' }}>{t.loading}</td></tr>
                  ) : reportData.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center' }}>{t.noRecords}</td></tr>
                  ) : reportData.map((row, idx) => (
                    <tr key={idx}>
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
    </div>
  );
}

export default App;
