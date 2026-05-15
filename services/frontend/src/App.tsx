import { useState, useEffect, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import axios from 'axios';
import { 
  LayoutGrid, ChevronRight, 
  BarChart3, FlaskConical, Sun, Moon, Languages,
  Settings, Package, Database, Search, Activity, ShieldCheck, Cpu, ExternalLink, RefreshCw, Play, Bot, Menu, X, LogOut
} from 'lucide-react';
import './index.css';
import AIAssistant from './components/AIAssistant';

const API_BASE = '/api';

// --- i18n Translations ---
const translations = {
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
    filters: "篩選條件",
    login: "登入系統",
    email: "電子郵件",
    username: "帳號",
    password: "密碼",
    signIn: "登入",
    logout: "登出",
    welcome: "歡迎回來",
    demoAccount: "演示帳號",
    adminAccount: "管理員帳號",
    userManagement: "用戶管理",
    aiAssistant: "AI 駐守",
    addUser: "新增用戶",
    name: "姓名",
    group: "群組",
    systemStatus: "系統狀態",
    service: "服務名稱",
    status: "運行狀態",
    version: "版本號",
    healthChecks: "健康檢查連結",
    debugTools: "偵錯工具",
    lastUpdated: "最後更新",
    yieldReport: "良率報表",
    lotYield: "批次良率",
    waferYield: "晶圓良率",
    autoYieldAnalysis: "自動良率檢查",
    analyzing: "正在分析中..."
  },
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
    filters: "Filters",
    login: "Sign In",
    email: "Email",
    username: "Username",
    password: "Password",
    signIn: "Sign In",
    logout: "Logout",
    welcome: "Welcome back",
    demoAccount: "Demo Account",
    adminAccount: "Admin Account",
    userManagement: "User Management",
    aiAssistant: "AI Assistant",
    addUser: "Add User",
    name: "Name",
    group: "Group",
    systemStatus: "System Status",
    service: "Service",
    status: "Status",
    version: "Version",
    healthChecks: "Health Checks",
    debugTools: "Debug Tools",
    lastUpdated: "Last Updated",
    yieldReport: "Yield Report",
    lotYield: "Lot Yield",
    waferYield: "Wafer Yield",
    autoYieldAnalysis: "Auto Yield Check",
    analyzing: "Analyzing..."
  }
};

