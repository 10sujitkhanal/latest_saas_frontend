'use client';

/**
 * Train your AI agents — Phase C.
 *
 * Each agent is a profile with freeform instructions the owner trains it with
 * ("always offer the starter bundle, never discount over 15%, keep it casual").
 * The same engine runs every profile; the instructions shape how it behaves —
 * so you can clone a CRM agent into a B2C one and a B2B one and train each
 * differently. The agent actually USES this (injected into its prompt).
 */

import { useEffect, useState } from 'react';
import { Bot, Plus, Copy, Trash2, Loader2, Save, GraduationCap, ChevronUp, ChevronDown, Check } from 'lucide-react';
import { toast } from 'sonner';
import { AgentsService, type AgentProfile } from '@/services/agents.service';

const PLACEHOLDER = `Teach this agent how to work. For example:
• Tone: warm and casual, never pushy.
• Always offer the starter bundle to new leads.
• Never discount more than 15% without approval.
• For gyms, lead with the bulk supplement pricing.
• Always suggest a quick call as the next step.`;

export default function AgentTrainer({ workspaceId }: { workspaceId: string | number }) {
  const [profiles, setProfiles] = useState<AgentProfile[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [instructions, setInstructions] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);

  const active = profiles.find((p) => p.id === activeId) || null;

  const load = async (selectId?: number) => {
    try {
      const r = await AgentsService.listProfiles(workspaceId);
      if (r.success) {
        const list = r.data || [];
        setProfiles(list);
        const sel = selectId ? list.find((p) => p.id === selectId) : (list.find((p) => p.id === activeId) || list[0]);
        if (sel) { setActiveId(sel.id); setName(sel.name); setInstructions(sel.instructions || ''); }
      }
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const select = (id: number) => {
    const p = profiles.find((x) => x.id === id);
    if (p) { setActiveId(id); setName(p.name); setInstructions(p.instructions || ''); }
  };

  const save = async () => {
    if (!active || saving) return;
    setSaving(true);
    try {
      const r = await AgentsService.updateProfile(workspaceId, active.id, { name: name.trim() || active.name, instructions });
      if (r.success) { toast.success('Agent trained.'); await load(active.id); }
      else toast.error(r.message || 'Could not save.');
    } catch { toast.error('Could not save.'); }
    finally { setSaving(false); }
  };

  const clone = async () => {
    if (!active || busy) return;
    setBusy(true);
    try {
      const r = await AgentsService.cloneProfile(workspaceId, active.id, { name: `${active.name} (copy)` });
      if (r.success && r.data) { toast.success('Agent cloned — train the copy for a different segment.'); await load(r.data.id); }
      else toast.error(r.message || 'Could not clone.');
    } catch { toast.error('Could not clone.'); }
    finally { setBusy(false); }
  };

  const createNew = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await AgentsService.createProfile(workspaceId, { agent_type: newType, name: newName.trim() || `New ${newType.toUpperCase()} agent`, instructions: '' });
      if (r.success && r.data) { toast.success('Agent created.'); setCreating(false); setNewName(''); await load(r.data.id); }
      else toast.error(r.message || 'Could not create.');
    } catch { toast.error('Could not create.'); }
    finally { setBusy(false); }
  };

  const useAgent = async () => {
    if (!active || active.is_default || busy) return;
    setBusy(true);
    try {
      const r = await AgentsService.updateProfile(workspaceId, active.id, { is_default: true });
      if (r.success) { toast.success(`"${active.name}" is now the agent in use.`); await load(active.id); }
      else toast.error(r.message || 'Could not switch agent.');
    } catch { toast.error('Could not switch agent.'); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!active || active.is_default || busy) return;
    setBusy(true);
    try {
      const r = await AgentsService.deleteProfile(workspaceId, active.id);
      if (r.success) { toast.success('Agent deleted.'); setActiveId(null); await load(); }
      else toast.error(r.message || 'Could not delete.');
    } catch { toast.error('Could not delete.'); }
    finally { setBusy(false); }
  };

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'crm' | 'store' | 'offers'>('crm');
  const [collapsed, setCollapsed] = useState(false);
  const dirty = active && (name !== active.name || instructions !== (active.instructions || ''));

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-white"><GraduationCap className="w-4 h-4 text-emerald-300" /> Train your AI agents</h3>
          <p className="text-[12px] text-slate-400 mt-0.5">Teach an agent how to work in plain words. Clone it to specialise per pipeline (B2C vs B2B).</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {!collapsed && (
            <button type="button" onClick={() => { setCreating((v) => !v); setNewName(''); }} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 px-2.5 py-1.5 text-xs font-semibold text-slate-200 disabled:opacity-50">
              <Plus className="w-3.5 h-3.5" /> New agent
            </button>
          )}
          <button type="button" onClick={() => { setCollapsed((v) => !v); setCreating(false); }} title={collapsed ? 'Expand' : 'Close'} className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 h-8 w-8 text-slate-300">
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {!collapsed && creating && (
        <div className="mb-3 space-y-2 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-3">
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">What kind of agent?</p>
            <div className="grid grid-cols-3 gap-1.5">
              {([['crm', 'CRM', 'Leads & outreach'], ['store', 'Store', 'Builds catalogue'], ['offers', 'Offers', 'Drafts promos']] as const).map(([v, l, d]) => (
                <button key={v} type="button" onClick={() => setNewType(v)}
                  className={`rounded-lg border px-2 py-1.5 text-left ${newType === v ? 'border-emerald-500/50 bg-emerald-500/15' : 'border-white/10 bg-white/[0.02] hover:bg-white/5'}`}>
                  <span className={`block text-xs font-semibold ${newType === v ? 'text-emerald-100' : 'text-slate-200'}`}>{l}</span>
                  <span className="block text-[9px] text-slate-500">{d}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus placeholder={`Name (e.g. ${newType === 'crm' ? 'B2B Sales' : newType === 'store' ? 'Imports' : 'Weekend deals'})`}
              onKeyDown={(e) => { if (e.key === 'Enter') createNew(); if (e.key === 'Escape') { setCreating(false); setNewName(''); } }}
              className="min-w-0 flex-1 rounded-lg bg-slate-800 border border-white/10 px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-emerald-500/40" />
            <button type="button" onClick={createNew} disabled={busy} className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Create agent</button>
            <button type="button" onClick={() => { setCreating(false); setNewName(''); }} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10">Cancel</button>
          </div>
        </div>
      )}

      {!collapsed && (loading ? (
        <div className="py-6 text-center text-slate-500 text-sm"><Loader2 className="w-4 h-4 animate-spin inline mr-1" /> Loading…</div>
      ) : (
        <div className="space-y-3">
          {/* Your agents — always visible so a newly created agent is obvious */}
          {profiles.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Your agents ({profiles.length})</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {profiles.map((p) => (
                  <button key={p.id} type="button" onClick={() => select(p.id)}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left ${p.id === activeId ? 'bg-emerald-500/15 border-emerald-500/50 ring-1 ring-emerald-500/30' : 'bg-white/[0.02] border-white/10 hover:bg-white/5'}`}>
                    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${p.id === activeId ? 'bg-emerald-500/20 text-emerald-200' : 'bg-white/5 text-slate-400'}`}><Bot className="w-4 h-4" /></span>
                    <span className="min-w-0">
                      <span className={`block truncate text-xs font-semibold ${p.id === activeId ? 'text-emerald-100' : 'text-slate-200'}`}>{p.name}</span>
                      <span className="block truncate text-[10px] text-slate-400">{p.agent_type.toUpperCase()} · {p.is_default ? <span className="font-semibold text-emerald-300">In use</span> : <span className="text-slate-500">Not in use</span>}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {active && (
            <>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Agent name"
                className="w-full rounded-lg bg-slate-800 border border-white/5 px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500/40" />
              <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={7} placeholder={PLACEHOLDER}
                className="w-full rounded-lg bg-slate-800 border border-white/5 px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-emerald-500/40 resize-y" />
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {active.is_default ? (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 px-2.5 py-1.5 text-xs font-semibold text-emerald-200"><Check className="w-3.5 h-3.5" /> In use</span>
                  ) : (
                    <button type="button" onClick={useAgent} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                      <Check className="w-3.5 h-3.5" /> Use this agent
                    </button>
                  )}
                  <button type="button" onClick={clone} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 px-2.5 py-1.5 text-xs font-semibold text-slate-200 disabled:opacity-50">
                    <Copy className="w-3.5 h-3.5" /> Clone
                  </button>
                  {!active.is_default && (
                    <button type="button" onClick={remove} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg text-slate-500 hover:text-rose-400 px-2 py-1.5 text-xs">
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  )}
                </div>
                <button type="button" onClick={save} disabled={saving || !dirty} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {dirty ? 'Save training' : 'Saved'}
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                {active.is_default
                  ? `This ${active.agent_type.toUpperCase()} agent is the one in use right now — its training shapes how it works.`
                  : `Train it, then tap “Use this agent” to make your ${active.agent_type.toUpperCase()} agent work this way. `}
                {active.pipeline_name ? `Scoped to ${active.pipeline_name}.` : ''}
              </p>
            </>
          )}
        </div>
      ))}
    </section>
  );
}
