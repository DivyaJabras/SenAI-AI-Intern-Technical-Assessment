import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function AnalyticsDashboard() {
  const sentimentData = [
    { date: 'Mon', score: 0.5 },
    { date: 'Tue', score: 0.2 },
    { date: 'Wed', score: -0.1 },
    { date: 'Thu', score: -0.6 },
    { date: 'Fri', score: -0.8 },
  ];

  const categoryData = [
    { name: 'Support', value: 45 },
    { name: 'Billing', value: 25 },
    { name: 'Sales', value: 20 },
    { name: 'Compliance', value: 10 },
  ];
  
  const COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6'];

  return (
    <div className="h-full flex flex-col">
      <header className="mb-6">
        <h2 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h2>
        <p className="text-textMuted mt-1">System performance and intelligence metrics.</p>
      </header>

      <div className="grid grid-cols-2 gap-6 flex-1">
        
        <div className="glass-panel p-5 flex flex-col">
          <h3 className="font-bold mb-4">Sentiment Trend Tracker (Karen W.)</h3>
          <div className="flex-1 min-h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sentimentData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="date" stroke="#9ca3af" tick={{fill: '#9ca3af'}} />
                <YAxis domain={[-1, 1]} stroke="#9ca3af" tick={{fill: '#9ca3af'}} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e1e1e', borderColor: '#333', color: '#fff' }} 
                  itemStyle={{ color: '#ef4444' }}
                />
                <Line type="monotone" dataKey="score" stroke="#ef4444" strokeWidth={2} dot={{r: 4, fill: '#ef4444'}} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel p-5 flex flex-col">
          <h3 className="font-bold mb-4">Inbound Categories</h3>
          <div className="flex-1 min-h-[200px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#1e1e1e', borderColor: '#333' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel p-5">
          <h3 className="font-bold mb-4">Agent Performance</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surfaceHighlight p-4 rounded-lg border border-white/5">
              <p className="text-textMuted text-xs font-semibold uppercase tracking-wider mb-1">Auto-Replies</p>
              <p className="text-2xl font-bold text-success">1,245</p>
            </div>
            <div className="bg-surfaceHighlight p-4 rounded-lg border border-white/5">
              <p className="text-textMuted text-xs font-semibold uppercase tracking-wider mb-1">Escalations</p>
              <p className="text-2xl font-bold text-warning">89</p>
            </div>
            <div className="bg-surfaceHighlight p-4 rounded-lg border border-white/5">
              <p className="text-textMuted text-xs font-semibold uppercase tracking-wider mb-1">Legal Flags</p>
              <p className="text-2xl font-bold text-danger">12</p>
            </div>
            <div className="bg-surfaceHighlight p-4 rounded-lg border border-white/5">
              <p className="text-textMuted text-xs font-semibold uppercase tracking-wider mb-1">Avg Confidence</p>
              <p className="text-2xl font-bold text-primary">0.92</p>
            </div>
          </div>
        </div>

        <div className="glass-panel p-5">
          <h3 className="font-bold mb-4">At-Risk Accounts (Churn &gt; 0.7)</h3>
          <ul className="space-y-3">
            <li className="flex justify-between items-center p-3 bg-danger/10 border border-danger/20 rounded-lg">
              <div>
                <p className="font-medium text-sm">Karen (Retail Co)</p>
                <p className="text-xs text-danger/80">3 consecutive negative emails</p>
              </div>
              <button className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-xs transition">View</button>
            </li>
            <li className="flex justify-between items-center p-3 bg-warning/10 border border-warning/20 rounded-lg">
              <div>
                <p className="font-medium text-sm">Bob Jones (Enterprise)</p>
                <p className="text-xs text-warning/80">SLA Breach / Legal Threat</p>
              </div>
              <button className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-xs transition">View</button>
            </li>
          </ul>
        </div>

      </div>
    </div>
  );
}