function App() {
  // --- Auth States ---
  const [user, setUser] = useState<any>(JSON.parse(localStorage.getItem('user') || 'null'));
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [licenseWarning, setLicenseWarning] = useState<string | null>(localStorage.getItem('licenseWarning'));
  const [hasSearched, setHasSearched] = useState(false);

  // --- UI States ---
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
  const [view, setView] = useState<'yield-report' | 'lot-overview' | 'wafer-detail' | 'statistical-analysis' | 'data-report' | 'user-management' | 'system-status' | 'ai-assistant'>('yield-report');
  
  const [yieldLots, setYieldLots] = useState<any[]>([]);
  const [yieldWafers, setYieldWafers] = useState<any[]>([]);
  const [selectedYieldLot, setSelectedYieldLot] = useState('');
  const [loadingYield, setLoadingYield] = useState(false);
  
  const [systemInfo, setSystemInfo] = useState<any>(null);
  const [loadingSystem, setLoadingSystem] = useState(false);
  
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

  // --- User Management States ---
  const [users, setUsers] = useState<any[]>([]);
  const [newUserForm, setNewUserForm] = useState({ username: '', email: '', password: '', userGroup: 'demo01' });
  const [userActionLoading, setUserActionLoading] = useState(false);
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const t = translations[lang];

  // ... (auth functions)

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API_BASE}/users`);
      // Backend returns { users: [...], total: X }
      const usersData = res.data?.users || res.data;
      setUsers(Array.isArray(usersData) ? usersData : []);
    } catch (err) {
      console.error("Failed to fetch users", err);
      setUsers([]);
    }
  };

  const fetchSystemInfo = async () => {
    setLoadingSystem(true);
    try {
      const res = await axios.get(`${API_BASE}/system/info`);
      setSystemInfo(res.data);
    } catch (err) {
      console.error("Failed to fetch system info", err);
    } finally {
      setLoadingSystem(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserActionLoading(true);
    try {
      await axios.post(`${API_BASE}/auth/register`, newUserForm);
      setNewUserForm({ username: '', email: '', password: '', userGroup: 'demo01' });
      setShowAddUserForm(false);
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to add user");
    } finally {
      setUserActionLoading(false);
    }
  };

  // --- Auth Interceptor ---
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  useEffect(() => {
    if (view === 'ai-assistant') {
      window.dispatchEvent(new CustomEvent('open-ai-assistant'));
    }
  }, [view]);

  const handleLogin = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    setAuthError('');
    try {
      const res = await axios.post(`${API_BASE}/auth/login`, loginForm);
      const { token: newToken, user: newUser, licenseWarning: newWarning } = res.data;
      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(newUser));
      localStorage.setItem('licenseWarning', newWarning || '');
      setToken(newToken);
      setUser(newUser);
      setLicenseWarning(newWarning);
    } catch (err: any) {
      setAuthError(err.response?.data?.error || 'Login failed');
    }
  };

  const handleUpdateUser = async (id: number, data: any) => {
    setUserActionLoading(true);
    try {
      await axios.put(`${API_BASE}/users/${id}`, data);
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to update user");
    } finally {
      setUserActionLoading(false);
    }
  };

  const handleResetPassword = async (id: number) => {
    const newPass = prompt("Enter new password:");
    if (!newPass) return;
    setUserActionLoading(true);
    try {
      await axios.patch(`${API_BASE}/users/${id}/password`, { password: newPass });
      alert("Password reset successfully");
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to reset password");
    } finally {
      setUserActionLoading(false);
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    setUserActionLoading(true);
    try {
      await axios.delete(`${API_BASE}/users/${id}`);
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to delete user");
    } finally {
      setUserActionLoading(false);
    }
  };

  const handleEditUser = (u: any) => {
    const newUsername = prompt("Enter new username:", u.username);
    const newEmail = prompt("Enter new email:", u.email);
    const newGroup = prompt("Enter new group (demo01/admin):", u.user_group);
    
    if (newUsername || newEmail || newGroup) {
      handleUpdateUser(u.id, { 
        username: newUsername || u.username, 
        email: newEmail || u.email,
        userGroup: newGroup || u.user_group
      });
    }
  };

  useEffect(() => {
    if (view === 'yield-report') {
      fetchYieldLots();
    }
  }, [view, selectedProduct]);

  useEffect(() => {
    if (selectedYieldLot) {
      fetchWaferYields(selectedYieldLot);
    }
  }, [selectedYieldLot]);

  const fetchYieldLots = async () => {
    setLoadingYield(true);
    try {
      const res = await axios.get(`${API_BASE}/yield/lots${selectedProduct ? `?product_id=${selectedProduct}` : ''}`);
      setYieldLots(res.data);
      if (res.data.length > 0) {
        setSelectedYieldLot(res.data[0].lot_id);
      }
    } catch (err) {
      console.error("Failed to fetch lot yield", err);
    } finally {
      setLoadingYield(false);
    }
  };

  const fetchWaferYields = async (lotId: string) => {
    try {
      const res = await axios.get(`${API_BASE}/yield/wafers/${lotId}`);
      setYieldWafers(res.data);
    } catch (err) {
      console.error("Failed to fetch wafer yield", err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('licenseWarning');
    localStorage.removeItem('menus');
    setToken(null);
    setUser(null);
    setLicenseWarning(null);
    setView('lot-overview');
  };

  // --- Auto Login for Demo ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('admin') && !token) {
      const autoLogin = async () => {
        try {
          // 使用系統預設的 admin 帳號進行免密登入
          const res = await axios.post(`${API_BASE}/auth/login`, { 
            username: 'admin', 
            password: 'admin@carrot' 
          });
          const { token: newToken, user: newUser } = res.data;
          localStorage.setItem('token', newToken);
          localStorage.setItem('user', JSON.stringify(newUser));
          setToken(newToken);
          setUser(newUser);
          
          // 登入成功後清除 URL 參數，避免重新整理時重複觸發
          const newUrl = window.location.pathname + window.location.hash;
          window.history.replaceState({}, document.title, newUrl);
        } catch (err) {
          console.error("Auto-login failed:", err);
          setAuthError("Auto-login failed. Please use manual login.");
        }
      };
      autoLogin();
    }
  }, [token]);

  // --- Effects ---
  useEffect(() => {
    document.body.className = theme === 'light' ? 'light-theme' : '';
  }, [theme]);

  useEffect(() => {
    if (view === 'system-status') fetchSystemInfo();
  }, [view]);

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
    if (view === 'user-management' && user?.user_group === 'admin') {
      fetchUsers();
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

  // --- Render ---

  if (!token) {
    return (
      <div className="login-page">
        <div className="glass-card login-card">
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <BarChart3 size={48} color="var(--accent-color)" style={{ marginBottom: '1rem' }} />
            <h1 style={{ fontSize: '2rem', margin: 0 }}>{t.login}</h1>
            <p style={{ color: 'var(--text-secondary)' }}>Wafer BI Analysis Platform</p>
          </div>
          
          <form onSubmit={handleLogin}>
            <div className="control-group">
              <label>{t.username}</label>
              <input 
                type="text" 
                value={loginForm.username} 
                onChange={(e) => setLoginForm({...loginForm, username: e.target.value})} 
                required 
              />
            </div>
            <div className="control-group" style={{ marginTop: '1rem' }}>
              <label>{t.password}</label>
              <input 
                type="password" 
                value={loginForm.password} 
                onChange={(e) => setLoginForm({...loginForm, password: e.target.value})} 
                required 
              />
            </div>
            {authError && <p style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '0.5rem' }}>{authError}</p>}
            <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '1.5rem', padding: '0.75rem' }}>
              {t.signIn}
            </button>
          </form>

          <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', textAlign: 'center' }}>
              {t.demoAccount} Quick Access
            </p>
            <button 
              className="btn-secondary" 
              style={{ width: '100%' }}
              onClick={() => { setLoginForm({ username: 'admin', password: 'admin@carrot' }); }}
            >
              {t.demoAccount}
            </button>
          </div>

          <div style={{ marginTop: '2rem', fontSize: '0.7rem', color: 'var(--text-secondary)', textAlign: 'center', opacity: 0.7 }}>
            <p>© 2026 Carrot Design Atelier.<br/>All rights reserved.</p>
          </div>
        </div>
      </div>
    );
  }


  const NAV_ITEMS = [
    { id: 'yield-report', label: t.yieldReport, roles: ['admin', 'demo01', 'user'] },
    { id: 'lot-overview', label: t.lotOverview, roles: ['admin', 'demo01', 'user'] },
    { id: 'statistical-analysis', label: t.statsAnalysis, roles: ['admin', 'demo01'] },
    { id: 'data-report', label: t.dataReport, roles: ['admin', 'demo01'] },
    { id: 'user-management', label: t.userManagement, roles: ['admin'] },
    { id: 'system-status', label: t.systemStatus, roles: ['admin'] }
  ].filter(item => item.roles.includes(user?.user_group || 'user'));

  return (
    <div className={`dashboard ${!isSidebarOpen ? 'sidebar-collapsed' : ''}`}>
      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <BarChart3 size={28} color="var(--accent-color)" />
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{t.title}</h2>
          </div>
          <button className="btn-icon mobile-only" onClick={() => setIsSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <div style={{ marginBottom: '1.5rem' }}></div>

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

          <button 
            className="btn-primary" 
            onClick={() => {
              setHasSearched(true);
              fetchReport(1);
            }}
            style={{ width: '100%', marginTop: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: 'var(--accent-color)' }}
          >
            <Play size={16} /> GO
          </button>
        </div>

        <button 
          className="btn-danger" 
          onClick={handleLogout}
          style={{ marginTop: '1rem', width: '100%' }}
        >
          <LogOut size={16} /> {t.logout}
        </button>

        <div className="sidebar-footer" style={{ marginTop: 'auto', paddingTop: '2rem', fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
          <p>© 2026 Carrot Design Atelier.<br/>All rights reserved.</p>
        </div>
      </aside>

      <main className="main-content">
        <header className="header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button className="btn-icon" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
              <Menu size={20} />
            </button>
            <nav className="nav-tabs" style={{ marginBottom: 0 }}>
            {NAV_ITEMS.map(tab => (
              <div 
                key={tab.id}
                className={`nav-tab ${view === tab.id ? 'active' : ''}`}
                onClick={() => setView(tab.id as any)}
              >
                {tab.label}
              </div>
            ))}
            </nav>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            {/* User Info */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.2 }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{t.welcome}</div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{user?.name}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--accent-color)', opacity: 0.8 }}>Group: {user?.user_group}</div>
            </div>
          
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
        </div>
      </header>

        {licenseWarning && (
          <div className="glass-card" style={{ 
            margin: '1rem', 
            background: 'rgba(239, 68, 68, 0.1)', 
            border: '1px solid #ef4444', 
            color: '#ef4444',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.75rem 1rem'
          }}>
            <ShieldCheck size={20} />
            <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{licenseWarning}</span>
            <button onClick={() => setLicenseWarning(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </div>
        )}

        {!hasSearched && view === 'lot-overview' ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 150px)', opacity: 0.5 }}>
            <BarChart3 size={64} style={{ marginBottom: '1rem' }} />
            <h3>請選擇過濾條件並點擊 GO 開始查詢</h3>
          </div>
        ) : (
          <>
            {view === 'yield-report' && (
              <div className="grid" style={{ gridTemplateColumns: '1.5fr 1fr' }}>
                <div className="glass-card">
                  <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <LayoutGrid size={22} color="var(--accent-color)" />
                    {t.lotYield} (Top 25)
                  </h3>
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>{t.lot}</th>
                          <th>{t.product}</th>
                          <th>Yield (%)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loadingYield ? (
                          <tr><td colSpan={3} style={{ textAlign: 'center', padding: '2rem' }}>{t.loading}</td></tr>
                        ) : yieldLots.length === 0 ? (
                          <tr><td colSpan={3} style={{ textAlign: 'center', padding: '2rem' }}>{t.noRecords}</td></tr>
                        ) : yieldLots.map(l => (
                          <tr 
                            key={l.lot_id} 
                            onClick={() => setSelectedYieldLot(l.lot_id)}
                            style={{ 
                              cursor: 'pointer', 
                              background: selectedYieldLot === l.lot_id ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                              transition: 'all 0.2s'
                            }}
                          >
                            <td style={{ fontWeight: 600 }}>{l.lot_id}</td>
                            <td><span className="badge" style={{ background: 'var(--nav-hover)' }}>{l.product_id}</span></td>
                            <td style={{ color: l.yield < 98 ? '#ef4444' : '#22c55e', fontWeight: 600 }}>
                              {l.yield.toFixed(2)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                
                <div className="glass-card">
                  <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Activity size={22} color="var(--accent-color)" />
                    {t.waferYield} - {selectedYieldLot || '---'}
                  </h3>
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Wafer ID</th>
                          <th>Yield (%)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {yieldWafers.length === 0 ? (
                          <tr><td colSpan={2} style={{ textAlign: 'center', padding: '2rem' }}>{t.noRecords}</td></tr>
                        ) : yieldWafers.map(w => (
                          <tr key={w.wafer_id}>
                            <td>{w.wafer_id}</td>
                            <td style={{ color: w.yield < 98 ? '#ef4444' : '#22c55e', fontWeight: 600 }}>
                              {w.yield.toFixed(2)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

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

        {view === 'user-management' && (
          <div className="user-management-view">
            <div className="grid" style={{ gridTemplateColumns: showAddUserForm && user?.user_group === 'admin' ? '2fr 1fr' : '1fr', gap: '2rem' }}>
              <div className="glass-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0 }}>{t.userManagement}</h3>
                  {user?.user_group === 'admin' && (
                    <button className="btn-primary" onClick={() => setShowAddUserForm(!showAddUserForm)}>
                      {showAddUserForm ? '取消新增' : t.addUser}
                    </button>
                  )}
                </div>
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>ID</th>

                        <th>{t.username}</th>
                        <th>{t.group}</th>
                        {user?.user_group === 'admin' && <th>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {Array.isArray(users) && users.map(u => (
                        <tr key={u.id}>
                          <td>{u.id}</td>

                          <td>{u.username}</td>
                          <td><span className="badge" style={{ background: u.user_group === 'admin' ? 'var(--accent-color)' : 'rgba(255,255,255,0.1)' }}>{u.user_group}</span></td>
                          {user?.user_group === 'admin' && (
                            <td>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button className="btn-icon" title="Edit User" onClick={() => handleEditUser(u)} style={{ padding: '4px' }}>
                                  <Settings size={14} />
                                </button>
                                <button className="btn-icon" title="Reset Password" onClick={() => handleResetPassword(u.id)} style={{ padding: '4px' }}>
                                  <RefreshCw size={14} />
                                </button>
                                <button className="btn-icon" title="Delete User" onClick={() => handleDeleteUser(u.id)} style={{ padding: '4px', color: '#ef4444' }}>
                                  <Package size={14} />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {showAddUserForm && user?.user_group === 'admin' && (
                <div className="glass-card" style={{ height: 'fit-content' }}>
                  <h3 style={{ marginTop: 0 }}>{t.addUser}</h3>
                  <form onSubmit={handleAddUser}>

                    <div className="control-group" style={{ marginTop: '1rem' }}>
                      <label>{t.username}</label>
                      <input type="text" value={newUserForm.username} onChange={e => setNewUserForm({...newUserForm, username: e.target.value, email: e.target.value})} required />
                    </div>
                    <div className="control-group" style={{ marginTop: '1rem' }}>
                      <label>{t.password}</label>
                      <input type="password" value={newUserForm.password} onChange={e => setNewUserForm({...newUserForm, password: e.target.value})} required />
                    </div>
                    <div className="control-group" style={{ marginTop: '1rem' }}>
                      <label>{t.group}</label>
                      <select value={newUserForm.userGroup} onChange={e => setNewUserForm({...newUserForm, userGroup: e.target.value})}>
                        <option value="demo01">demo01</option>
                        <option value="admin">admin</option>
                      </select>
                    </div>
                    <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '1.5rem' }} disabled={userActionLoading}>
                      {userActionLoading ? t.loading : t.addUser}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'ai-assistant' && (
          <div className="ai-assistant-view">
            <div className="glass-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
              <Bot size={64} color="var(--accent-color)" style={{ marginBottom: '2rem' }} />
              <h2 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>{t.aiAssistant}</h2>
              <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto 3rem' }}>
                您的智能晶圓數據助手已經就緒。點擊右下角的對話圖標，或是點擊下方按鈕開始對話。
                我可以幫您搜尋晶圓狀態、分析參數趨勢以及回答製程相關問題。
              </p>
              <button 
                className="btn-primary" 
                style={{ padding: '1rem 3rem', fontSize: '1.1rem' }}
                onClick={() => window.dispatchEvent(new CustomEvent('open-ai-assistant'))}
              >
                立即開始對話
              </button>
            </div>
          </div>
        )}

        {view === 'system-status' && (
          <div className="system-status-view">
            <div className="glass-card" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Activity color="var(--accent-color)" /> {t.systemStatus}
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                  {systemInfo?.system_name} - Version {systemInfo?.system_version}
                </p>
              </div>
              <button className="btn-icon" onClick={fetchSystemInfo} disabled={loadingSystem}>
                <RefreshCw className={loadingSystem ? 'spin' : ''} size={20} />
              </button>
            </div>

            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
              {/* Service Cards */}
              {systemInfo && Object.entries(systemInfo.services).map(([name, info]: [string, any]) => (
                <div key={name} className="glass-card service-card" style={{ borderLeft: '4px solid var(--accent-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Cpu size={20} />
                      <h3 style={{ margin: 0, textTransform: 'capitalize' }}>{name}</h3>
                    </div>
                    <span className="badge" style={{ background: info.status.includes('UP') || info.status === 'Running' ? '#22c55e' : '#ef4444' }}>
                      {info.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <div style={{ marginBottom: '0.5rem' }}>{t.version}: <span style={{ color: 'var(--text-primary)' }}>{info.version}</span></div>
                    {info.endpoint && <div style={{ wordBreak: 'break-all' }}>Endpoint: {info.endpoint}</div>}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid" style={{ marginTop: '2rem', gridTemplateColumns: '1.5fr 1fr' }}>
              <div className="glass-card">
                <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ShieldCheck size={20} color="#22c55e" /> {t.healthChecks}
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                  {[
                    { label: "Gateway Health", url: "/api/healthz" },
                    { label: "Gateway Ready", url: "/api/readyz" },
                    { label: "Connectivity Test", url: "/api/test-gateway" },
                    { label: "User Service Ready", url: "/api/auth/readyz" },
                    { label: "Wafer BI Meta", url: "/api/meta" },
                    { label: "Metrics (Prometheus)", url: "/api/metrics" }
                  ].map(link => (
                    <a key={link.label} href={link.url} target="_blank" className="btn-page" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none' }}>
                      <span style={{ fontSize: '0.85rem' }}>{link.label}</span>
                      <ExternalLink size={14} />
                    </a>
                  ))}
                </div>
              </div>

              <div className="glass-card">
                <h3 style={{ marginTop: 0 }}>{t.debugTools}</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Use these links to access observability and cluster management UIs.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                  <a href="/jaeger" target="_blank" className="btn-primary" style={{ textAlign: 'center', textDecoration: 'none' }}>
                    Open Jaeger UI
                  </a>
                  <a href="https://argo.carrot-atelier.online" target="_blank" className="btn-page" style={{ textAlign: 'center', textDecoration: 'none', background: 'rgba(255,255,255,0.05)' }}>
                    Open Argo CD
                  </a>
                </div>
              </div>
            </div>
            
            <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {t.lastUpdated}: {new Date(systemInfo?.timestamp).toLocaleString()}
            </div>
          </div>
        )}
      </>
    )}
      </main>
      <AIAssistant />
    </div>
  );
}

export default App;
