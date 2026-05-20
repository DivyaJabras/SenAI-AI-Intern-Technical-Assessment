import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import InboxView from './views/InboxView';
import ThreadWorkspace from './views/ThreadWorkspace';
import AnalyticsDashboard from './views/AnalyticsDashboard';
import { Mail, MessageSquare, BarChart2 } from 'lucide-react';

export default function App() {
  const location = useLocation();

  const NavItem = ({ to, icon: Icon, label }) => {
    const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
    return (
      <Link 
        to={to} 
        className={`flex items-center space-x-2 px-4 py-3 rounded-lg transition-colors duration-200 ${
          isActive 
            ? 'bg-primary/20 text-primary border border-primary/30' 
            : 'text-textMuted hover:bg-surfaceHighlight hover:text-text'
        }`}
      >
        <Icon size={20} />
        <span className="font-medium">{label}</span>
      </Link>
    );
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-white/10 bg-surface flex flex-col z-20">
        <div className="p-6 border-b border-white/10">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent tracking-tight">
            SenAI CRM
          </h1>
          <p className="text-xs text-textMuted mt-1 uppercase tracking-wider font-semibold">Intelligence Layer</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <NavItem to="/" icon={Mail} label="Inbox" />
          <NavItem to="/analytics" icon={BarChart2} label="Analytics" />
        </nav>
        
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-indigo-500 flex items-center justify-center text-sm font-bold text-white shadow-lg">
              AG
            </div>
            <div>
              <p className="text-sm font-medium text-text">Agent View</p>
              <p className="text-xs text-textMuted">System Active</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative flex flex-col">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 pointer-events-none" />
        <div className="flex-1 overflow-y-auto relative z-10 p-6">
          <Routes>
            <Route path="/" element={<InboxView />} />
            <Route path="/thread/:email" element={<ThreadWorkspace />} />
            <Route path="/analytics" element={<AnalyticsDashboard />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
