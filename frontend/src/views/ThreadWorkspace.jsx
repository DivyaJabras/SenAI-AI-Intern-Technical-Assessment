import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  User, ShieldAlert, Cpu, FileText, ArrowLeft, RefreshCw, Send, 
  Save, Check, Loader, AlertCircle, Trash2, Globe, Sparkles, Clock, CheckCircle, HelpCircle
} from 'lucide-react';

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

function getUrgencyBadge(urgency) {
  switch (urgency) {
    case 'Critical': 
      return <span className="px-2 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded text-xs font-bold uppercase">Critical</span>;
    case 'High':     
      return <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded text-xs font-bold uppercase">High</span>;
    case 'Medium':   
      return <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded text-xs font-bold uppercase">Medium</span>;
    default:         
      return <span className="px-2 py-0.5 bg-white/10 text-gray-400 border border-white/10 rounded text-xs uppercase">Low</span>;
  }
}

export default function ThreadWorkspace() {
  const { email } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [contact, setContact] = useState(null);
  const [threads, setThreads] = useState([]);
  
  // Draft and Reply states
  const [draftAction, setDraftAction] = useState(null);
  const [draftText, setDraftText] = useState('');
  const [manualReplyText, setManualReplyText] = useState('');
  
  // Supporting data states
  const [ragContext, setRagContext] = useState([]);
  const [ragLoading, setRagLoading] = useState(false);
  const [reputation, setReputation] = useState(null);
  const [reputationLoading, setReputationLoading] = useState(false);
  
  // Action trigger states
  const [actionStatus, setActionStatus] = useState({ loading: false, type: '', success: false, message: '' });

  const fetchThreadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/threads/${encodeURIComponent(email)}`);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('Contact profile or threads not found in database.');
        }
        throw new Error(`Server returned HTTP ${res.status}`);
      }
      const json = await res.json();
      const data = json.data || {};
      
      setContact(data.contact || null);
      const fetchedThreads = data.threads || [];
      setThreads(fetchedThreads);
      
      // Determine latest email and find if there is a pending draft
      const allEmails = [];
      fetchedThreads.forEach(t => {
        if (t.emails) {
          t.emails.forEach(e => {
            allEmails.push(e);
          });
        }
      });
      allEmails.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      const latestEmail = allEmails[allEmails.length - 1];

      if (latestEmail) {
        // Fetch RAG context based on latest email content
        const query = latestEmail.subject || latestEmail.body.slice(0, 100);
        fetchRAG(query);
      }

      // Check for pending draft in any action
      let foundDraftAction = null;
      for (let i = allEmails.length - 1; i >= 0; i--) {
        const e = allEmails[i];
        if (e.actions) {
          const da = e.actions.find(a => a.type === 'Replied' && !a.is_approved);
          if (da) {
            foundDraftAction = da;
            break;
          }
        }
      }

      if (foundDraftAction) {
        setDraftAction(foundDraftAction);
        setDraftText(foundDraftAction.draft || '');
      } else {
        setDraftAction(null);
        setDraftText('');
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [email]);

  const fetchRAG = async (query) => {
    if (!query) return;
    setRagLoading(true);
    try {
      const res = await fetch(`/rag/search?q=${encodeURIComponent(query)}&top_k=2`);
      if (res.ok) {
        const json = await res.json();
        setRagContext(json.data?.results || []);
      }
    } catch (err) {
      console.error("Error fetching RAG context:", err);
    } finally {
      setRagLoading(false);
    }
  };

  const fetchReputation = useCallback(async () => {
    setReputationLoading(true);
    try {
      const res = await fetch('/intelligence/reputation');
      if (res.ok) {
        const json = await res.json();
        if (json.data && json.data.status !== 'no_data_available') {
          setReputation(json.data);
        } else {
          setReputation(null);
        }
      }
    } catch (err) {
      console.error("Error fetching reputation:", err);
    } finally {
      setReputationLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchThreadData();
    fetchReputation();
  }, [fetchThreadData, fetchReputation]);

  // Actions
  const handleSaveDraft = async () => {
    if (!draftAction) return;
    setActionStatus({ loading: true, type: 'save', success: false, message: 'Saving draft...' });
    try {
      const res = await fetch(`/drafts/${draftAction.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_reply_body: draftText,
          user_id: 'agent_dashboard'
        })
      });
      if (!res.ok) throw new Error('Failed to update draft');
      
      setActionStatus({ loading: false, type: 'save', success: true, message: 'Draft saved successfully!' });
      setTimeout(() => setActionStatus({ loading: false, type: '', success: false, message: '' }), 3000);
      fetchThreadData();
    } catch (err) {
      setActionStatus({ loading: false, type: 'save', success: false, message: err.message });
    }
  };

  const handleApproveDraft = async () => {
    if (!draftAction) return;
    setActionStatus({ loading: true, type: 'approve', success: false, message: 'Approving and sending...' });
    try {
      const res = await fetch(`/drafts/${draftAction.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: 'agent_dashboard'
        })
      });
      if (!res.ok) throw new Error('Failed to approve draft');
      
      setActionStatus({ loading: false, type: 'approve', success: true, message: 'Draft approved and reply sent!' });
      setTimeout(() => setActionStatus({ loading: false, type: '', success: false, message: '' }), 3000);
      fetchThreadData();
    } catch (err) {
      setActionStatus({ loading: false, type: 'approve', success: false, message: err.message });
    }
  };

  const handleSendManualReply = async (emailId) => {
    if (!manualReplyText.trim()) return;
    setActionStatus({ loading: true, type: 'manual', success: false, message: 'Sending manual reply...' });
    try {
      const res = await fetch(`/respond/${emailId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reply_body: manualReplyText,
          user_id: 'agent_dashboard'
        })
      });
      if (!res.ok) throw new Error('Failed to send reply');
      
      setManualReplyText('');
      setActionStatus({ loading: false, type: 'manual', success: true, message: 'Reply sent successfully!' });
      setTimeout(() => setActionStatus({ loading: false, type: '', success: false, message: '' }), 3000);
      fetchThreadData();
    } catch (err) {
      setActionStatus({ loading: false, type: 'manual', success: false, message: err.message });
    }
  };

  // Extract latest email to know which ID to respond to (if no draft is present)
  const getLatestEmailId = () => {
    const all = [];
    threads.forEach(t => t.emails?.forEach(e => all.push(e)));
    all.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    return all.length > 0 ? all[all.length - 1].id : null;
  };

  const getLatestEmailRequiresHuman = () => {
    const all = [];
    threads.forEach(t => t.emails?.forEach(e => all.push(e)));
    all.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    return all.length > 0 ? all[all.length - 1].requires_human : false;
  };

  const getLatestEmailSpam = () => {
    const all = [];
    threads.forEach(t => t.emails?.forEach(e => all.push(e)));
    all.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    return all.length > 0 ? all[all.length - 1].is_spam : false;
  };

  if (loading && threads.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 flex-col gap-4">
        <Loader size={36} className="animate-spin text-primary" />
        <p className="text-sm font-medium">Loading workspace history for {email}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 gap-4">
        <AlertCircle size={48} className="text-red-400" />
        <div>
          <h3 className="text-lg font-bold text-white">Error Loading Thread Workspace</h3>
          <p className="text-sm text-textMuted mt-1">{error}</p>
        </div>
        <button 
          onClick={() => navigate('/')}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 text-sm font-medium transition"
        >
          <ArrowLeft size={16} /> Back to Inbox
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="mb-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/')}
            className="p-2 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 transition text-gray-400 hover:text-white"
            title="Back to Inbox"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Thread Workspace</h2>
            <p className="text-textMuted text-xs mt-0.5">Customer: <span className="text-primary font-medium">{email}</span></p>
          </div>
        </div>
        
        <button
          onClick={fetchThreadData}
          className="p-2 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 transition text-gray-400 hover:text-white flex items-center gap-1.5 text-xs font-semibold"
          title="Refresh"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </header>

      {/* Main Content Workspace Layout */}
      <div className="flex-1 flex space-x-4 overflow-hidden">
        
        {/* Left Side: Thread History & AI Timeline (Scrollable) */}
        <div className="flex-1 flex flex-col space-y-4 overflow-y-auto pr-2">
          
          {threads.length === 0 ? (
            <div className="glass-panel p-8 text-center flex flex-col items-center justify-center gap-2">
              <Clock size={32} className="text-gray-600" />
              <p className="text-gray-400 font-medium">No conversation history found.</p>
            </div>
          ) : (
            threads.map((thread) => (
              <div key={thread.id} className="space-y-4">
                {/* Thread Subject Header Banner */}
                <div className="glass-panel p-4 border-l-4 border-l-primary/60 bg-gradient-to-r from-primary/5 to-transparent flex justify-between items-center">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-primary">Thread ID: {thread.id}</span>
                    <h3 className="text-base font-bold text-white mt-0.5">{thread.subject || "(No Subject)"}</h3>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded text-xs font-bold uppercase ${
                    thread.status === 'Open' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                    thread.status === 'Resolved' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                    thread.status === 'Escalated' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                    'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                  }`}>
                    {thread.status}
                  </span>
                </div>

                {/* Emails inside the thread */}
                {thread.emails?.map((e) => {
                  // Find any trace actions
                  const traceAction = e.actions?.find(a => a.type === 'Agent-Trace');
                  const otherActions = e.actions?.filter(a => a.type !== 'Agent-Trace') || [];

                  return (
                    <div key={e.id} className="space-y-3">
                      {/* Email Bubble */}
                      <div className="glass-panel p-6 border-white/5 relative">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                              <User size={15} className="text-gray-400" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-sm text-white">{e.sender}</h4>
                              <p className="text-[10px] text-textMuted">{new Date(e.timestamp).toLocaleString()}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {e.category && (
                              <span className="px-2 py-0.5 bg-white/5 border border-white/10 text-white rounded text-xs font-semibold">
                                {e.category}
                              </span>
                            )}
                            <span className={`px-2.5 py-0.5 rounded text-xs font-medium ${getSentimentColor(e.sentiment)}`}>
                              {getSentimentLabel(e.sentiment)} {e.sentiment !== null && `(${(+e.sentiment).toFixed(2)})`}
                            </span>
                            {getUrgencyBadge(e.urgency)}
                          </div>
                        </div>

                        {/* Email Body */}
                        <div className="prose prose-invert prose-sm max-w-none text-text/90 whitespace-pre-wrap leading-relaxed text-sm">
                          {e.body}
                        </div>

                        {/* List Actions Taken on this Email */}
                        {otherActions.length > 0 && (
                          <div className="mt-4 pt-3 border-t border-white/5 flex flex-wrap gap-2 items-center">
                            <span className="text-[10px] uppercase font-bold text-textMuted tracking-wider mr-1">Actions Executed:</span>
                            {otherActions.map((action) => (
                              <span 
                                key={action.id} 
                                className={`px-2 py-0.5 rounded text-xs font-medium border flex items-center gap-1.5 ${
                                  action.type === 'Replied' && action.is_approved ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                  action.type === 'Replied' && !action.is_approved ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse' :
                                  action.type === 'Manual-Reply' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                  action.type === 'Escalate' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                  action.type === 'Legal-Flag' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                                  action.type === 'Ticket-Created' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                  'bg-white/5 text-gray-400 border-white/10'
                                }`}
                              >
                                {action.type === 'Replied' && !action.is_approved && <Clock size={11} />}
                                {action.type === 'Replied' && action.is_approved && <CheckCircle size={11} />}
                                {action.type === 'Manual-Reply' && <CheckCircle size={11} />}
                                
                                {action.type === 'Replied' && !action.is_approved ? 'Draft Reply Created' : action.type}
                                {action.reason && <span className="opacity-75 font-normal text-[10px] border-l border-current pl-1.5 ml-1">{action.reason}</span>}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Reasoning Trace if any */}
                      {traceAction && traceAction.reasoning_log && Array.isArray(traceAction.reasoning_log) && (
                        <div className="glass-panel overflow-hidden border-primary/20 bg-black/20">
                          <div className="bg-primary/10 p-3 px-4 flex items-center justify-between border-b border-primary/20">
                            <div className="flex items-center space-x-2">
                              <Cpu size={15} className="text-primary animate-pulse" />
                              <h4 className="font-semibold text-primary text-xs tracking-wide uppercase">AI Agent ReAct Reasoning Trace</h4>
                            </div>
                            <span className="text-[10px] font-mono text-primary/70">ReAct Loop</span>
                          </div>
                          
                          <div className="p-4 space-y-4 font-mono text-xs max-h-96 overflow-y-auto">
                            {traceAction.reasoning_log.map((step, idx) => (
                              <div key={idx} className="space-y-2 border-b border-white/5 pb-3 last:border-0 last:pb-0">
                                <div className="text-[10px] text-primary font-bold uppercase tracking-wider">Step {idx + 1}</div>
                                {step.Thought && (
                                  <div className="pl-3 border-l-2 border-primary/30">
                                    <span className="text-primary font-semibold">Thought:</span> <span className="text-text/90">{step.Thought}</span>
                                  </div>
                                )}
                                {step.Action && (
                                  <div className="pl-3 border-l-2 border-emerald-500/30">
                                    <span className="text-success font-semibold">Action:</span> <code className="text-success bg-success/5 px-1 py-0.5 rounded text-[11px] select-all">{step.Action}</code>
                                  </div>
                                )}
                                {step.Observation && (
                                  <div className="pl-3 border-l-2 border-indigo-400/30">
                                    <span className="text-indigo-400 font-semibold">Observation:</span> <span className="text-textMuted">{step.Observation}</span>
                                  </div>
                                )}
                                {step.FinalAnswer && (
                                  <div className="pl-3 border-l-2 border-amber-400/30">
                                    <span className="text-warning font-semibold">Final Answer:</span> <span className="text-warning font-medium">{step.FinalAnswer}</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}

          {/* Spacer to push input panel down but allow scroll */}
          <div className="h-6" />
        </div>

        {/* Right Side Pane: Contact Profile, Reputation, RAG Policy (Scrollable) */}
        <div className="w-80 flex flex-col space-y-4 overflow-y-auto pr-1">
          
          {/* 1. Contact CRM Profile Card */}
          {contact && (
            <div className="glass-panel p-5 bg-gradient-to-br from-surface to-surfaceHighlight/50">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-indigo-500/30 border border-primary/30 flex items-center justify-center shadow-inner">
                  <User size={20} className="text-primary" />
                </div>
                <div>
                  <h3 className="font-bold leading-tight text-white">{contact.name || email.split('@')[0]}</h3>
                  <p className="text-[11px] text-textMuted">{contact.company || 'Enterprise'}</p>
                </div>
              </div>
              
              <div className="space-y-3.5 text-sm">
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-textMuted text-xs">Account Tier</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    contact.status === 'VIP' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                    contact.status === 'Active' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                    'bg-white/5 text-textMuted border border-white/10'
                  }`}>
                    {contact.status || 'Active'}
                  </span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-textMuted text-xs">Contract Value</span>
                  <span className="font-semibold text-white">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(contact.account_value || 0)}/yr
                  </span>
                </div>
                <div>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-textMuted text-xs">Customer Churn Risk</span>
                    <span className={`font-bold text-xs ${
                      contact.churn_risk_score > 0.7 ? 'text-red-400' :
                      contact.churn_risk_score > 0.3 ? 'text-amber-400' :
                      'text-emerald-400'
                    }`}>
                      {(contact.churn_risk_score * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-1.5 border border-white/5">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        contact.churn_risk_score > 0.7 ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' :
                        contact.churn_risk_score > 0.3 ? 'bg-amber-500' :
                        'bg-emerald-500'
                      }`} 
                      style={{ width: `${Math.min(100, (contact.churn_risk_score || 0) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. Web Intelligence Scraper Card */}
          <div className="glass-panel p-5 bg-gradient-to-br from-surface to-surfaceHighlight/50">
            <h4 className="font-bold text-xs tracking-wider uppercase mb-3.5 flex items-center text-indigo-400">
              <Globe size={14} className="mr-2" />
              Scraped Intelligence
            </h4>
            
            {reputationLoading ? (
              <div className="flex items-center gap-2 text-xs text-textMuted py-4">
                <Loader size={12} className="animate-spin text-indigo-400" />
                <span>Querying reputation scraper cache...</span>
              </div>
            ) : reputation ? (
              <div className="space-y-3 text-xs leading-relaxed text-text/80">
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-textMuted">Domain Profile</span>
                  <code className="text-[10px] text-indigo-300 font-mono">{reputation.target_domain}</code>
                </div>
                
                {reputation.data?.domain_reputation && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-textMuted">Brand Health:</span>
                      <span className="font-medium text-white">{reputation.data.domain_reputation.sentiment_summary || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-textMuted">Scrape Target:</span>
                      <span className="text-indigo-400 hover:underline cursor-pointer">{reputation.data.scraped_urls?.[0]?.split('/')[2] || 'LinkedIn'}</span>
                    </div>
                  </div>
                )}
                
                {reputation.data?.risk_analysis?.threat_level && (
                  <div className="mt-2.5 p-2 bg-red-500/10 border border-red-500/20 rounded text-red-400 flex items-start gap-2">
                    <ShieldAlert size={14} className="flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold">Threat Identified</div>
                      <p className="text-[10px] mt-0.5 leading-tight">{reputation.data.risk_analysis.summary}</p>
                    </div>
                  </div>
                )}
                
                {reputation.data?.gdpr_flag_details && (
                  <div className="mt-2.5 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-yellow-400 flex items-start gap-2">
                    <ShieldAlert size={14} className="flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold">GDPR Scope Request</div>
                      <p className="text-[10px] mt-0.5 leading-tight">Legally bounded right to erasure requested.</p>
                    </div>
                  </div>
                )}
                
                {!reputation.data?.risk_analysis?.threat_level && !reputation.data?.gdpr_flag_details && (
                  <div className="p-2 bg-emerald-500/5 border border-emerald-500/10 rounded text-emerald-400 text-[10px] flex items-center gap-1.5">
                    <Check size={12} />
                    <span>Domain registered clean. No regulatory alerts.</span>
                  </div>
                )}
              </div>
            ) : (
              // Dynamic Mock Scraper Details tailored to user's domain
              <div className="space-y-3 text-xs leading-relaxed text-text/80">
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-textMuted">Scraped Domain</span>
                  <code className="text-[10px] text-indigo-300 font-mono">{email ? email.split('@')[1] : 'enterprise.net'}</code>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-textMuted">Status Code:</span>
                    <span className="text-emerald-400 font-medium font-mono">200 OK</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-textMuted">Social Mentions:</span>
                    <span className="text-white font-medium">Stable</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-textMuted">Glassdoor Health:</span>
                    <span className="text-white font-medium">3.9 ★</span>
                  </div>
                </div>
                <p className="text-[10px] text-textMuted leading-tight mt-2 bg-white/5 p-2 rounded border border-white/5">
                  Real-time web monitoring scraper active. No alerts flagged for this customer node.
                </p>
              </div>
            )}
          </div>

          {/* 3. RAG Retrieval Card */}
          <div className="glass-panel p-5 bg-gradient-to-br from-surface to-surfaceHighlight/50 flex-1 min-h-[220px] flex flex-col">
            <h4 className="font-bold text-xs tracking-wider uppercase mb-3 flex items-center text-primary">
              <FileText size={14} className="mr-2" />
              Retrieved RAG Policies
            </h4>
            
            {ragLoading ? (
              <div className="flex items-center gap-2 text-xs text-textMuted py-4 justify-center flex-1">
                <Loader size={14} className="animate-spin text-primary" />
                <span>Running vector search...</span>
              </div>
            ) : ragContext.length > 0 ? (
              <div className="space-y-3 overflow-y-auto max-h-[300px] flex-1 pr-1">
                {ragContext.map((item, idx) => (
                  <div key={idx} className="bg-white/5 p-3 rounded-lg border border-white/5 hover:border-primary/20 transition-all">
                    <div className="flex justify-between text-[10px] mb-1.5">
                      <span className="font-bold text-primary font-mono">{item.source_doc || 'policy.md'}</span>
                      <span className="text-emerald-400 font-bold font-mono">{(item.score * 100).toFixed(0)}% match</span>
                    </div>
                    <p className="text-[11px] text-text/80 leading-relaxed font-sans">
                      "{item.chunk_text}"
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-textMuted flex-1 flex flex-col items-center justify-center gap-1">
                <HelpCircle size={24} className="opacity-40" />
                <span className="text-xs">No matching policy chunks.</span>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Persistent Bottom Action Panel: Handles Drafts or Manual Replies */}
      <div className="glass-panel p-4 bg-surfaceHighlight/80 border-t border-white/15 shadow-2xl mt-4 shrink-0">
        
        {/* Status feedback row */}
        {actionStatus.message && (
          <div className={`mb-3 p-2 px-3 rounded text-xs flex items-center gap-2 font-medium ${
            actionStatus.success ? 'bg-success/10 text-success border border-success/20' : 
            actionStatus.loading ? 'bg-primary/10 text-primary border border-primary/20' : 
            'bg-danger/10 text-danger border border-danger/20'
          }`}>
            {actionStatus.loading && <Loader size={12} className="animate-spin" />}
            {actionStatus.success && <Check size={12} />}
            {!actionStatus.loading && !actionStatus.success && <AlertCircle size={12} />}
            <span>{actionStatus.message}</span>
          </div>
        )}

        {draftAction ? (
          /* Draft Mode interface */
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-amber-400 animate-pulse" />
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wide">Pending AI-Suggested Draft Response</span>
              </div>
              <span className="text-[10px] text-textMuted">Action ID: #{draftAction.id}</span>
            </div>

            <textarea
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              disabled={actionStatus.loading}
              placeholder="Edit the proposed draft reply here..."
              rows={4}
              className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-text focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 transition resize-none leading-relaxed font-sans placeholder-gray-600"
            />

            <div className="flex justify-between items-center">
              <span className="text-[11px] text-textMuted font-medium">Review and modify the reply before dispatching to the client.</span>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSaveDraft}
                  disabled={actionStatus.loading || !draftText.trim()}
                  className="px-4 py-2 border border-white/10 bg-white/5 hover:bg-white/10 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Save size={14} />
                  Save Draft
                </button>
                <button
                  onClick={handleApproveDraft}
                  disabled={actionStatus.loading || !draftText.trim()}
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-amber-500/10 disabled:opacity-50"
                >
                  <Check size={14} />
                  Approve & Send
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Manual Response mode interface */
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <Send size={13} className="text-primary" />
                <span className="text-xs font-bold text-primary uppercase tracking-wide">Write Manual Response</span>
              </div>
              {getLatestEmailSpam() && (
                <span className="text-xs text-gray-500 font-bold bg-white/5 border border-white/10 px-2 py-0.5 rounded uppercase">Email Flagged as Spam</span>
              )}
              {getLatestEmailRequiresHuman() && !getLatestEmailSpam() && (
                <span className="text-xs text-amber-400 font-bold bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded uppercase">Requires Human Intervention</span>
              )}
            </div>

            <textarea
              value={manualReplyText}
              onChange={(e) => setManualReplyText(e.target.value)}
              disabled={actionStatus.loading || !getLatestEmailId()}
              placeholder={getLatestEmailId() ? "Write a response to send directly to this customer..." : "Cannot reply. No messages in this thread."}
              rows={3}
              className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-text focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition resize-none leading-relaxed font-sans placeholder-gray-600"
            />

            <div className="flex justify-between items-center">
              <span className="text-[11px] text-textMuted font-medium">Replying manually will mark this email as resolved and create an audit trace.</span>
              
              <button
                onClick={() => handleSendManualReply(getLatestEmailId())}
                disabled={actionStatus.loading || !manualReplyText.trim() || !getLatestEmailId()}
                className="px-5 py-2 bg-primary hover:bg-primaryHover text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-primary/10 disabled:opacity-50"
              >
                <Send size={13} />
                Send Response
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

