'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, Trash2, GraduationCap, Loader2, ChevronDown, ChevronUp, GitBranch, Pencil, X, MessageSquare, Activity, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { AgentsService, type AgentProfile, type AgentActivityItem } from '@/services/agents.service';
import { OrganizationService } from '@/services/organization.service';
import { agentModule } from '@/lib/agents/modules';
import AgentChat from './AgentChat';

type PipelineLite = { id: number; name: string };

const PLACEHOLDER = `Teach this agent how to work, e.g.
• Tone: warm and casual, never pushy.
• Always offer the starter bundle to new leads.
• Never discount more than 15% without approval.`;

/**
 * One big card per agent: a consistent header (name · type · In use / Use ·
 * Clone · Delete · Train) wrapping that agent's work surface (passed as children).
 * Replaces the old "roster + trainer + stacked work cards" duplication — every
 * agent now looks and behaves like the Store/Offers cards.
 */
export default function AgentShell({ workspaceId, profile, onChanged, children }: {
  workspaceId: string | number;
  profile: AgentProfile;
  onChanged: () => void;
  children: React.ReactNode;
}) {
  const meta = agentModule(profile.agent_type);
  const [training, setTraining] = useState(false);
  const [chatting, setChatting] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [activity, setActivity] = useState<AgentActivityItem[] | null>(null);
  const [loadingActivity, setLoadingActivity] = useState(false);

  const toggleActivity = async () => {
    const next = !showActivity;
    setShowActivity(next);
    if (next && activity === null && !loadingActivity) {
      setLoadingActivity(true);
      try {
        const r = await AgentsService.activity(workspaceId, profile.agent_type, 20);
        if (r.success) setActivity(r.data?.activities || []);
        else toast.error(r.message || 'Could not load activity.');
      } catch { toast.error('Could not load activity.'); }
      finally { setLoadingActivity(false); }
    }
  };
  const [instructions, setInstructions] = useState(profile.instructions || '');
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pipelines, setPipelines] = useState<PipelineLite[]>([]);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(profile.name);
  const dirty = instructions !== (profile.instructions || '');

  const saveName = async () => {
    const name = nameDraft.trim();
    if (!name || name === profile.name) { setRenaming(false); return; }
    setBusy(true);
    try {
      const r = await AgentsService.updateProfile(workspaceId, profile.id, { name });
      if (r.success) { toast.success('Renamed.'); setRenaming(false); onChanged(); } else toast.error(r.message || 'Could not rename.');
    } catch { toast.error('Could not rename.'); } finally { setBusy(false); }
  };

  // CRM agents can be scoped to a pipeline (the leads they work).
  useEffect(() => {
    if (profile.agent_type !== 'crm') return;
    OrganizationService.listPipelines().then((r) => {
      if (!r?.success) return;
      // The tenant can have same-named pipelines (seeded per industry) — show each
      // name once so the picker is clean.
      const seen = new Set<string>();
      const uniq = ((r.data as PipelineLite[]) || []).filter((p) => {
        const k = (p.name || '').trim().toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k); return true;
      });
      setPipelines(uniq);
    }).catch(() => {});
  }, [profile.agent_type]);

  const setPipeline = async (id: number | null) => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await AgentsService.updateProfile(workspaceId, profile.id, { pipeline: id });
      if (r.success) { toast.success(id ? 'Agent scoped to that pipeline.' : 'Agent now works all leads.'); onChanged(); }
      else toast.error(r.message || 'Could not update scope.');
    } catch { toast.error('Could not update scope.'); } finally { setBusy(false); }
  };

  const saveTraining = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const r = await AgentsService.updateProfile(workspaceId, profile.id, { instructions });
      if (r.success) { toast.success('Agent trained.'); onChanged(); } else toast.error(r.message || 'Could not save.');
    } catch { toast.error('Could not save.'); } finally { setSaving(false); }
  };
  const useThis = async () => {
    if (busy || profile.is_default) return;
    setBusy(true);
    try {
      const r = await AgentsService.updateProfile(workspaceId, profile.id, { is_default: true });
      if (r.success) { toast.success(`"${profile.name}" is now in use.`); onChanged(); } else toast.error(r.message || 'Could not switch.');
    } catch { toast.error('Could not switch.'); } finally { setBusy(false); }
  };
  const clone = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await AgentsService.cloneProfile(workspaceId, profile.id, { name: `${profile.name} (copy)` });
      if (r.success) { toast.success('Agent cloned.'); onChanged(); } else toast.error(r.message || 'Could not clone.');
    } catch { toast.error('Could not clone.'); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (busy || profile.is_default) return;
    if (!confirm(`Delete agent "${profile.name}"?`)) return;
    setBusy(true);
    try {
      const r = await AgentsService.deleteProfile(workspaceId, profile.id);
      if (r.success) { toast.success('Agent deleted.'); onChanged(); } else toast.error(r.message || 'Could not delete.');
    } catch { toast.error('Could not delete.'); } finally { setBusy(false); }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${meta.chip}`}><meta.Icon className="h-5 w-5" /></span>
        {renaming ? (
          <span className="flex items-center gap-1">
            <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { setRenaming(false); setNameDraft(profile.name); } }}
              className="w-40 rounded-lg border border-white/15 px-2 py-1 text-base font-semibold text-white outline-none focus:border-emerald-500/40" />
            <button type="button" onClick={saveName} disabled={busy} className="rounded-lg bg-emerald-600 p-1 text-white hover:bg-emerald-700"><Check className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => { setRenaming(false); setNameDraft(profile.name); }} className="rounded-lg border border-white/10 p-1 text-slate-500"><X className="h-3.5 w-3.5" /></button>
          </span>
        ) : (
          <button type="button" onClick={() => { setNameDraft(profile.name); setRenaming(true); }} className="group inline-flex items-center gap-1.5">
            <h2 className="text-base font-semibold text-white">{profile.name}</h2>
            <Pencil className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500" />
          </button>
        )}
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${meta.badge}`}>{meta.label}</span>
        {profile.is_default
          ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300"><Check className="h-3 w-3" /> In use</span>
          : <button type="button" onClick={useThis} disabled={busy} className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">Use this agent</button>}
        <div className="ml-auto flex items-center gap-1">
          {meta.built && (
            <button type="button" onClick={() => setChatting((v) => !v)} className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold ${chatting ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-white/10 text-slate-300 hover:bg-white/[0.03]'}`}>
              <MessageSquare className="h-3.5 w-3.5" /> Chat {chatting ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          )}
          {meta.built && (
            <button type="button" onClick={toggleActivity} className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold ${showActivity ? 'border-white/15 bg-white/[0.03] text-slate-200' : 'border-white/10 text-slate-300 hover:bg-white/[0.03]'}`}>
              <Activity className="h-3.5 w-3.5" /> Activity {showActivity ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          )}
          <button type="button" onClick={() => setTraining((v) => !v)} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[11px] font-semibold text-slate-300 hover:bg-white/[0.03]">
            <GraduationCap className="h-3.5 w-3.5" /> Train {training ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          <button type="button" onClick={clone} disabled={busy} title="Clone" className="rounded-lg border border-white/10 p-1.5 text-slate-500 hover:bg-white/[0.03] disabled:opacity-50"><Copy className="h-3.5 w-3.5" /></button>
          {!profile.is_default && <button type="button" onClick={remove} disabled={busy} title="Delete" className="rounded-lg border border-white/10 p-1.5 text-slate-400 hover:bg-rose-500/15 hover:text-rose-600 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /></button>}
        </div>
      </div>

      {/* Module ownership + capabilities — what this agent is responsible for */}
      <div className="mt-2.5">
        <p className="text-[11px] text-slate-500"><span className="font-semibold text-slate-300">Owns the {meta.module} module.</span> Handles:</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {meta.tasks.map((t) => (
            <span key={t} className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-slate-300">{t}</span>
          ))}
        </div>
      </div>

      {/* Scope — which pipeline this CRM agent works (its lane in the company) */}
      {profile.agent_type === 'crm' && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
          <GitBranch className="h-4 w-4 text-slate-400" />
          <span className="text-[12px] font-medium text-slate-300">Works on</span>
          <select value={profile.pipeline ?? ''} onChange={(e) => setPipeline(e.target.value ? Number(e.target.value) : null)} disabled={busy}
            className="rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-1 text-sm text-white outline-none focus:border-emerald-500/40">
            <option value="">All leads</option>
            {pipelines.map((pl) => <option key={pl.id} value={pl.id}>{pl.name}</option>)}
          </select>
          <span className="text-[11px] text-slate-400">Analyse + Find New Leads scope to this pipeline.</span>
        </div>
      )}

      {/* Training */}
      {training && (
        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={5} placeholder={PLACEHOLDER}
            className="w-full resize-y rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/40" />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">In plain words — the agent uses this when it works.</span>
            <button type="button" onClick={saveTraining} disabled={saving || !dirty} className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} {dirty ? 'Save training' : 'Saved'}
            </button>
          </div>
        </div>
      )}

      {/* What this agent has done — the per-agent report */}
      {showActivity && meta.built && (
        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
          {loadingActivity ? (
            <p className="flex items-center gap-2 text-xs text-slate-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading what {profile.name} has done…</p>
          ) : !activity || activity.length === 0 ? (
            <p className="text-xs text-slate-500">Nothing yet — when this agent does something (or you approve its work), it shows up here as a report.</p>
          ) : (
            <ul className="space-y-2">
              {activity.map((a) => (
                <li key={a.id} className="flex items-start gap-2">
                  <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md ${a.status === 'failed' ? 'bg-rose-500/15 text-rose-500' : a.status === 'pending' ? 'bg-amber-500/15 text-amber-600' : 'bg-emerald-500/15 text-emerald-600'}`}>
                    {a.status === 'failed' ? <AlertTriangle className="h-3 w-3" /> : a.status === 'pending' ? <Loader2 className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-white">{a.title}</p>
                    <p className="truncate text-[11px] text-slate-400">
                      {a.detail}{a.detail && (a.actor || a.created_at) ? ' · ' : ''}
                      {a.actor ? `${a.actor} · ` : ''}{new Date(a.created_at).toLocaleString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Talk to this agent directly — scoped to its module's commands */}
      {chatting && meta.built && (
        <div className="mt-3">
          <AgentChat
            workspaceId={workspaceId}
            agentType={profile.agent_type}
            title={`Chat with ${profile.name}`}
            placeholder={`Ask ${profile.name}…`}
            examples={meta.chatExamples}
            onActed={onChanged}
          />
        </div>
      )}

      {/* Work surface */}
      <div className="mt-4">{children}</div>
    </div>
  );
}
