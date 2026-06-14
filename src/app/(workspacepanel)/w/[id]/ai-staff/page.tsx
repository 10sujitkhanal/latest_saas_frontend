'use client';

import { useState, useEffect, useCallback, use as reactUse } from 'react';
import Link from 'next/link';
import { Bot, Sparkles, Plus, Clock, CheckCircle2, XCircle, AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { AgentsService, type AgentTask, type AgentProfile } from '@/services/agents.service';
import StoreAgentCard from '@/components/agents/StoreAgentCard';
import CrmAgentCard from '@/components/agents/CrmAgentCard';
import OffersAgentCard from '@/components/agents/OffersAgentCard';
import FinanceAgentCard from '@/components/agents/FinanceAgentCard';
import MarketingAgentCard from '@/components/agents/MarketingAgentCard';
import LoyaltyAgentCard from '@/components/agents/LoyaltyAgentCard';
import BookingsAgentCard from '@/components/agents/BookingsAgentCard';
import StaffAgentCard from '@/components/agents/StaffAgentCard';
import ProjectsAgentCard from '@/components/agents/ProjectsAgentCard';
import SeoAgentCard from '@/components/agents/SeoAgentCard';
import AgentChat from '@/components/agents/AgentChat';
import AgentShell from '@/components/agents/AgentShell';
import { AGENT_MODULE_LIST, agentModule, type AgentModuleType } from '@/lib/agents/modules';

/**
 * AI Staff — your AI team. Every agent (built-in defaults + the ones you create)
 * renders as ONE big card: name · type · In use/Use · Clone · Delete · Train,
 * wrapping that agent's own work surface. No duplicate lists. Each proposal +
 * decision is logged in the shared Activity queue below.
 */

const STATUS_META: Record<AgentTask['status'], { label: string; cls: string; Icon: typeof Clock }> = {
  proposed: { label: 'Awaiting you', cls: 'bg-amber-500/15 text-amber-300', Icon: Clock },
  executed: { label: 'Created', cls: 'bg-emerald-500/15 text-emerald-300', Icon: CheckCircle2 },
  rejected: { label: 'Rejected', cls: 'bg-white/[0.06] text-slate-500', Icon: XCircle },
  failed: { label: 'Failed', cls: 'bg-rose-500/15 text-rose-300', Icon: AlertTriangle },
};


export default function AiStaffPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: workspaceId } = reactUse(params);

  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [profiles, setProfiles] = useState<AgentProfile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newType, setNewType] = useState<AgentModuleType>('crm');
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  const loadTasks = useCallback(async () => {
    try {
      const res = await AgentsService.listTasks(workspaceId);
      if (res.success) setTasks(res.data || []);
    } catch { /* non-fatal */ }
  }, [workspaceId]);

  const loadProfiles = useCallback(async () => {
    try {
      const res = await AgentsService.listProfiles(workspaceId);
      if (res.success) setProfiles(res.data || []);
    } catch { /* non-fatal */ }
    finally { setLoadingProfiles(false); }
  }, [workspaceId]);

  useEffect(() => { loadTasks(); loadProfiles(); }, [loadTasks, loadProfiles]);

  const refresh = useCallback(() => { loadProfiles(); loadTasks(); }, [loadProfiles, loadTasks]);

  const createAgent = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await AgentsService.createProfile(workspaceId, {
        agent_type: newType, name: newName.trim() || `New ${newType.toUpperCase()} agent`, instructions: '',
      });
      if (r.success) { toast.success('Agent created.'); setCreating(false); setNewName(''); loadProfiles(); }
      else toast.error(r.message || 'Could not create.');
    } catch { toast.error('Could not create.'); }
    finally { setBusy(false); }
  };

  // One card per agent, grouped by type, the in-use one first within each type.
  const sorted = [...profiles].sort((a, b) =>
    a.agent_type.localeCompare(b.agent_type) || (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0));
  const pendingCount = tasks.filter((t) => t.status === 'proposed').length;

  const workFor = (p: AgentProfile) => {
    if (p.agent_type === 'crm') return <CrmAgentCard workspaceId={workspaceId} embed pipeline={p.pipeline} />;
    if (p.agent_type === 'store') return <StoreAgentCard workspaceId={workspaceId} embed />;
    if (p.agent_type === 'offers') return <OffersAgentCard workspaceId={workspaceId} embed onChanged={loadTasks} />;
    if (p.agent_type === 'finance') return <FinanceAgentCard workspaceId={workspaceId} embed />;
    if (p.agent_type === 'marketing') return <MarketingAgentCard workspaceId={workspaceId} embed />;
    if (p.agent_type === 'loyalty') return <LoyaltyAgentCard workspaceId={workspaceId} embed />;
    if (p.agent_type === 'bookings') return <BookingsAgentCard workspaceId={workspaceId} embed />;
    if (p.agent_type === 'hr') return <StaffAgentCard workspaceId={workspaceId} embed />;
    if (p.agent_type === 'projects') return <ProjectsAgentCard workspaceId={workspaceId} embed />;
    if (p.agent_type === 'seo') return <SeoAgentCard workspaceId={workspaceId} embed />;
    // Module owned + trainable; its automation is on the way.
    return (
      <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-5 text-center">
        <p className="text-sm font-semibold text-slate-300">Automation coming soon</p>
        <p className="mt-1 text-[12px] text-slate-400">You can already name + train this agent for its module — its hands-on actions are being built next.</p>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow">
          <Bot className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-white">AI Staff</h1>
          <p className="text-sm text-slate-500">Each agent does its own work — you approve it. Every decision is logged.</p>
        </div>
        <div className="ml-auto hidden shrink-0 text-right sm:block">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
            <Sparkles className="h-3.5 w-3.5" /> Powered by MoreTech AI
          </span>
          <p className="mt-1 text-[10px] text-slate-400">Your private AI. Bring-your-own model coming soon.</p>
        </div>
      </div>

      {/* Chatroom — ask your AI staff in plain words; it routes to the right agent */}
      <div className="mt-5">
        <AgentChat workspaceId={workspaceId} onActed={refresh} />
      </div>

      {/* New agent */}
      <div className="mt-5">
        {!creating ? (
          <button type="button" onClick={() => { setCreating(true); setNewName(''); }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.02] px-3.5 py-2 text-sm font-semibold text-slate-200 shadow-sm hover:border-white/15">
            <Plus className="h-4 w-4" /> New agent
          </button>
        ) : (
          <div className="space-y-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Which module should it own?</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {AGENT_MODULE_LIST.map((m) => (
                <button key={m.type} type="button" onClick={() => setNewType(m.type)}
                  className={`flex items-start gap-2 rounded-xl border p-2 text-left ${newType === m.type ? 'border-emerald-500/40 bg-white/[0.02] shadow-sm' : 'border-white/10 bg-white/60 hover:bg-white'}`}>
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${m.chip}`}><m.Icon className="h-4 w-4" /></span>
                  <span className="min-w-0">
                    <span className={`block truncate text-[13px] font-semibold ${newType === m.type ? 'text-emerald-300' : 'text-slate-200'}`}>{m.module}</span>
                    <span className="block text-[10px] text-slate-400">{m.built ? 'Ready' : 'Coming soon'}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus
                placeholder={`Name (e.g. ${agentModule(newType).label} ${newType === 'crm' ? 'B2B' : 'team'})`}
                onKeyDown={(e) => { if (e.key === 'Enter') createAgent(); if (e.key === 'Escape') setCreating(false); }}
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-1.5 text-sm text-white outline-none focus:border-emerald-400/50" />
              <button type="button" onClick={createAgent} disabled={busy}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">Create agent</button>
              <button type="button" onClick={() => setCreating(false)}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/[0.02]">Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* One big card per agent */}
      {loadingProfiles ? (
        <div className="mt-6 py-10 text-center text-sm text-slate-400"><Loader2 className="mr-1 inline h-4 w-4 animate-spin" /> Loading your agents…</div>
      ) : (
        <div className="mt-6 grid items-start gap-4 lg:grid-cols-2">
          {sorted.map((p) => (
            <AgentShell key={p.id} workspaceId={workspaceId} profile={p} onChanged={refresh}>
              {workFor(p)}
            </AgentShell>
          ))}
        </div>
      )}

      {/* Activity — the shared audit trail across all agents */}
      <div className="mt-8">
        <div className="mb-2 flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-200">Activity</h3>
          {pendingCount > 0 && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300">{pendingCount} awaiting you</span>
          )}
        </div>
        {tasks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center text-sm text-slate-400">
            No agent activity yet. Give an agent a task above.
          </p>
        ) : (
          <ul className="space-y-2">
            {tasks.map((t) => {
              const m = STATUS_META[t.status];
              return (
                <li key={t.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
                  <m.Icon className={`h-4 w-4 ${m.cls.split(' ')[1]}`} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-white">{t.title || t.goal || 'Offer'}</div>
                    <div className="truncate text-xs text-slate-400">{t.goal}{t.result?.code ? ` · ${t.result.code}` : ''}</div>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${m.cls}`}>{m.label}</span>
                  {t.status === 'executed' && (
                    <Link href={`/w/${workspaceId}/deals`} className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-300 hover:underline">
                      Deals <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Coming-soon roster — modules that don't have a working agent yet (registry-driven) */}
      {AGENT_MODULE_LIST.some((m) => !m.built) && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {AGENT_MODULE_LIST.filter((m) => !m.built).map((m) => (
            <div key={m.type} className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-3 py-3 text-center">
              <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500"><m.Icon className="h-3.5 w-3.5" />{m.label} agent</div>
              <div className="text-[11px] text-slate-400">coming soon</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
