import React, { useState } from 'react';
import { Search, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function InboxView() {
  const [activeTab, setActiveTab] = useState('All');
  const navigate = useNavigate();
  
  const mockEmails = [
    { id: '1', sender: 'bob.jones@enterprise.net', subject: 'Urgent: Complete system outage', timestamp: '10 mins ago', sentiment: 'Negative', category: 'Support', urgency: 'Critical', status: 'Escalated' },
    { id: '2', sender: 'karen.w@retail-co.com', subject: 'Cancel my account immediately', timestamp: '1 hour ago', sentiment: 'Negative', category: 'Billing', urgency: 'High', status: 'Needs Human' },
    { id: '3', sender: 'alice.smith@greenlight-npo.org', subject: 'Question about non-profit pricing', timestamp: '2 hours ago', sentiment: 'Positive', category: 'Sales', urgency: 'Medium', status: 'Auto-Replied' }
  ];

  const getSentimentColor = (sentiment) => {
    switch(sentiment) {
      case 'Negative': return 'bg-danger/20 text-danger border border-danger/30';
      case 'Mixed': return 'bg-warning/20 text-warning border border-warning/30';
      case 'Positive': return 'bg-success/20 text-success border border-success/30';
      default: return 'bg-white/10 text-textMuted border border-white/20';
    }
  };

  const getUrgencyColor = (urgency) => {
    switch(urgency) {
      case 'Critical': return 'text-danger font-bold';
      case 'High': return 'text-warning font-semibold';
      default: return 'text-text';
    }
  };

  return (
    <div className="flex flex-col h-full">
      <header className="mb-6 flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Mission Control</h2>
          <p className="text-textMuted mt-1">Monitor and triage incoming communications.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted" size={18} />
          <input 
            type="text" 
            placeholder="Search emails..." 
            className="pl-10 pr-4 py-2 bg-surfaceHighlight border border-white/10 rounded-lg focus:outline-none focus:border-primary/50 text-sm w-64 transition-all"
          />
        </div>
      </header>

      <div className="glass-panel flex-1 flex flex-col overflow-hidden">
        <div className="flex space-x-1 p-2 border-b border-white/10">
          {['All', 'Needs Human', 'Auto-Replied', 'Escalated', 'Spam'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === tab ? 'bg-white/10 text-white shadow-sm' : 'text-textMuted hover:text-white hover:bg-white/5'}`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-surface/95 backdrop-blur-sm border-b border-white/10 z-10">
              <tr>
                <th className="p-4 text-xs font-semibold text-textMuted uppercase tracking-wider">Sender</th>
                <th className="p-4 text-xs font-semibold text-textMuted uppercase tracking-wider">Subject</th>
                <th className="p-4 text-xs font-semibold text-textMuted uppercase tracking-wider">Category</th>
                <th className="p-4 text-xs font-semibold text-textMuted uppercase tracking-wider">Sentiment</th>
                <th className="p-4 text-xs font-semibold text-textMuted uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {mockEmails.map(email => (
                <tr 
                  key={email.id} 
                  onClick={() => navigate(`/thread/${email.sender}`)}
                  className="hover:bg-white/5 transition-colors group cursor-pointer"
                >
                  <td className="p-4">
                    <div className="font-medium text-sm text-white">{email.sender}</div>
                    <div className="text-xs text-textMuted">{email.timestamp}</div>
                  </td>
                  <td className="p-4">
                    <div className={`text-sm ${getUrgencyColor(email.urgency)}`}>{email.subject}</div>
                  </td>
                  <td className="p-4">
                    <span className="px-2.5 py-1 bg-surfaceHighlight rounded text-xs font-medium border border-white/5">
                      {email.category}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded text-xs font-medium ${getSentimentColor(email.sentiment)}`}>
                      {email.sentiment}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center space-x-1.5 text-sm">
                      {email.status === 'Escalated' && <AlertCircle size={16} className="text-danger" />}
                      {email.status === 'Auto-Replied' && <CheckCircle size={16} className="text-success" />}
                      {email.status === 'Needs Human' && <Clock size={16} className="text-warning" />}
                      <span className="text-textMuted">{email.status}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
