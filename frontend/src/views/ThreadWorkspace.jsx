import React from 'react';
import { User, ShieldAlert, Cpu, FileText } from 'lucide-react';

export default function ThreadWorkspace() {
  return (
    <div className="h-full flex flex-col">
      <header className="mb-4">
        <h2 className="text-2xl font-bold tracking-tight">Thread Workspace</h2>
        <p className="text-textMuted text-sm">Reviewing bob.jones@enterprise.net</p>
      </header>

      <div className="flex-1 flex space-x-4 overflow-hidden">
        {/* Center/Left: Thread & Reasoning */}
        <div className="flex-1 flex flex-col space-y-4 overflow-y-auto pr-2">
          
          <div className="glass-panel p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold">Urgent: Complete system outage</h3>
                <p className="text-sm text-textMuted">Received 10 minutes ago</p>
              </div>
              <span className="px-3 py-1 bg-danger/20 text-danger border border-danger/30 rounded-md text-xs font-bold uppercase tracking-wider">
                Critical Priority
              </span>
            </div>
            <div className="prose prose-invert prose-sm max-w-none text-text/90">
              <p>To whom it may concern,</p>
              <p>Our entire production system just went down. We are losing <span className="border-b border-primary text-primary">thousands of dollars</span> every minute this is not resolved.</p>
              <p>If this isn't fixed within <span className="border-b border-primary text-primary">1 hour</span>, we will be escalating this to our legal team regarding a breach of our SLA.</p>
              <p>Bob</p>
            </div>
          </div>

          <div className="glass-panel overflow-hidden border-primary/20">
            <div className="bg-primary/10 p-3 px-4 flex items-center space-x-2 border-b border-primary/20">
              <Cpu size={18} className="text-primary" />
              <h4 className="font-semibold text-primary text-sm">Agent Reasoning Trace</h4>
            </div>
            <div className="p-4 space-y-3 font-mono text-xs">
              <div className="pl-3 border-l-2 border-primary/30">
                <span className="text-textMuted">Thought:</span> I need to check the thread history to see if there is prior context.
              </div>
              <div className="pl-3 border-l-2 border-green-500/30">
                <span className="text-success">Action:</span> get_thread_history("bob.jones@...")
              </div>
              <div className="pl-3 border-l-2 border-blue-500/30">
                <span className="text-primary">Observation:</span> [Prior history shows 47 min downtime yesterday]
              </div>
              <div className="pl-3 border-l-2 border-primary/30 mt-2">
                <span className="text-textMuted">Thought:</span> This involves an SLA breach and a legal threat. I must escalate.
              </div>
              <div className="pl-3 border-l-2 border-green-500/30">
                <span className="text-success">Action:</span> flag_for_legal("msg_123", "SLA breach legal escalation")
              </div>
            </div>
          </div>

          <div className="glass-panel p-4 flex justify-between items-center bg-surfaceHighlight/50 mt-auto">
            <button className="px-4 py-2 bg-white/5 border border-white/10 rounded-md text-sm hover:bg-white/10 transition">
              Edit Draft
            </button>
            <div className="space-x-2">
              <button className="px-4 py-2 bg-danger/10 text-danger border border-danger/20 rounded-md text-sm hover:bg-danger/20 transition">
                Mark Spam
              </button>
              <button className="px-4 py-2 bg-warning/10 text-warning border border-warning/20 rounded-md text-sm hover:bg-warning/20 transition font-medium flex-inline items-center">
                <ShieldAlert size={16} className="inline mr-2" />
                Escalate
              </button>
              <button className="px-4 py-2 bg-primary text-white rounded-md text-sm hover:bg-primaryHover transition shadow-lg font-medium">
                Approve & Send
              </button>
            </div>
          </div>
        </div>

        {/* Right Pane: Profile & RAG Context */}
        <div className="w-80 flex flex-col space-y-4">
          <div className="glass-panel p-5">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
                <User size={20} className="text-gray-300" />
              </div>
              <div>
                <h3 className="font-bold leading-tight">Bob Jones</h3>
                <p className="text-xs text-textMuted">Enterprise Net</p>
              </div>
            </div>
            
            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-textMuted">Account Value</span>
                <span className="font-medium">$12,500/yr</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-textMuted">Status</span>
                <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-500 rounded text-xs font-bold uppercase">VIP</span>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-textMuted">Churn Risk</span>
                  <span className="text-danger font-medium">85%</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-1.5">
                  <div className="bg-danger h-1.5 rounded-full" style={{ width: '85%' }}></div>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-panel p-5 flex-1 overflow-y-auto">
            <h4 className="font-bold mb-3 flex items-center text-sm">
              <FileText size={16} className="mr-2 text-primary" />
              RAG Context
            </h4>
            <div className="space-y-3">
              <div className="bg-surfaceHighlight p-3 rounded-lg border border-white/5">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-primary">sla_policy.md</span>
                  <span className="text-textMuted">92% match</span>
                </div>
                <p className="text-xs text-text/80 leading-relaxed">
                  ...SLA Breach and Service Credits. If downtime exceeds 43.8 minutes, customers are entitled to service credits calculated at 10% of monthly fee per hour...
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
