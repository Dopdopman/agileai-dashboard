import React, { useState, useEffect, useRef } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, AreaChart, Area
} from 'recharts';
import { 
  LayoutDashboard, BrainCircuit, AlertTriangle, 
  TrendingUp, Clock, Users, Activity, CheckCircle2,
  LogOut, Lock, RefreshCw, Filter, Download,
  ArrowUpRight, ArrowDownRight, X, Mail, Globe, Hash, Database, Info, Shield
} from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import ReactMarkdown from 'react-markdown';

// --- Components ---
const Card = ({ children, className = '' }: { children: React.ReactNode, className?: string }) => (
  <div className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden ${className}`}>
    {children}
  </div>
);

const KPICard = ({ title, value, icon: Icon, trend, status = 'neutral', onClick, tooltip }: any) => {
  const statusColors = {
    good: 'text-green-600 bg-green-50',
    warning: 'text-amber-600 bg-amber-50',
    critical: 'text-red-600 bg-red-50',
    neutral: 'text-blue-600 bg-blue-50'
  };

  return (
    <Card className={`p-6 ${onClick ? 'cursor-pointer hover:border-blue-300 transition-colors' : ''}`}>
      <div className="flex items-center justify-between mb-4 group relative" onClick={onClick}>
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-gray-500">{title}</h3>
          {tooltip && (
            <>
              <Info className="w-4 h-4 text-gray-400 cursor-help" />
              <div className="absolute top-6 left-0 bg-gray-900 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 w-48 shadow-lg">
                {tooltip}
              </div>
            </>
          )}
        </div>
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
  
  // Jira Sync State
  const [isJiraModalOpen, setIsJiraModalOpen] = useState(false);
  const [jiraDomain, setJiraDomain] = useState('');
  const [jiraEmail, setJiraEmail] = useState('');
  const [jiraToken, setJiraToken] = useState('');
  const [jiraBoardId, setJiraBoardId] = useState('');

  // AI Code Modal State
  const [isAiCodeModalOpen, setIsAiCodeModalOpen] = useState(false);

  // Retrospective State
  const [isRetroModalOpen, setIsRetroModalOpen] = useState(false);
  const [retroReport, setRetroReport] = useState('');
  const [isGeneratingRetro, setIsGeneratingRetro] = useState(false);

  // Scope Creep State
  const [isScopeCreepModalOpen, setIsScopeCreepModalOpen] = useState(false);

  // Drilldown State
  const [drilldownData, setDrilldownData] = useState<{ type: string; items: any[]; total: number } | null>(null);
  const [isDrilldownOpen, setIsDrilldownOpen] = useState(false);
  const [drilldownTitle, setDrilldownTitle] = useState('');

  const printRef = useRef<HTMLDivElement>(null);

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
        return data;
      }
    } catch (err) {
      console.error("Failed to fetch sprints", err);
    }
    return null;
  };

  const fetchDashboardData = async (overrideSprintId?: string) => {
    if (!token) return;
    const headers = { 
      'Authorization': `Bearer ${token}`,
      'Cache-Control': 'no-cache'
    };
    setIsLoading(true);
    setError('');
    
    try {
      const targetSprintId = overrideSprintId || selectedSprintId;
      const timestamp = Date.now();
      const queryParam = targetSprintId ? `?sprintId=${targetSprintId}&t=${timestamp}` : `?t=${timestamp}`;
      
      const targetSprint = sprints.find((s: any) => s.id === targetSprintId);
      const isPastSprint = targetSprint ? new Date(targetSprint.endDate) < new Date() : false;
      const sprintTasks = targetSprint?.tasks || [];
      
      let scopeCreepCountPayload = 0;
      if (!isPastSprint && targetSprint) {
        scopeCreepCountPayload = sprintTasks.filter((t: any) => new Date(t.createdAt) > new Date(targetSprint.startDate)).length || 0;
      }
      
      let inProgressCount = 0;
      let remainingPoints = 0;
      sprintTasks.forEach((task: any) => {
        const statusLower = (task.status || '').toLowerCase();
        if (!(statusLower.includes('done') || statusLower.includes('closed') || statusLower.includes('complete'))) {
          remainingPoints += parseInt(task.storyPoints?.toString() || '0', 10);
          if (['in progress', 'blocked', 'review'].some(s => statusLower.includes(s))) inProgressCount++;
        }
      });

      // 1. Force calculation of At Risk Issues
      let calculatedAtRisk: any[] = [];
      if (!isPastSprint && targetSprint && targetSprint.tasks) {
        calculatedAtRisk = targetSprint.tasks.filter((task: any) => {
          const status = (task.status || '').toLowerCase();
          const isDone = status.includes('done') || status.includes('closed') || status.includes('complete');
          if (isDone) return false; // Bỏ qua task đã xong

          const points = Number(task.storyPoints) || 0;
          
          // Tính số ngày ngâm task
          const createdDate = new Date(task.createdAt || new Date());
          const today = new Date();
          const daysInProg = Math.floor((today.getTime() - createdDate.getTime()) / (1000 * 3600 * 24));

          return points >= 8 || daysInProg >= 3;
        }).map((task: any) => ({
          id: task.id || 'N/A',
          title: task.title,
          timeInProgress: 'High Risk', 
          status: task.status || 'In Progress'
        }));
      }
      setAtRiskIssues(calculatedAtRisk);

      const sprintContext = {
        inProgressCount,
        remainingPoints,
        atRiskDetails: calculatedAtRisk.map(i => `[${i.id}] ${i.title} (Status: ${i.status}, Pending: ${i.timeInProgress})`).join(', ')
      };

      const [velRes, burnRes, cycleRes, leadRes, prodRes, aiRes] = await Promise.all([
        fetch(`${API_BASE}/api/metrics/velocity${queryParam}`, { headers }),
        fetch(`${API_BASE}/api/metrics/burndown${queryParam}`, { headers }),
        fetch(`${API_BASE}/api/metrics/cycle-time${queryParam}`, { headers }),
        fetch(`${API_BASE}/api/metrics/lead-time${queryParam}`, { headers }),
        fetch(`${API_BASE}/api/metrics/productivity${queryParam}`, { headers }),
        fetch(`${API_BASE}/api/ai/insights${queryParam}`, { 
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            scopeCreepCount: scopeCreepCountPayload, 
            atRiskCount: calculatedAtRisk.length,
            sprintContext 
          })
        })
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
        ? prodData.reduce((acc: number, curr: any) => acc + (curr.totalStoryPoints || 0), 0)
        : 0;

      setMetrics({
        velocity: velData.velocity || 0,
        cycleTime: cycleData.cycleTime || 0,
        leadTime: leadData.leadTime || 0,
        productivity: totalProductivity,
        healthStatus: aiData.riskPercentage > 60 ? 'At Risk' : 'Healthy'
      });
      
      setBurndownData(burnData.burndownChart || []);
      setProductivityData(Array.isArray(prodData) ? prodData : []);
      setAiInsights(aiData);
      
      // Clear out the other states since we removed the mock endpoints
      setTrends([]);
      setRanking([]);
      setCompare([]);
    } catch (error) {
      console.error("Failed to fetch dashboard data", error);
      setError('Failed to load dashboard data. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrilldown = (type: string, title: string) => {
    setDrilldownTitle(title);
    setIsDrilldownOpen(true);
    
    // Process purely frontend data from the selected sprint
    const sprint = sprints.find(s => s.id === selectedSprintId);
    if (!sprint || !sprint.tasks) {
      setDrilldownData({ type, items: [], total: 0 });
      return;
    }

    const tasks = sprint.tasks;
    const doneTasks = tasks.filter((t: any) => t.status === 'Done' || t.status === 'closed' || t.status === 'Complete');
    let items: any[] = [];
    let total = 0;

    if (type === 'velocity') {
      items = doneTasks.map((t: any) => ({
        id: t.id,
        title: t.title,
        assignee: t.assignee?.name || 'Unassigned',
        points: Number(t.storyPoints) || 0
      }));
      total = items.reduce((sum, item) => sum + item.points, 0);
    } else if (type === 'leadTime') {
      items = doneTasks.map((t: any) => {
        const created = new Date(t.createdAt);
        const closed = t.completedAt ? new Date(t.completedAt) : new Date();
        const days = Math.max(0, parseFloat(((closed.getTime() - created.getTime()) / (1000 * 3600 * 24)).toFixed(1)));
        return {
          id: t.id,
          title: t.title,
          createdAt: created.toLocaleDateString(),
          closedAt: closed.toLocaleDateString(),
          leadTime: days
        };
      });
      total = items.reduce((sum, item) => sum + item.leadTime, 0) / (items.length || 1);
    } else if (type === 'cycleTime') {
      const startedDoneTasks = doneTasks.filter((t: any) => t.startedAt);
      items = startedDoneTasks.map((t: any) => {
        const started = new Date(t.startedAt);
        const closed = t.completedAt ? new Date(t.completedAt) : new Date();
        const days = Math.max(0, parseFloat(((closed.getTime() - started.getTime()) / (1000 * 3600 * 24)).toFixed(1)));
        return {
          id: t.id,
          title: t.title,
          startedAt: started.toLocaleDateString(),
          closedAt: closed.toLocaleDateString(),
          cycleTime: days
        };
      });
      total = items.reduce((sum, item) => sum + item.cycleTime, 0) / (items.length || 1);
    } else if (type === 'productivity') {
      const assigned = doneTasks.reduce((acc: any, t: any) => {
        const name = t.assignee?.name || 'Unassigned';
        acc[name] = (acc[name] || 0) + (Number(t.storyPoints) || 0);
        return acc;
      }, {});
      items = Object.keys(assigned).map(name => ({
        name,
        points: assigned[name]
      })).sort((a, b) => b.points - a.points);
      total = items.reduce((sum, item) => sum + item.points, 0);
    }

    setDrilldownData({ type, items, total });
  };

  const handleExport = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'Agile-Dashboard-Report',
  });

  const handleGenerateRetro = async () => {
    setIsGeneratingRetro(true);
    setIsRetroModalOpen(true);
    try {
      const targetSprint = sprints.find((s: any) => s.id === selectedSprintId);
      const sprintTasks = targetSprint?.tasks || [];

      const res = await fetch(`${API_BASE}/api/ai/retrospective?sprintId=${selectedSprintId}`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ tasks: sprintTasks })
      });
      const data = await res.json();
      if (res.ok) {
        setRetroReport(data.report);
      } else {
        setRetroReport(`Error: ${data.error}`);
      }
    } catch (error) {
      setRetroReport('Failed to generate retrospective.');
    } finally {
      setIsGeneratingRetro(false);
    }
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

  const handleJiraSync = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jiraDomain || !jiraEmail || !jiraToken || !jiraBoardId) {
      alert('Please fill out all Jira information fields.');
      return;
    }

    setIsSyncing(true);
    setSyncMessage('');
    try {
      const res = await fetch(`${API_BASE}/api/jira/sync`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          domain: jiraDomain, 
          email: jiraEmail, 
          apiToken: jiraToken, 
          boardId: jiraBoardId 
        })
      });
      const data = await res.json();
      if (res.ok) {
        setSyncMessage(data.message || 'Successfully synced Jira data!');
        setIsJiraModalOpen(false);
        const newSprints = await fetchSprints();
        if (newSprints && newSprints.length > 0) {
          const latestSprintId = newSprints[0].id;
          setSelectedSprintId(latestSprintId);
          await fetchDashboardData(latestSprintId);
        } else {
          await fetchDashboardData();
        }
      } else {
        setSyncMessage(`Error: ${data.error}`);
        setIsJiraModalOpen(false);
      }
    } catch (err) {
      setSyncMessage('Failed to connect to server.');
      setIsJiraModalOpen(false);
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
          <button onClick={() => fetchDashboardData()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Try Again
          </button>
        </div>
      );
    }

    if (!metrics || !aiInsights) return <div className="p-8 text-center text-gray-500">No data available.</div>;

    // Calculate historical velocity based on all sprints
    const velocityData = [...sprints]
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()) // Xếp tăng dần
      .map(sprint => {
        const donePoints = (sprint.tasks || []).reduce((sum: number, task: any) => {
          if (task.status === 'Done' || task.status === 'closed' || task.status === 'Complete') {
            return sum + (Number(task.storyPoints) || 0);
          }
          return sum;
        }, 0);
        return { name: sprint.name, velocity: donePoints };
      })
      .slice(-6); // Chỉ lấy 6 Sprints mới nhất

    const currentSprint = sprints.find(s => s.id === selectedSprintId);
    const isPastSprintUI = currentSprint ? new Date(currentSprint.endDate) < new Date() : false;
    const scopeCreepTasks = isPastSprintUI ? [] : (currentSprint?.tasks?.filter((t: any) => new Date(t.createdAt) > new Date(currentSprint.startDate)) || []);
    const scopeCreepCount = scopeCreepTasks.length;

    return (
      <div className="space-y-6" ref={printRef} id="dashboard-report-content">
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
              <button onClick={() => handleExport()} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
                <Download className="w-4 h-4" /> Export
              </button>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsJiraModalOpen(true)}
                  disabled={isSyncing}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium shrink-0 shadow-sm"
                >
                  {isSyncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                  {isSyncing ? 'Syncing...' : 'Connect Jira'}
                </button>
              </div>
            </div>
          </div>

          {syncMessage && (
            <div className={`p-4 rounded-xl border text-sm font-medium flex items-center gap-2 ${syncMessage.includes('Error') || syncMessage.includes('Failed') ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
              {syncMessage.includes('Error') || syncMessage.includes('Failed') ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
              {syncMessage}
            </div>
          )}

          {/* Filters Bar */}
          <div className="flex flex-wrap items-center gap-4 p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 text-gray-500">
              <Filter className="w-4 h-4" />
              <span className="text-sm font-medium">Sprint Filter:</span>
            </div>
            <select 
              value={selectedSprintId} 
              onChange={e => setSelectedSprintId(e.target.value)}
              className="text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 outline-none p-2.5 flex-1 min-w-[300px]"
            >
              {sprints.map(sprint => (
                <option key={sprint.id} value={sprint.id}>
                  {sprint.name} ({new Date(sprint.startDate).toLocaleDateString()} - {new Date(sprint.endDate).toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Scope Creep Alert Banner */}
        {scopeCreepCount > 0 && (
          <div className="bg-red-50 border-l-4 border-red-500 rounded-md shadow-sm p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div className="flex items-center gap-3 text-red-800">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span className="text-sm font-medium">
                <strong>Scope Creep Detected:</strong> {scopeCreepCount} tasks were added after the sprint started.
              </span>
            </div>
            <button 
              onClick={() => setIsScopeCreepModalOpen(true)}
              className="px-4 py-2 bg-white border border-red-200 text-red-700 text-sm font-medium rounded-lg hover:bg-red-100 transition-colors shrink-0 shadow-sm"
            >
              View Details
            </button>
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KPICard title="Velocity (Avg)" value={`${metrics.velocity} pts`} icon={TrendingUp} status="good" onClick={() => handleDrilldown('velocity', 'Velocity Details')} tooltip="Average story points completed per sprint." />
          <KPICard title="Lead Time" value={`${metrics.leadTime} days`} icon={Clock} status="warning" onClick={() => handleDrilldown('leadTime', 'Lead Time Details')} tooltip="Average time from issue creation to completion." />
          <KPICard title="Cycle Time" value={`${metrics.cycleTime} days`} icon={Activity} status="warning" onClick={() => handleDrilldown('cycleTime', 'Cycle Time Details')} tooltip="Average time taken from 'In Progress' to 'Done'." />
          <KPICard title="Productivity" value={`${metrics.productivity} pts`} icon={Users} status="good" onClick={() => handleDrilldown('productivity', 'Productivity Details')} tooltip="Total story points completed by team members." />
        </div>

        {/* AI Insights Panel */}
        <Card className="border-l-4 border-indigo-500 bg-gradient-to-r from-indigo-50/50 to-transparent relative overflow-hidden">
          {/* Subtle AI background effect */}
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-indigo-200/40 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="p-6 relative z-10">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl shrink-0 bg-indigo-100 text-indigo-600 shadow-sm border border-indigo-200/50">
                <BrainCircuit className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-gray-900 tracking-tight">AI Sprint Risk Analysis</h2>
                    <button 
                      onClick={() => setIsAiCodeModalOpen(true)}
                      className="text-gray-400 hover:text-indigo-600 transition-colors bg-white/50 backdrop-blur-sm rounded-full p-1"
                      title="View AI Architecture"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold shadow-sm border ${
                      aiInsights.riskPercentage > 70 ? 'bg-red-50 text-red-700 border-red-200' :
                      aiInsights.riskPercentage >= 30 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      Risk Level: {aiInsights.riskPercentage}%
                    </span>
                    <button
                      onClick={handleGenerateRetro}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1"
                    >
                      <BrainCircuit className="w-3 h-3" />
                      Generate Retrospective
                    </button>
                  </div>
                </div>
                <div className="text-gray-700 text-base whitespace-pre-wrap leading-relaxed">
                  {aiInsights.analysis}
                </div>
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
                    <td colSpan={4} className="py-12">
                      <div className="flex flex-col items-center justify-center p-6 bg-emerald-50 rounded-xl border border-emerald-100 mx-4 shadow-sm">
                        <div className="p-3 bg-white rounded-full text-emerald-500 mb-3 shadow-sm border border-emerald-100">
                          <CheckCircle2 className="w-8 h-8" />
                        </div>
                        <p className="text-emerald-800 font-bold text-lg">Awesome! No bottlenecks detected.</p>
                        <p className="text-emerald-600 mt-1">Your sprint is perfectly healthy.</p>
                      </div>
                    </td>
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
            </div>
            <div className="h-80">
              {burndownData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={burndownData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} />
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
                                <p className="text-blue-600">
                                  <span className="inline-block w-3 h-3 rounded-full bg-blue-500 mr-2"></span>
                                  Remaining: <span className="font-medium">{data.remainingPoints} pts</span>
                                </p>
                                <p className="text-gray-500">
                                  <span className="inline-block w-3 h-3 rounded-full bg-gray-400 mr-2"></span>
                                  Burned: <span className="font-medium text-gray-900">{data.burnedPoints} pts</span>
                                </p>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="remainingPoints" 
                      stroke="#3b82f6" 
                      strokeWidth={3} 
                      dot={{ r: 4, fill: "#3b82f6", stroke: "#fff", strokeWidth: 2 }}
                      activeDot={{ r: 6 }}
                      name="Remaining Points" 
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500 text-sm">No burndown data available</div>
              )}
            </div>
          </Card>

          {/* Velocity Chart */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Sprint Velocity</h3>
            <div className="h-72">
              {velocityData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={velocityData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} />
                    <Tooltip cursor={{fill: '#f3f4f6'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                    <Bar dataKey="velocity" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Velocity (pts)" barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500 text-sm">No velocity data available</div>
              )}
            </div>
          </Card>

          {/* Team Productivity */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Team Productivity</h3>
            <div className="h-72">
              {productivityData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={productivityData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} />
                    <YAxis dataKey="userName" type="category" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} width={100} />
                    <Tooltip cursor={{fill: '#f3f4f6'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                    <Legend />
                    <Bar dataKey="donePoints" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} name="Done Points" />
                    <Bar dataKey="remainingPoints" stackId="a" fill="#f59e0b" radius={[0, 4, 4, 0]} name="Remaining Points" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500 text-sm">No productivity data available</div>
              )}
            </div>
          </Card>
        </div>

        {/* Scope Creep Tasks Modal */}
        {isScopeCreepModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
            <Card className="w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl bg-white border-red-100">
              <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-red-50 rounded-t-xl">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Scope Creep Details</h3>
                    <p className="text-sm text-red-600 font-medium">{scopeCreepCount} tasks injected post-planning</p>
                  </div>
                </div>
                <button onClick={() => setIsScopeCreepModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto flex-1 bg-gray-50/50">
                <div className="space-y-3">
                  {scopeCreepTasks.map((task: any) => {
                    const statusLower = (task.status || '').toLowerCase();
                    const isCompleted = statusLower.includes('done') || statusLower.includes('closed') || statusLower.includes('complete');

                    return (
                      <div key={task.id} className={`p-4 bg-white border ${!isCompleted ? 'border-red-300 shadow-red-100 hover:shadow-red-200' : 'border-gray-200 hover:shadow-md'} rounded-lg shadow-sm transition-shadow`}>
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{task.key || task.id}</span>
                              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                isCompleted ? 'bg-green-100 text-green-700' :
                                statusLower.includes('in progress') ? 'bg-amber-100 text-amber-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {task.status}
                              </span>
                            </div>
                            <h4 className={`font-medium ${!isCompleted ? 'text-red-700 font-bold' : 'text-gray-900'}`}>{task.title}</h4>
                          </div>
                          {task.storyPoints ? (
                            <div className="text-right">
                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-indigo-50 text-indigo-700 font-bold text-sm">
                                {task.storyPoints}
                              </span>
                            </div>
                          ) : null}
                        </div>
                        <div className="mt-3 text-xs text-gray-500 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          Added on: {new Date(task.createdAt).toLocaleString()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
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
                ) : drilldownData.items && drilldownData.items.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">No detailed data available.</div>
                ) : (
                  <div className="space-y-4">
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          {drilldownData.type === 'velocity' && (
                            <tr>
                              <th className="px-4 py-3 font-semibold text-gray-700">Issue ID</th>
                              <th className="px-4 py-3 font-semibold text-gray-700 w-full">Title</th>
                              <th className="px-4 py-3 font-semibold text-gray-700">Assignee</th>
                              <th className="px-4 py-3 font-semibold text-gray-700 text-right">Story Points</th>
                            </tr>
                          )}
                          {drilldownData.type === 'leadTime' && (
                            <tr>
                              <th className="px-4 py-3 font-semibold text-gray-700">Issue ID</th>
                              <th className="px-4 py-3 font-semibold text-gray-700 w-full">Title</th>
                              <th className="px-4 py-3 font-semibold text-gray-700">Created At</th>
                              <th className="px-4 py-3 font-semibold text-gray-700">Closed At</th>
                              <th className="px-4 py-3 font-semibold text-gray-700 text-right">Lead Time (days)</th>
                            </tr>
                          )}
                          {drilldownData.type === 'cycleTime' && (
                            <tr>
                              <th className="px-4 py-3 font-semibold text-gray-700">Issue ID</th>
                              <th className="px-4 py-3 font-semibold text-gray-700 w-full">Title</th>
                              <th className="px-4 py-3 font-semibold text-gray-700">Started At</th>
                              <th className="px-4 py-3 font-semibold text-gray-700">Closed At</th>
                              <th className="px-4 py-3 font-semibold text-gray-700 text-right">Cycle Time (days)</th>
                            </tr>
                          )}
                          {drilldownData.type === 'productivity' && (
                            <tr>
                              <th className="px-4 py-3 font-semibold text-gray-700 w-full">Assignee</th>
                              <th className="px-4 py-3 font-semibold text-gray-700 text-right">Story Points Completed</th>
                            </tr>
                          )}
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {drilldownData.items.map((item: any, i: number) => (
                            <tr key={i} className="hover:bg-gray-50 transition-colors">
                              {drilldownData.type === 'velocity' && (
                                <>
                                  <td className="px-4 py-3 font-medium text-blue-600">{item.id}</td>
                                  <td className="px-4 py-3 text-gray-900 truncate max-w-[200px]">{item.title}</td>
                                  <td className="px-4 py-3 text-gray-500">{item.assignee}</td>
                                  <td className="px-4 py-3 text-right font-medium">{item.points}</td>
                                </>
                              )}
                              {drilldownData.type === 'leadTime' && (
                                <>
                                  <td className="px-4 py-3 font-medium text-blue-600">{item.id}</td>
                                  <td className="px-4 py-3 text-gray-900 truncate max-w-[200px]">{item.title}</td>
                                  <td className="px-4 py-3 text-gray-500">{item.createdAt}</td>
                                  <td className="px-4 py-3 text-gray-500">{item.closedAt}</td>
                                  <td className="px-4 py-3 text-right font-medium text-amber-600">{item.leadTime}</td>
                                </>
                              )}
                              {drilldownData.type === 'cycleTime' && (
                                <>
                                  <td className="px-4 py-3 font-medium text-blue-600">{item.id}</td>
                                  <td className="px-4 py-3 text-gray-900 truncate max-w-[200px]">{item.title}</td>
                                  <td className="px-4 py-3 text-gray-500">{item.startedAt}</td>
                                  <td className="px-4 py-3 text-gray-500">{item.closedAt}</td>
                                  <td className="px-4 py-3 text-right font-medium text-amber-600">{item.cycleTime}</td>
                                </>
                              )}
                              {drilldownData.type === 'productivity' && (
                                <>
                                  <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                                  <td className="px-4 py-3 text-right font-medium text-green-600">{item.points}</td>
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-blue-50 border-t border-gray-200">
                          <tr>
                            <td colSpan={drilldownData.type === 'productivity' ? 1 : drilldownData.type === 'velocity' ? 3 : 4} className="px-4 py-3 font-bold text-gray-900 text-right">
                              {drilldownData.type === 'productivity' || drilldownData.type === 'velocity' ? 'Total / Avg:' : 'Average:'}
                            </td>
                            <td className="px-4 py-3 font-bold text-blue-700 text-right">
                              {drilldownData.type === 'productivity' || drilldownData.type === 'velocity' 
                                ? drilldownData.total 
                                : drilldownData.total.toFixed(1)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}
      </main>

      {/* Jira Configuration Modal */}
      {isJiraModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <Card className="w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-bold text-gray-900">Connect Jira Software</h3>
              </div>
              <button onClick={() => setIsJiraModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleJiraSync} className="p-6 space-y-5">
              <p className="text-sm text-gray-500 mb-2">Sync Agile data (Sprints, Issues) directly from your Jira Board.</p>
              
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-gray-400" />
                  Jira Domain
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. your-company.atlassian.net"
                  value={jiraDomain}
                  onChange={e => setJiraDomain(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-400" />
                  Login Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={jiraEmail}
                  onChange={e => setJiraEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-gray-400" />
                  Jira API Token
                </label>
                <input
                  type="password"
                  required
                  placeholder="Enter your API Token..."
                  value={jiraToken}
                  onChange={e => setJiraToken(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                />
                <p className="text-xs text-blue-600 mt-1 cursor-pointer hover:underline text-right">How to get an API Token?</p>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Hash className="w-4 h-4 text-gray-400" />
                  Board ID
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 1"
                  value={jiraBoardId}
                  onChange={e => setJiraBoardId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 mt-6">
                <button
                  type="button"
                  onClick={() => setIsJiraModalOpen(false)}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSyncing}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  {isSyncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                  {isSyncing ? 'Syncing...' : 'Start Sync'}
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}
      {/* AI Code Modal */}
      {isAiCodeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <Card className="w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl bg-gray-900 border-gray-800">
            <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900">
              <div className="flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-blue-400" />
                <h3 className="text-lg font-bold text-gray-100">Future AI Architecture (V2.0)</h3>
              </div>
              <button onClick={() => setIsAiCodeModalOpen(false)} className="text-gray-400 hover:text-white p-1 rounded-md hover:bg-gray-800 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-0 overflow-y-auto flex-1">
              <div className="bg-gray-900 p-6">
                <p className="text-gray-400 mb-4 text-sm">
                  This Python snippet demonstrates how the separate AI microservice combines <code className="text-blue-400">scikit-learn</code> for quantitative predictions (classification & regression) with the <code className="text-blue-400">Gemini API</code> for qualitative root cause analysis and actionable recommendations.
                </p>
                <div className="overflow-x-auto rounded border border-gray-800 bg-[#0d1117] p-4">
                  <pre className="text-gray-300 text-sm font-mono leading-relaxed">
                    <code>{`import pandas as pd
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
        }`}</code>
                  </pre>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
      {/* AI Retrospective Modal */}
      {isRetroModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <Card className="w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl bg-white border-indigo-100">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-indigo-50/50 rounded-t-xl">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                  <BrainCircuit className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Sprint Retrospective Report</h3>
              </div>
              <button onClick={() => setIsRetroModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {isGeneratingRetro ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
                  <p className="text-gray-600 font-medium">AI Coach is analyzing your sprint...</p>
                </div>
              ) : (
                <div className="markdown-body text-base">
                  <ReactMarkdown
                    components={{
                      h3: ({node, ...props}) => <h3 className="text-xl font-bold mt-6 mb-3 text-gray-800" {...props} />,
                      p: ({node, ...props}) => <p className="leading-relaxed text-gray-600 mb-4" {...props} />,
                      ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-4 text-gray-600 space-y-1" {...props} />,
                      li: ({node, ...props}) => <li className="mb-1" {...props} />,
                      strong: ({node, ...props}) => <strong className="font-semibold text-gray-900" {...props} />
                    }}
                  >
                    {retroReport}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
