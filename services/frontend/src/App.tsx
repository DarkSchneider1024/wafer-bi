import React, { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import axios from 'axios';
import { LayoutGrid, TrendingUp, Filter, ChevronRight, BarChart3, FlaskConical } from 'lucide-react';
import './index.css';

const API_BASE = window.location.hostname === 'localhost' 
  ? 'http://localhost:8000/api' 
  : '/api';

function App() {
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
        top: isThumbnail ? '0%' : '10%', 
        bottom: isThumbnail ? '0%' : '15%', 
        left: isThumbnail ? '0%' : '10%', 
        right: isThumbnail ? '0%' : '10%',
        containLabel: false
      },
      xAxis: { 
        type: 'category', 
        data: Array.from({length: 31}, (_, i) => i).filter(i => i > 0),
        show: !isThumbnail 
      },
      yAxis: { 
        type: 'category', 
        data: Array.from({length: 31}, (_, i) => i).filter(i => i > 0),
        show: !isThumbnail 
      },
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
      title: { text: `CDF - ${selectedParam}`, left: 'center', textStyle: { color: '#f8fafc', fontSize: 14 } },
      tooltip: { trigger: 'axis' },
      xAxis: { name: 'Value', type: 'value', splitLine: { show: false }, axisLine: { lineStyle: { color: '#94a3b8' } } },
      yAxis: { name: 'Prob', type: 'value', axisLine: { lineStyle: { color: '#94a3b8' } } },
      series: [{
        data: cdfData.points.map((p: any) => [p.x, p.y]),
        type: 'line',
        smooth: true,
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: 'rgba(99, 102, 241, 0.4)' }, { offset: 1, color: 'rgba(99, 102, 241, 0)' }]
          }
        },
        lineStyle: { color: '#6366f1', width: 2 }
      }]
    };
  };

  const getBoxplotOption = () => {
    if (!statsData) return {};
    return {
      title: { text: `${selectedParam} Distribution (Boxplot)`, left: 'center', textStyle: { color: '#f8fafc' } },
      tooltip: { trigger: 'item', axisPointer: { type: 'shadow' } },
      xAxis: { type: 'category', data: statsData.wafer_ids, axisLine: { lineStyle: { color: '#94a3b8' } } },
      yAxis: { name: selectedParam, type: 'value', splitLine: { lineStyle: { color: '#334155' } }, axisLine: { lineStyle: { color: '#94a3b8' } } },
      series: [{
        name: 'Boxplot',
        type: 'boxplot',
        data: statsData.boxplot,
        itemStyle: { borderColor: '#818cf8', color: 'rgba(99, 102, 241, 0.3)' }
      }]
    };
  };

  const getTrendOption = () => {
    if (!statsData) return {};
    return {
      title: { text: `${selectedParam} Lot Trend (Mean)`, left: 'center', textStyle: { color: '#f8fafc' } },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: statsData.wafer_ids, axisLine: { lineStyle: { color: '#94a3b8' } } },
      yAxis: { name: 'Mean', type: 'value', axisLine: { lineStyle: { color: '#94a3b8' } } },
      series: [{
        data: statsData.trend,
        type: 'line',
        symbolSize: 8,
        lineStyle: { color: '#c084fc', width: 3 },
        itemStyle: { color: '#c084fc' },
        markPoint: { data: [{ type: 'max', name: 'Max' }, { type: 'min', name: 'Min' }] }
      }]
    };
  };

  return (
    <div className="dashboard">
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <BarChart3 size={32} color="#6366f1" />
          <h1>Wafer BI Analytics</h1>
        </div>
        <div className="controls">
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
        <div 
          className={`nav-tab ${view === 'lot-overview' ? 'active' : ''}`}
          onClick={() => setView('lot-overview')}
        >
          Lot Overview
        </div>
        <div 
          className={`nav-tab ${view === 'wafer-detail' ? 'active' : ''}`}
          onClick={() => setView('wafer-detail')}
        >
          Wafer Detail
        </div>
        <div 
          className={`nav-tab ${view === 'statistical-analysis' ? 'active' : ''}`}
          onClick={() => setView('statistical-analysis')}
        >
          Statistical Analysis
        </div>
        <div 
          className={`nav-tab ${view === 'data-report' ? 'active' : ''}`}
          onClick={() => setView('data-report')}
        >
          Data Report
        </div>
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
                  <ReactECharts 
                    option={getHeatmapOption(lotData[wId], true)} 
                    style={{ height: '180px' }} 
                  />
                </div>
              ))}
            </div>
            <div>
              <div className="glass-card" style={{ position: 'sticky', top: '2rem' }}>
                <h3 style={{ marginTop: 0 }}>Lot Statistics ({selectedParam})</h3>
                <div style={{ height: '300px' }}>
                  <ReactECharts option={getCDFOption()} style={{ height: '100%' }} />
                </div>
                <div style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#94a3b8' }}>
                  <p>Parameter: {selectedParam}</p>
                  <p>Total Wafers: 25</p>
                  <p>Status: All measurements complete</p>
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
                  <LayoutGrid size={20} /> Wafer Map ({selectedWafer}) - {selectedParam}
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
              <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <TrendingUp size={20} /> CDF Distribution ({selectedParam})
              </h3>
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
              <h3 style={{ marginTop: 0 }}>{selectedParam} Variation (Boxplot)</h3>
              <div style={{ height: '400px' }}>
                <ReactECharts option={getBoxplotOption()} style={{ height: '100%' }} />
              </div>
            </div>
            <div className="glass-card">
              <h3 style={{ marginTop: 0 }}>{selectedParam} Lot Trend (Mean)</h3>
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
              <h3 style={{ margin: 0 }}>Raw Data Report (Lot: {selectedLot})</h3>
              
              <div className="controls" style={{ flex: 1, justifyContent: 'flex-end' }}>
                <div className="control-group">
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Search Wafer:</span>
                  <input 
                    type="text" 
                    placeholder="W01, W02..." 
                    className="search-input"
                    value={filterWafer}
                    onChange={(e) => setFilterWafer(e.target.value.toUpperCase())}
                    style={{ background: '#1e293b', border: '1px solid #334155', color: 'white', padding: '0.3rem 0.6rem', borderRadius: '4px', width: '100px' }}
                  />
                </div>
                <div style={{ fontSize: '0.9rem', color: '#94a3b8' }}>
                  Total: <span style={{ color: '#818cf8', fontWeight: 600 }}>{reportTotal}</span>
                </div>
              </div>
            </div>

            <div className="table-container" style={{ overflowX: 'auto', maxHeight: '600px' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th onClick={() => handleSort('lot_id')} style={{ cursor: 'pointer' }}>
                      Lot ID {sortField === 'lot_id' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => handleSort('wafer_id')} style={{ cursor: 'pointer' }}>
                      Wafer ID {sortField === 'wafer_id' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => handleSort('parameter')} style={{ cursor: 'pointer' }}>
                      Parameter {sortField === 'parameter' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => handleSort('x')} style={{ cursor: 'pointer' }}>
                      X {sortField === 'x' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => handleSort('y')} style={{ cursor: 'pointer' }}>
                      Y {sortField === 'y' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => handleSort('value')} style={{ cursor: 'pointer' }}>
                      Value {sortField === 'value' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loadingReport ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '3rem' }}>Loading data...</td></tr>
                  ) : reportData.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '3rem' }}>No records found.</td></tr>
                  ) : reportData.map((row, idx) => (
                    <tr key={idx}>
                      <td>{row.lot_id}</td>
                      <td>{row.wafer_id}</td>
                      <td>{row.parameter}</td>
                      <td>{row.x}</td>
                      <td>{row.y}</td>
                      <td style={{ color: '#6366f1', fontWeight: 600 }}>{row.value.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pagination" style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '2rem', alignItems: 'center' }}>
              <button 
                className="btn-page"
                disabled={reportPage <= 1 || loadingReport}
                onClick={() => fetchReport(reportPage - 1)}
              >
                Previous 100
              </button>
              <span style={{ color: '#f8fafc' }}>Page {reportPage} of {Math.ceil(reportTotal / 100)}</span>
              <button 
                className="btn-page"
                disabled={reportPage >= Math.ceil(reportTotal / 100) || loadingReport}
                onClick={() => fetchReport(reportPage + 1)}
              >
                Next 100
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
