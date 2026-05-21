import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend 
} from 'recharts';
import { 
  RefreshCw, TrendingUp, Users, CheckCircle, ShieldAlert, AlertTriangle, Loader, ChevronRight, PieChart as PieIcon
} from 'lucide-react';

const CATEGORY_COLORS = {
  'Technical Support': '#3b82f6', // Blue
  'Billing/Refund': '#ef4444',    // Red
  'Sales': '#10b981',             // Green
  'Compliance/Legal': '#f59e0b',  // Yellow
  'General Inquiry': '#8b5cf6'    // Purple
};
const FALLBACK_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];

export default function AnalyticsDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Dashboard stats from /analytics/stats
  const [stats, setStats] = useState({
    categories: {},
    performance: { auto_replies: 0, escalations: 0, legal_flags: 0, avg_confidence: 0.92 },
    atRiskContacts: []
  });

  // Contact list for dropdown
  const [contacts, setContacts] = useState([]);
  const [selectedSender, setSelectedSender] = useState('all');
  
  // Sentiment trend data
  const [sentimentTrend, setSentimentTrend] = useState([]);
  const [trendLoading, setTrendLoading] = useState(false);

  const fetchDashboardStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/analytics/stats');
      if (!res.ok) throw new Error(`Server returned HTTP ${res.status}`);
      const json = await res.json();
      const data = json.data || {};
      
      setStats({
        categories: data.categories || {},
        performance: data.performance || { auto_replies: 0, escalations: 0, legal_flags: 0, avg_confidence: 0.92 },
        atRiskContacts: data.at_risk_contacts || []
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchContactsList = useCallback(async () => {
    try {
      const res = await fetch('/analytics/contacts');
      if (res.ok) {
        const json = await res.json();
        setContacts(json.data?.contacts || []);
      }
    } catch (err) {
      console.error("Error fetching contacts list:", err);
    }
  }, []);

  const fetchSentimentTrend = useCallback(async (sender) => {
    setTrendLoading(true);
    try {
      const url = sender === 'all' 
        ? '/analytics/sentiment-trend?days=30' 
        : `/analytics/sentiment-trend?sender=${encodeURIComponent(sender)}&days=30`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        const trendList = json.data?.trend || [];
        
        // Format for recharts
        const formatted = trendList.map(item => ({
          date: new Date(item.timestamp).toLocaleString(undefined, { 
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          score: item.sentiment_score,
          movingAverage: item.moving_average_7d
        }));
        setSentimentTrend(formatted);
      }
    } catch (err) {
      console.error("Error fetching sentiment trend:", err);
    } finally {
      setTrendLoading(false);
    }
  }, []);

  // Fetch initial dashboard stats & contacts
  useEffect(() => {
    fetchDashboardStats();
    fetchContactsList();
  }, [fetchDashboardStats, fetchContactsList]);

  // Fetch sentiment trend when selected sender changes
  useEffect(() => {
    fetchSentimentTrend(selectedSender);
  }, [selectedSender, fetchSentimentTrend]);

  // Prepare Category Pie Chart Data
  const pieData = Object.entries(stats.categories).map(([name, value]) => ({
    name,
    value
  }));

  const handleRefreshAll = () => {
    fetchDashboardStats();
    fetchContactsList();
    fetchSentimentTrend(selectedSender);
  };

  if (loading && pieData.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 flex-col gap-4">
        <Loader size={36} className="animate-spin text-primary" />
        <p className="text-sm font-medium">Loading live analytics data...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-6">
      {/* Header */}
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">Analytics Dashboard</h2>
          <p className="text-textMuted text-sm mt-1">Real-time system health, automated resolutions, and customer churn metrics.</p>
        </div>
        <button
          onClick={handleRefreshAll}
          className="p-2.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition text-gray-400 hover:text-white flex items-center gap-2 text-xs font-bold"
          title="Refresh All Analytics"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh Stats
        </button>
      </header>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm flex items-center gap-2">
          <ShieldAlert size={18} />
          <span>Error loading metrics: {error}</span>
        </div>
      )}

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
        
        {/* 1. Sentiment Trend Tracker Card */}
        <div className="glass-panel p-5 flex flex-col bg-gradient-to-br from-surface to-surfaceHighlight/50">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-sm tracking-wide uppercase flex items-center text-white">
              <TrendingUp size={16} className="mr-2 text-indigo-400" />
              Sentiment Trend Tracker
            </h3>
            
            <div className="flex items-center gap-2">
              <span className="text-xs text-textMuted">Filter:</span>
              <select
                value={selectedSender}
                onChange={(e) => setSelectedSender(e.target.value)}
                className="bg-black/40 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-text focus:outline-none focus:border-primary/50 transition cursor-pointer max-w-[200px]"
              >
                <option value="all">All Senders (Global)</option>
                {contacts.map(c => (
                  <option key={c.email} value={c.email}>{c.name} ({c.email})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex-1 min-h-[250px] relative">
            {trendLoading ? (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-textMuted gap-2">
                <Loader size={16} className="animate-spin text-primary" />
                <span>Fetching trend...</span>
              </div>
            ) : sentimentTrend.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-textMuted flex-col gap-2">
                <AlertTriangle size={24} className="opacity-40" />
                <span>No sentiment records found in specified period.</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sentimentTrend} margin={{ top: 15, right: 10, bottom: 5, left: -25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" />
                  <XAxis dataKey="date" stroke="#6b7280" fontSize={10} tickLine={false} />
                  <YAxis domain={[-1, 1]} stroke="#6b7280" fontSize={10} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#121212', borderColor: '#ffffff10', borderRadius: '8px', fontSize: '12px' }} 
                    itemStyle={{ fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Line 
                    name="Raw Sentiment"
                    type="monotone" 
                    dataKey="score" 
                    stroke="#3b82f6" 
                    strokeWidth={2} 
                    dot={{ r: 2, fill: '#3b82f6' }} 
                    activeDot={{ r: 4 }} 
                  />
                  <Line 
                    name="7-Period Moving Avg"
                    type="monotone" 
                    dataKey="movingAverage" 
                    stroke="#a855f7" 
                    strokeWidth={1.5} 
                    strokeDasharray="4 4"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* 2. Inbound Categories Pie Chart */}
        <div className="glass-panel p-5 flex flex-col bg-gradient-to-br from-surface to-surfaceHighlight/50">
          <h3 className="font-bold text-sm tracking-wide uppercase mb-4 flex items-center text-white">
            <PieIcon size={16} className="mr-2 text-primary" />
            Inbound Category Allocation
          </h3>
          
          <div className="flex-1 min-h-[250px] flex items-center justify-center">
            {pieData.length === 0 ? (
              <div className="text-xs text-textMuted flex flex-col items-center justify-center gap-2">
                <AlertTriangle size={24} className="opacity-40" />
                <span>No category data available yet.</span>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col sm:flex-row items-center justify-around">
                <div className="w-full sm:w-1/2 h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                        stroke="none"
                      >
                        {pieData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={CATEGORY_COLORS[entry.name] || FALLBACK_COLORS[index % FALLBACK_COLORS.length]} 
                          />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#121212', borderColor: '#ffffff10', borderRadius: '8px', fontSize: '12px' }} 
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Legend list */}
                <div className="flex flex-col gap-2 mt-4 sm:mt-0">
                  {pieData.map((entry, index) => {
                    const color = CATEGORY_COLORS[entry.name] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
                    const total = pieData.reduce((acc, curr) => acc + curr.value, 0);
                    const percent = total > 0 ? ((entry.value / total) * 100).toFixed(0) : 0;
                    
                    return (
                      <div key={entry.name} className="flex items-center gap-2 text-xs">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        <span className="text-text font-medium">{entry.name}</span>
                        <span className="text-textMuted font-mono">({entry.value} - {percent}%)</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 3. Agent Performance Card */}
        <div className="glass-panel p-5 bg-gradient-to-br from-surface to-surfaceHighlight/50 flex flex-col justify-between">
          <h3 className="font-bold text-sm tracking-wide uppercase mb-4 flex items-center text-white">
            <CheckCircle size={16} className="mr-2 text-emerald-400" />
            Agent Resolution Statistics
          </h3>
          
          <div className="grid grid-cols-2 gap-4 flex-1 justify-center">
            <div className="bg-surfaceHighlight/40 p-4 rounded-lg border border-white/5 hover:border-emerald-500/10 transition-colors flex flex-col justify-center">
              <p className="text-textMuted text-[10px] font-bold uppercase tracking-wider mb-1">Auto-Replies</p>
              <p className="text-2xl font-bold text-success">{stats.performance.auto_replies}</p>
              <span className="text-[9px] text-textMuted mt-1">Dispatched without humans</span>
            </div>
            <div className="bg-surfaceHighlight/40 p-4 rounded-lg border border-white/5 hover:border-warning/10 transition-colors flex flex-col justify-center">
              <p className="text-textMuted text-[10px] font-bold uppercase tracking-wider mb-1">Escalations</p>
              <p className="text-2xl font-bold text-warning">{stats.performance.escalations}</p>
              <span className="text-[9px] text-textMuted mt-1">Routed to human triage</span>
            </div>
            <div className="bg-surfaceHighlight/40 p-4 rounded-lg border border-white/5 hover:border-danger/10 transition-colors flex flex-col justify-center">
              <p className="text-textMuted text-[10px] font-bold uppercase tracking-wider mb-1">Legal Flags</p>
              <p className="text-2xl font-bold text-danger">{stats.performance.legal_flags}</p>
              <span className="text-[9px] text-textMuted mt-1">GDPR & SLA breach alerts</span>
            </div>
            <div className="bg-surfaceHighlight/40 p-4 rounded-lg border border-white/5 hover:border-primary/10 transition-colors flex flex-col justify-center">
              <p className="text-textMuted text-[10px] font-bold uppercase tracking-wider mb-1">Avg Confidence</p>
              <p className="text-2xl font-bold text-primary">{(stats.performance.avg_confidence * 100).toFixed(0)}%</p>
              <span className="text-[9px] text-textMuted mt-1">Classification confidence</span>
            </div>
          </div>
        </div>

        {/* 4. At-Risk Accounts (Churn > 0.7) */}
        <div className="glass-panel p-5 bg-gradient-to-br from-surface to-surfaceHighlight/50 flex flex-col">
          <h3 className="font-bold text-sm tracking-wide uppercase mb-4 flex items-center text-white">
            <Users size={16} className="mr-2 text-danger" />
            At-Risk Client Accounts
          </h3>
          
          <div className="flex-1 overflow-y-auto max-h-[220px] pr-1">
            {stats.atRiskContacts.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-textMuted gap-1.5 py-8">
                <CheckCircle size={16} className="text-emerald-400" />
                <span>No high risk accounts flagged. (Churn score &lt; 0.7)</span>
              </div>
            ) : (
              <ul className="space-y-3">
                {stats.atRiskContacts.map((contact, idx) => (
                  <li 
                    key={idx} 
                    className="flex justify-between items-center p-3.5 bg-danger/5 border border-danger/15 rounded-lg hover:bg-danger/10 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-white">{contact.name}</span>
                        <span className="text-[10px] text-textMuted">({contact.company || 'Enterprise'})</span>
                        <span className="text-[10px] text-red-400 font-bold font-mono">{(contact.churn_risk_score * 100).toFixed(0)}% risk</span>
                      </div>
                      <p className="text-xs text-red-300/80 mt-1 flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-red-400 shrink-0" />
                        {contact.reason}
                      </p>
                    </div>
                    
                    <button 
                      onClick={() => navigate(`/thread/${encodeURIComponent(contact.email)}`)}
                      className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-bold transition flex items-center gap-1 text-white"
                    >
                      Workspace <ChevronRight size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

