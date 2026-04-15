import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, AreaChart, Area
} from 'recharts';
import { 
  LayoutDashboard, BrainCircuit, AlertTriangle, 
  TrendingUp, Clock, Users, Activity, CheckCircle2,
  LogOut, Lock, Github, RefreshCw, Filter, Download,
  ArrowUpRight, ArrowDownRight, X
} from 'lucide-react';

// --- Components ---
const Card = ({ children, className = '' }: { children: React.ReactNode, className?: string }) => (
  <div className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden ${className}`}>
    {children}
  </div>
);

const KPICard = ({ title, value, icon: Icon, trend, status = 'neutral', onClick }: any) => {
  const statusColors = {
    good: 'text-green-600 bg-green-50',
    warning: 'text-amber-600 bg-amber-50',
    critical: 'text-red-600 bg-red-50',
    neutral: 'text-blue-600 bg-blue-50'
  };

  return (
    <Card className={`p-6 ${onClick ? 'cursor-pointer hover:border-blue-300 transition-colors' : ''}`}>
      <div className="flex items-center justify-between mb-4" onClick={onClick}>
        <h3 className="text-sm font-medium text-gray-500">{title}</h3>
        <div className={`p-2 rounded-lg ${statusColors[status as keyof typeof statusColors]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="flex items-baseline gap-2" onClick={onClick}>
        <span className="text-3xl font-bold text-gray-900">{value}</span>
        {trend && (
          <span className={`flex items-center text-sm font-medium ${trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-600' : 'text-gray-500'}`}>
            {trend > 0 ? <ArrowUpRight className="w-4 h-4 mr-1" /> : trend < 0 ? <ArrowDownRight className="w-4 h-4 mr-1" /> : null}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
    </Card>
  );
};

// --- Main App ---
export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('jwt_token'));
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'ai-model'>('dashboard');
  
  // Login State
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('password');
  const [loginError, setLoginError] = useState('');

  // Dashboard State
  const [metrics, setMetrics] = useState<any>(null);
  const [trends, setTrends] = useState<any[]>([]);
  const [ranking, setRanking] = useState<any[]>([]);
  const [compare, setCompare] = useState<any[]>([]);
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
      setLoginError('Login failed. Server unreachable.');
    }
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('jwt_token');
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
    if (!token) return;
    const headers = { 'Authorization': `Bearer ${token}` };
    setIsLoading(true);
    setError('');
    
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
        handleLogout();
        return;
      }

      const velData = await velRes.json();
      const burnData = await burnRes.json();
      const cycleData = await cycleRes.json();
      const leadData = await leadRes.json();
      const prodData = await prodRes.json();
      const aiData = await aiRes.json();

      // Calculate total productivity points
      const totalProductivity = Array.isArray(prodData) 
        ? prodData.reduce((acc: number, curr: any) => acc + (curr._sum?.storyPoints || 0), 0)
        : 0;

      setMetrics({
        velocity: velData.velocity || 0,
        cycleTime: cycleData.cycleTime || 0,
        leadTime: leadData.leadTime || 0,
        productivity: totalProductivity,
        healthStatus: 'Good' // Mocked for now
      });
      
      setBurndownData(Array.isArray(burnData) ? burnData : []);
      setProductivityData(Array.isArray(prodData) ? prodData : []);
      setAiInsights(aiData);
      
      // Clear out the other states since we removed the mock endpoints
      setTrends([]);
      setRanking([]);
      setCompare([]);
      setAtRiskIssues([]);
    } catch (error) {
      console.error("Failed to fetch dashboard data", error);
      setError('Failed to load dashboard data. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrilldown = async (type: string, title: string) => {
    if (!token) return;
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
    setIsSyncing(true);
    setSyncMessage('');
    try {
      const res = await fetch(`${API_BASE}/api/github/sync`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ repoOwner: 'facebook', repoName: 'react' }) // Example repo
      });
      const data = await res.json();
      if (res.ok) {
        setSyncMessage(data.message);
      } else {
        setSyncMessage(`Error: ${data.error}`);
      }
    } catch (err) {
      setSyncMessage('Failed to sync with GitHub.');
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
              <button 
                onClick={handleGitHubSync}
                disabled={isSyncing}
                className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors text-sm font-medium"
              >
                {isSyncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Github className="w-4 h-4" />}
                {isSyncing ? 'Syncing...' : 'Sync GitHub'}
              </button>
            </div>
          </div>

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
              <option>Project Alpha</option>
              <option>Project Beta</option>
            </select>
            <select 
              value={timeRange} 
              onChange={e => setTimeRange(e.target.value)}
              className="text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 outline-none p-2"
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>
        </div>

        {syncMessage && (
          <div className="p-4 bg-blue-50 text-blue-700 rounded-lg border border-blue-200 text-sm">
            {syncMessage}
          </div>
        )}

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
                <tr className="border-b border-gray-200">
                  <th className="pb-3 text-sm font-semibold text-gray-500">Issue ID</th>
                  <th className="pb-3 text-sm font-semibold text-gray-500">Title</th>
                  <th className="pb-3 text-sm font-semibold text-gray-500">Time in Progress</th>
                  <th className="pb-3 text-sm font-semibold text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {atRiskIssues.length > 0 ? atRiskIssues.map((issue: any) => (
                  <tr key={issue.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="py-4 font-medium text-blue-600">{issue.id}</td>
                    <td className="py-4 text-gray-900">{issue.title}</td>
                    <td className="py-4 text-amber-600 font-medium">{issue.timeInProgress}</td>
                    <td className="py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                        ${issue.status === 'Blocked' ? 'bg-red-100 text-red-800' : 
                          issue.status === 'Review' ? 'bg-blue-100 text-blue-800' : 
                          'bg-amber-100 text-amber-800'}`}>
                        {issue.status}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-gray-500">No at-risk issues found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sprint Burndown Chart */}
          <Card className="p-6 lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Sprint Burndown</h3>
              {burndownData && burndownData.filter(d => d.actual !== null).pop()?.deviation > 5 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                  <AlertTriangle className="w-3 h-3" /> Sprint Off Track
                </span>
              )}
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={burndownData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} />
                  <Tooltip 
                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-100">
                            <p className="font-semibold text-gray-900 mb-2">{label}</p>
                            <div className="space-y-1 text-sm">
                              <p className="text-gray-500">
                                <span className="inline-block w-3 h-3 rounded-full bg-gray-400 mr-2"></span>
                                Ideal: <span className="font-medium text-gray-900">{data.ideal} pts</span>
                              </p>
                              {data.actual !== null && (
                                <p className="text-blue-600">
                                  <span className="inline-block w-3 h-3 rounded-full bg-blue-500 mr-2"></span>
                                  Actual: <span className="font-medium">{data.actual} pts</span>
                                </p>
                              )}
                              {data.deviation !== null && data.deviation > 0 && (
                                <p className="text-red-600 mt-2 pt-2 border-t border-gray-100">
                                  <AlertTriangle className="w-3 h-3 inline mr-1" />
                                  Behind by {data.deviation} pts
                                </p>
                              )}
                              {data.deviation !== null && data.deviation < 0 && (
                                <p className="text-green-600 mt-2 pt-2 border-t border-gray-100">
                                  <CheckCircle2 className="w-3 h-3 inline mr-1" />
                                  Ahead by {Math.abs(data.deviation)} pts
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                  <Line 
                    type="linear" 
                    dataKey="ideal" 
                    stroke="#9ca3af" 
                    strokeWidth={2} 
                    strokeDasharray="5 5" 
                    dot={false}
                    name="Ideal" 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="actual" 
                    stroke="#3b82f6" 
                    strokeWidth={3} 
                    dot={(props: any) => {
                      const { cx, cy, payload, index } = props;
                      if (payload.actual === null) return <React.Fragment key={index} />;
                      if (payload.deviation > 5) {
                        return <circle key={index} cx={cx} cy={cy} r={6} fill="#ef4444" stroke="#fff" strokeWidth={2} />;
                      }
                      return <circle key={index} cx={cx} cy={cy} r={4} fill="#3b82f6" stroke="#fff" strokeWidth={2} />;
                    }}
                    activeDot={{ r: 6 }}
                    name="Actual" 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Velocity Chart */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Sprint Velocity</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[{ name: 'Current Sprint', velocity: metrics.velocity }]}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} />
                  <Tooltip cursor={{fill: '#f3f4f6'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                  <Bar dataKey="velocity" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Velocity (pts)" barSize={60} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Team Productivity */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Team Productivity</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={productivityData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} />
                  <YAxis dataKey="userName" type="category" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} width={100} />
                  <Tooltip cursor={{fill: '#f3f4f6'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                  <Legend />
                  <Bar dataKey="_sum.storyPoints" fill="#10b981" radius={[0, 4, 4, 0]} name="Story Points" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>
    );
  };

  const renderAIModel = () => {
    const pythonCode = `
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier, GradientBoostingRegressor
import google.generativeai as genai
import os

class AgileAIModel:
    def __init__(self):
        # ML Models
        self.risk_classifier = RandomForestClassifier(n_estimators=100, random_state=42)
        self.delay_regressor = GradientBoostingRegressor(n_estimators=100, random_state=42)
        
        # LLM Setup
        genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
        self.llm_model = genai.GenerativeModel('gemini-3.1-flash-preview')
        
    def predict_and_analyze(self, sprint_data):
        """
        Combined ML + LLM approach:
        1. ML predicts risk probability and delay days.
        2. LLM generates root cause analysis and recommendations based on ML output.
        """
        df = pd.DataFrame([sprint_data])
        features = df[['velocity_trend', 'backlog_size', 'issue_aging', 'cycle_time_avg']]
        
        # 1. ML Predictions
        risk_prob = self.risk_classifier.predict_proba(features)[0][1]
        predicted_delay = self.delay_regressor.predict(features)[0]
        
        # 2. LLM Root Cause Analysis
        prompt = f"""
        Analyze these Agile metrics and ML predictions:
        - Velocity Trend: {sprint_data['velocity_trend']}
        - Cycle Time Avg: {sprint_data['cycle_time_avg']} days
        - ML Risk Probability: {risk_prob * 100:.1f}%
        - ML Predicted Delay: {predicted_delay:.1f} days
        
        Provide a 1-sentence root cause analysis and 3 actionable recommendations.
        """
        
        response = self.llm_model.generate_content(prompt)
        
        return {
            "ml_risk_probability": float(risk_prob),
            "ml_predicted_delay": float(predicted_delay),
            "llm_insights": response.text
        }
    `;

    return (
      <Card className="p-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">AI Module (ML + LLM Combined)</h2>
          <p className="text-gray-600 mt-2">
            This Python snippet demonstrates how the separate AI microservice combines <code>scikit-learn</code> for quantitative predictions (classification & regression) with the <code>Gemini API</code> for qualitative root cause analysis and actionable recommendations.
          </p>
        </div>
        <div className="bg-gray-900 rounded-xl p-6 overflow-x-auto">
          <pre className="text-gray-100 text-sm font-mono leading-relaxed">
            <code>{pythonCode}</code>
          </pre>
        </div>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3 text-blue-600">
            <Activity className="w-8 h-8" />
            <span className="text-xl font-bold text-gray-900 tracking-tight">AgileAI</span>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'dashboard' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('ai-model')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'ai-model' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <BrainCircuit className="w-5 h-5" />
            AI Model Code
          </button>
        </nav>
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3 px-4 py-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user?.name || 'User'}</p>
              <p className="text-xs text-gray-500 truncate">{user?.role || 'Role'}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto w-full relative">
        <div className="max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8">
          {activeTab === 'dashboard' && renderDashboard()}
          {activeTab === 'ai-model' && renderAIModel()}
        </div>

        {/* Drilldown Modal */}
        {isDrilldownOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
            <Card className="w-full max-w-2xl max-h-[80vh] flex flex-col shadow-xl">
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900">{drilldownTitle}</h3>
                <button onClick={() => setIsDrilldownOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto flex-1">
                {!drilldownData ? (
                  <div className="flex justify-center items-center h-32">
                    <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
                  </div>
                ) : drilldownData.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">No detailed data available.</div>
                ) : (
                  <div className="space-y-4">
                    {drilldownData.map((item: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                        <div>
                          <div className="font-medium text-gray-900">{item.id} - {item.title}</div>
                          <div className="text-sm text-gray-500 mt-1">Status: {item.status}</div>
                        </div>
                        <div className="text-right">
                          {item.points && <div className="font-bold text-blue-600">{item.points} pts</div>}
                          {item.cycleTime && <div className="font-bold text-amber-600">{item.cycleTime}</div>}
                          {item.completedAt && <div className="text-xs text-gray-500 mt-1">{item.completedAt}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
