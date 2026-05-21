import React, { useState, useEffect, useCallback } from 'react';
import { Search, AlertCircle, CheckCircle, Clock, RefreshCw, Inbox, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TABS = ['All', 'Needs Human', 'Auto-Replied', 'Escalated', 'Spam'];

function getSentimentColor(score) {
  if (score === null || score === undefined) return 'bg-white/10 text-gray-400 border border-white/10';
  if (score >= 0.2)  return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
  if (score <= -0.2) return 'bg-red-500/20    text-red-400    border border-red-500/30';
  return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
}

function getSentimentLabel(score) {
  if (score === null || score === undefined) return 'Unknown';
  if (score >= 0.2)  return 'Positive';
  if (score <= -0.2) return 'Negative';
  return 'Mixed';
}

function getUrgencyColor(urgency) {
  switch (urgency) {
    case 'Critical': return 'text-red-400 font-bold';
    case 'High':     return 'text-amber-400 font-semibold';
    case 'Medium':   return 'text-blue-400';
    default:         return 'text-gray-400';
  }
}

function getStatusInfo(email) {
  if (email.is_spam)             return { label: 'Spam',         icon: <AlertCircle size={14} className="text-gray-500" />,   tab: 'Spam' };
  if (email.urgency === 'Critical' || email.actions?.some(a => a.type === 'Escalate'))
                                  return { label: 'Escalated',    icon: <AlertCircle size={14} className="text-red-400" />,    tab: 'Escalated' };
  if (email.actions?.some(a => a.type === 'Replied' || a.type === 'Manual-Reply'))
                                  return { label: 'Auto-Replied', icon: <CheckCircle size={14} className="text-emerald-400" />, tab: 'Auto-Replied' };
  if (email.requires_human)       return { label: 'Needs Human',  icon: <Clock size={14} className="text-amber-400" />,        tab: 'Needs Human' };
  return                                 { label: 'Queued',        icon: <Clock size={14} className="text-gray-400" />,         tab: 'All' };
}

export default function InboxView() {
  const [activeTab, setActiveTab]   = useState('All');
  const [search, setSearch]         = useState('');
  const [emails, setEmails]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const navigate = useNavigate();

  const fetchEmails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch all threads — we use the analytics summary endpoint to get all emails
      const res = await fetch('/threads/all', { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      // Flatten all emails across all threads for the inbox view
      const allEmails = [];
      for (const thread of (json.data?.threads ?? [])) {
        for (const email of (thread.emails ?? [])) {
          allEmails.push({ ...email, thread_status: thread.status, thread_subject: thread.subject });
        }
      }
      allEmails.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setEmails(allEmails);
    } catch {
      // Fall back to the /analytics/emails summary endpoint
      try {
        const res2 = await fetch('/analytics/emails');
        if (!res2.ok) throw new Error(`HTTP ${res2.status}`);
        const json2 = await res2.json();
        setEmails(json2.data?.emails ?? []);
      } catch (err2) {
        setError(err2.message);
      }
    } finally {
      setLoading(false);
    }
  }, [refreshKey]);

  useEffect(() => { fetchEmails(); }, [fetchEmails]);

  const filtered = emails.filter(e => {
    const info = getStatusInfo(e);
    const matchesTab =
      activeTab === 'All' ||
      (activeTab === 'Spam'   && e.is_spam) ||
      info.tab === activeTab;
    const q = search.toLowerCase();
    const matchesSearch = !q ||
      e.sender?.toLowerCase().includes(q) ||
      e.subject?.toLowerCase().includes(q) ||
      e.body?.toLowerCase().includes(q);
    return matchesTab && matchesSearch;
  });

  const tabCounts = {};
  TABS.forEach(t => {
    if (t === 'All')  tabCounts[t] = emails.length;
    else if (t === 'Spam') tabCounts[t] = emails.filter(e => e.is_spam).length;
    else tabCounts[t] = emails.filter(e => getStatusInfo(e).tab === t).length;
  });

  return (
    <div className="flex flex-col h-full">
      <header className="mb-6 flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Mission Control</h2>
          <p className="text-gray-400 mt-1">
            {loading ? 'Loading live data…' : `${emails.length} emails in database`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            className="p-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition text-gray-400 hover:text-white"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
            <input
              type="text"
              placeholder="Search emails…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-blue-500/50 text-sm w-64 transition-all placeholder-gray-600"
            />
          </div>
        </div>
      </header>

      <div className="glass-panel flex-1 flex flex-col overflow-hidden">
        {/* Tabs */}
        <div className="flex space-x-1 p-2 border-b border-white/10">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                activeTab === tab
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-gray-500 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab}
              {tabCounts[tab] > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === tab ? 'bg-white/20' : 'bg-white/10'
                }`}>
                  {tabCounts[tab]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {error ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
              <AlertCircle size={40} className="text-red-400" />
              <div>
                <p className="font-semibold text-red-400">Could not load emails</p>
                <p className="text-sm text-gray-500 mt-1">{error}</p>
                <p className="text-xs text-gray-600 mt-3">
                  Make sure the backend is running and you've ingested some emails using:<br/>
                  <code className="bg-white/5 px-2 py-0.5 rounded text-blue-400">python simulate_stream.py --fast</code>
                </p>
              </div>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center h-full gap-3 text-gray-500">
              <RefreshCw size={18} className="animate-spin" />
              <span>Loading emails from backend…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
              <Inbox size={40} className="text-gray-700" />
              <div>
                <p className="font-semibold text-gray-400">
                  {emails.length === 0 ? 'No emails yet' : 'No emails match your filter'}
                </p>
                {emails.length === 0 && (
                  <p className="text-sm text-gray-600 mt-2">
                    Run the simulator to populate the inbox:<br/>
                    <code className="bg-white/5 px-2 py-0.5 rounded text-blue-400">
                      python simulate_stream.py --fast
                    </code>
                  </p>
                )}
              </div>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-gray-900/95 backdrop-blur-sm border-b border-white/10 z-10">
                <tr>
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Sender</th>
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Subject</th>
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Sentiment</th>
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Urgency</th>
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map(email => {
                  const info = getStatusInfo(email);
                  return (
                    <tr
                      key={email.id}
                      onClick={() => navigate(`/thread/${encodeURIComponent(email.sender)}`)}
                      className="hover:bg-white/5 transition-colors cursor-pointer group"
                    >
                      <td className="p-4">
                        <div className="font-medium text-sm text-white group-hover:text-blue-400 transition-colors">
                          {email.sender}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(email.timestamp).toLocaleString()}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className={`text-sm ${getUrgencyColor(email.urgency)}`}>
                          {email.subject ?? email.thread_subject ?? '(no subject)'}
                        </div>
                        {email.is_spam && (
                          <span className="text-xs text-gray-600 mt-0.5 block">Flagged as spam</span>
                        )}
                      </td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 bg-white/5 rounded text-xs font-medium border border-white/10">
                          {email.category ?? '—'}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded text-xs font-medium ${getSentimentColor(email.sentiment)}`}>
                          {getSentimentLabel(email.sentiment)}
                          {email.sentiment !== null && email.sentiment !== undefined && (
                            <span className="opacity-60 ml-1">({(+email.sentiment).toFixed(2)})</span>
                          )}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`text-sm ${getUrgencyColor(email.urgency)}`}>
                          {email.urgency ?? '—'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 text-sm">
                          {info.icon}
                          <span className="text-gray-400">{info.label}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
