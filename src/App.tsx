import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from 'recharts';
import { 
  TrendingUp, Clock, Activity, Users, AlertTriangle, CheckCircle2, 
  Download, Filter, RefreshCw, Github, BrainCircuit, Lock, X
} from 'lucide-react';

// --- Shared UI Components ---
const Card = ({ children, className = '', onClick }: { children: React.ReactNode, className?: string, onClick?: () => void }) => (
  <div className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden ${className}`} onClick={onClick}>
    {children}
  </div>
);

const KPICard = ({ title, value, icon: Icon, status, onClick }: any) => (
  <Card className="p-6 cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
      </div>
      <div className={`p-3 rounded-xl ${
        status === 'good' ? 'bg-green-100 text-green-600' : 
        status === 'warning' ? 'bg-amber-100 text-amber-600' : 
        'bg-red-100 text-red-600'
      }`}>
        <Icon className="w-6 h-6" />
      </div>
    </div>
  </Card>
);

const Modal = ({ isOpen, onClose, title, children }: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

// --- Main Application ---
export default function App() {
  // Auth State
  const [token, setToken] = useState(localStorage.getItem('jwt_token') || '');
  const [user, setUser] = useState<any>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Dashboard State
  const [metrics, setMetrics] = useState<any>(null);
  const [aiInsights, setAiInsights] = useState<any>(null);
  const [atRiskIssues, setAtRiskIssues] = useState<any[]>([]);
  const [burndownData, setBurndownData] = useState<any[]>([]);
  const [productivityData, setProductivityData] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters State
  const [selectedProject, setSelectedProject] = useState('All Projects');
  const [sprints, setSprints] = useState<any[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState<string>('');
  const [timeRange, setTimeRange] = useState('30d');
  const [githubUrl, setGithubUrl] = useState('');

  // Drilldown State
  const [drilldownData, setDrilldownData] = useState<any[] | null>(null);
  const [isDrilldownOpen, setIsDrilldownOpen] = useState(false);
  const [drilldownTitle, setDrilldownTitle] = useState('');

  // API Base URL for Vercel deployment
  const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

  // --- Auth Logic ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok) {
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('jwt_token', data.token);
      } else {
        setLoginError(data.error);
      }
    } catch (err) {
      setLoginError('Failed to connect to server.');
    }
  };

  // --- Data Fetching ---
  const fetchSprints = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/sprints`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSprints(data);
        if (data.length > 0 && !selectedSprintId) {
          setSelectedSprintId(data[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to fetch sprints", err);
    }
  };

  const fetchDashboardData = async () => {
    setIsLoading(true);
    setError('');
    
    const headers = { 'Authorization': `Bearer ${token}` };

    try {
      const queryParam = selectedSprintId ? `?sprintId=${selectedSprintId}` : '';
      const [velRes, burnRes, cycleRes, leadRes, prodRes, aiRes] = await Promise.all([
        fetch(`${API_BASE}/api/metrics/velocity${queryParam}`, { headers }),
        fetch(`${API_BASE}/api/metrics/burndown${queryParam}`, { headers }),
        fetch(`${API_BASE}/api/metrics/cycle-time${queryParam}`, { headers }),
        fetch(`${API_BASE}/api/metrics/lead-time${queryParam}`, { headers }),
        fetch(`${API_BASE}/api/metrics/productivity${queryParam}`, { headers }),
        fetch(`${API_BASE}/api/ai/insights${queryParam}`, { headers })
      ]);

      if (velRes.status === 401 || velRes.status === 403) {
        setToken('');
        localStorage.removeItem('jwt_token');
        return;
      }

      if (!velRes.ok || !burnRes.ok || !cycleRes.ok || !leadRes.ok || !prodRes.ok || !aiRes.ok) {
        throw new Error('Failed to fetch one or more metrics');
      }

      const [velData, burnData, cycleData, leadData, prodData, aiData] = await Promise.all([
        velRes.json(), burnRes.json(), cycleRes.json(), leadRes.json(), prodRes.json(), aiRes.json()
      ]);

      setMetrics({
        velocity: velData.velocity,
        cycleTime: cycleData.cycleTime,
        leadTime: leadData.leadTime,
        productivity: prodData.reduce((acc: number, curr: any) => acc + curr.completedPoints, 0),
        healthStatus: aiData.riskPercentage > 60 ? 'At Risk' : 'Healthy'
      });

      setBurndownData(burnData);
      setProductivityData(prodData);
      setAiInsights(aiData);
      
      // Mock at-risk issues for now (can be replaced with real data later)
      setAtRiskIssues([
        { id: 'TASK-102', title: 'Implement OAuth2', status: 'In Progress', daysInStatus: 5, assignee: 'Charlie Dev', riskLevel: 'High' },
        { id: 'TASK-105', title: 'Database Migration', status: 'To Do', daysInStatus: 3, assignee: 'Unassigned', riskLevel: 'Medium' }
      ]);

    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrilldown = async (type: string, title: string) => {
    setDrilldownTitle(title);
    setIsDrilldownOpen(true);
    setDrilldownData(null); // Loading state
    
    try {
      const res = await fetch(`${API_BASE}/api/issues/drilldown?type=${type}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setDrilldownData(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch drilldown data", err);
    }
  };

  const handleExport = () => {
    // Basic CSV export simulation
    const csvContent = "data:text/csv;charset=utf-8,Metric,Value\nVelocity," + metrics?.velocity + "\nLead Time," + metrics?.leadTime;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "dashboard_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    if (token) {
      fetchSprints();
    }
  }, [token]);

  useEffect(() => {
    if (token && (selectedSprintId || sprints.length === 0)) {
      fetchDashboardData();
    }
  }, [token, selectedSprintId]);

  const handleGitHubSync = async () => {
    const regex = /github\.com\/([^\/]+)\/([^\/]+)/;
    const match = githubUrl.match(regex);
    
    if (!match) {
      alert('Vui lòng nhập URL GitHub hợp lệ (VD: https://github.com/facebook/react)');
      return;
    }

    const repoOwner = match[1];
    const repoName = match[2].replace(/\.git$/, '').replace(/\/$/, '');

    setIsSyncing(true);
    setSyncMessage('');
    try {
      const res = await fetch(`${API_BASE}/api/github/sync`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ repoOwner, repoName })
      });
      const data = await res.json();
      if (res.ok) {
        setSyncMessage(data.message || 'Đồng bộ thành công!');
        fetchSprints();
      } else {
        setSyncMessage(`Lỗi: ${data.error}`);
      }
    } catch (err) {
      setSyncMessage('Lỗi kết nối đến server.');
    } finally {
      setIsSyncing(false);
    }
  };

  // --- Views ---
  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8">
          <div className="flex justify-center mb-6">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
              <Lock className="w-8 h-8" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">Sign in to AgileAI</h2>
          {loginError && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">{loginError}</div>}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input 
                type="text" 
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <button type="submit" className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
              Sign In
            </button>
            <p className="text-xs text-gray-500 text-center mt-4">
              Demo accounts: admin/password, manager/password, dev/password
            </p>
          </form>
        </Card>
      </div>
    );
  }

  const renderDashboard = () => {
    if (isLoading) {
      return (
        <div className="space-y-6 animate-pulse">
          <div className="h-10 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1,2,3,4].map(i => <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-80 bg-gray-200 rounded-xl"></div>
            <div className="h-80 bg-gray-200 rounded-xl"></div>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 text-red-600 mb-4">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h2>
          <p className="text-gray-500 mb-4">{error}</p>
          <button onClick={fetchDashboardData} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Try Again
          </button>
        </div>
      );
    }

    if (!metrics || !aiInsights) return <div className="p-8 text-center text-gray-500">No data available.</div>;

    return (
      <div className="space-y-6">
        {/* Header & Filters */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Project Health Dashboard</h1>
              <p className="text-gray-500 mt-1">Real-time agile metrics and AI-driven insights</p>
            </div>
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium border text-sm
                ${metrics.healthStatus === 'Healthy' ? 'bg-green-50 text-green-700 border-green-200' : 
                  metrics.healthStatus === 'At Risk' ? 'bg-amber-50 text-amber-700 border-amber-200' : 
                  'bg-red-50 text-red-700 border-red-200'}`}>
                {metrics.healthStatus === 'Healthy' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                Status: {metrics.healthStatus}
              </div>
              <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
                <Download className="w-4 h-4" /> Export
              </button>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="https://github.com/owner/repo"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-64"
                />
                <button 
                  onClick={handleGitHubSync}
                  disabled={isSyncing || !githubUrl}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors text-sm font-medium shrink-0"
                >
                  {isSyncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Github className="w-4 h-4" />}
                  {isSyncing ? 'Đang phân tích...' : 'Phân tích Dự án'}
                </button>
              </div>
            </div>
          </div>

          {syncMessage && (
            <div className={`p-3 rounded-lg text-sm font-medium ${syncMessage.includes('Lỗi') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              {syncMessage}
            </div>
          )}

          {/* Filters Bar */}
          <div className="flex flex-wrap items-center gap-4 p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 text-gray-500">
              <Filter className="w-4 h-4" />
              <span className="text-sm font-medium">Filters:</span>
            </div>
            <select 
              value={selectedSprintId} 
              onChange={e => setSelectedSprintId(e.target.value)}
              className="text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 outline-none p-2"
            >
              {sprints.map(sprint => (
                <option key={sprint.id} value={sprint.id}>
                  {sprint.name} ({new Date(sprint.startDate).toLocaleDateString()} - {new Date(sprint.endDate).toLocaleDateString()})
                </option>
              ))}
            </select>
            <select 
              value={selectedProject} 
              onChange={e => setSelectedProject(e.target.value)}
              className="text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 outline-none p-2"
            >
              <option>All Projects</option>
              <option>Frontend Redesign</option>
              <option>API Migration</option>
            </select>
            <select 
              value={timeRange} 
              onChange={e => setTimeRange(e.target.value)}
              className="text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 outline-none p-2"
            >
              <option value="7d">Last 7 Days</option>
              <option value="14d">Last 14 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KPICard title="Velocity (Avg)" value={`${metrics.velocity} pts`} icon={TrendingUp} status="good" onClick={() => handleDrilldown('velocity', 'Velocity Details')} />
          <KPICard title="Lead Time" value={`${metrics.leadTime} days`} icon={Clock} status="warning" onClick={() => handleDrilldown('leadTime', 'Lead Time Details')} />
          <KPICard title="Cycle Time" value={`${metrics.cycleTime} days`} icon={Activity} status="warning" onClick={() => handleDrilldown('cycleTime', 'Cycle Time Details')} />
          <KPICard title="Productivity" value={`${metrics.productivity} pts`} icon={Users} status="good" onClick={() => handleDrilldown('productivity', 'Productivity Details')} />
        </div>

        {/* AI Insights Panel */}
        <Card className={`border-l-4 ${
          aiInsights.riskPercentage > 70 ? 'border-l-red-500 bg-red-50/30' :
          aiInsights.riskPercentage >= 30 ? 'border-l-amber-500 bg-amber-50/30' :
          'border-l-green-500 bg-green-50/30'
        }`}>
          <div className="p-6">
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-xl shrink-0 ${
                aiInsights.riskPercentage > 70 ? 'bg-red-100 text-red-600 animate-pulse' :
                aiInsights.riskPercentage >= 30 ? 'bg-amber-100 text-amber-600' :
                'bg-green-100 text-green-600'
              }`}>
                <BrainCircuit className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold text-gray-900">AI Sprint Risk Analysis</h2>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                    aiInsights.riskPercentage > 70 ? 'bg-red-100 text-red-800' :
                    aiInsights.riskPercentage >= 30 ? 'bg-amber-100 text-amber-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    Risk: {aiInsights.riskPercentage}%
                  </span>
                </div>
                <p className="text-gray-800 font-medium text-lg">
                  {aiInsights.analysis}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* At Risk Issues Table */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            At Risk Issues
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-sm text-gray-500">
                  <th className="pb-3 font-medium">Issue</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Days in Status</th>
                  <th className="pb-3 font-medium">Assignee</th>
                  <th className="pb-3 font-medium">Risk Level</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {atRiskIssues.map((issue, i) => (
                  <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="py-4 font-medium text-blue-600 cursor-pointer hover:underline">{issue.id}: {issue.title}</td>
                    <td className="py-4">
                      <span className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                        {issue.status}
                      </span>
                    </td>
                    <td className="py-4 text-gray-600">{issue.daysInStatus} days</td>
                    <td className="py-4 text-gray-600">{issue.assignee}</td>
                    <td className="py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        issue.riskLevel === 'High' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {issue.riskLevel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Sprint Burndown</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={burndownData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Line type="monotone" dataKey="ideal" stroke="#9ca3af" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Ideal Burndown" />
                  <Line type="monotone" dataKey="actual" stroke="#3b82f6" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}} name="Actual Remaining" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Team Productivity</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={productivityData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="userName" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} />
                  <RechartsTooltip 
                    cursor={{fill: '#f3f4f6'}}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="completedPoints" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Completed Points" barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Top Navigation */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
                AgileAI
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium text-gray-600">
                  {user?.name?.charAt(0) || 'U'}
                </div>
                <span className="text-sm font-medium text-gray-700 hidden sm:block">{user?.name}</span>
                <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-md font-medium">{user?.role}</span>
              </div>
              <button 
                onClick={() => { setToken(''); localStorage.removeItem('jwt_token'); }}
                className="text-sm text-gray-500 hover:text-gray-700 font-medium"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderDashboard()}
      </main>

      {/* Drilldown Modal */}
      <Modal isOpen={isDrilldownOpen} onClose={() => setIsDrilldownOpen(false)} title={drilldownTitle}>
        {!drilldownData ? (
          <div className="flex justify-center p-8">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {drilldownData.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No detailed data available.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {drilldownData.map((item, idx) => (
                  <li key={idx} className="py-3 flex justify-between items-center">
                    <span className="font-medium text-gray-900">{item.title || item.name || `Item ${idx + 1}`}</span>
                    <span className="text-gray-500 text-sm">{JSON.stringify(item.value || item.status)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}