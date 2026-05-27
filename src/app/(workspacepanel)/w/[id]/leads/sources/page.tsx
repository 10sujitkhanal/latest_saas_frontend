'use client';

import { useCallback, useEffect, useState, use as reactUse } from 'react';
import Link from 'next/link';
import {
  Plus, Trash2, Zap, Tag, Shuffle, User as UserIcon, Bot, Sparkles, Settings2, X,
  Key, Copy, RotateCcw, Power, Globe,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import QuotaChip from '@/components/workspace/QuotaChip';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { OrganizationService } from '@/services/organization.service';

/**
 * Source manager + auto-pilot config.
 *
 * Each source card shows:
 *   - color, name, leads + rules counts
 *   - the auto-pilot summary: where new leads land, who they go to
 *   - "Configure auto-pilot" drawer to set default stage + assignee policy
 */

interface LeadSource {
  id: number;
  name: string;
  slug: string;
  color: string;
  description: string;
  is_active: boolean;
  rules_count: number;
  leads_count: number;
  default_stage: number | null;
  default_stage_name: string | null;
  auto_assign: 'none' | 'round_robin' | 'fixed';
  fixed_assignee: number | null;
  fixed_assignee_email: string | null;
  // External intake — each source has its own public POST endpoint
  // protected by ``api_key``. ``intake_url`` is the copy-paste URL
  // (already includes ?source=&key=); ``intake_curl`` is a ready-to-
  // run curl example.
  api_key?: string;
  intake_enabled?: boolean;
  intake_workspace?: number | null;
  intake_workspace_name?: string | null;
  intake_url?: string | null;
  intake_curl?: string | null;
}

interface LeadStage { id: number; name: string; slug: string; color: string; }
interface StaffMember { user_id: number; email: string; full_name: string; }

const PRESET_COLORS = ['#10b981', '#06b6d4', '#f59e0b', '#8b5cf6', '#ec4899', '#ef4444', '#3b82f6', '#64748b'];

export default function LeadSourcesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = reactUse(params);
  return (
    <PermissionGuard required="crm.leads_edit" workspaceId={id} skeleton="grid">
      <LeadSourcesInner idString={id} />
    </PermissionGuard>
  );
}

function LeadSourcesInner({ idString }: { idString: string }) {
  const id = idString;
  const wsId = Number(id);

  const [sources, setSources] = useState<LeadSource[]>([]);
  const [stages, setStages] = useState<LeadStage[]>([]);
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  // Separate state from the auto-pilot drawer — the intake-API modal
  // shows secrets (api_key, intake_url with key embedded) so we keep
  // its lifecycle independent and don't auto-open it.
  const [intakeForId, setIntakeForId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, st, ctx] = await Promise.all([
        OrganizationService.listLeadSources(),
        OrganizationService.listLeadStages(),
        OrganizationService.workspaceContext(wsId),
      ]);
      if (s?.success) setSources(s.data);
      if (st?.success) setStages(st.data);
      if (ctx?.success && Array.isArray(ctx.data?.members)) {
        setMembers(
          ctx.data.members.map((m: { user_id: number; email: string; full_name: string }) => ({
            user_id: m.user_id, email: m.email, full_name: m.full_name,
          })),
        );
      }
    } finally {
      setLoading(false);
    }
  }, [wsId]);

  useEffect(() => { load(); }, [load]);

  const remove = async (id: number) => {
    if (!confirm('Delete this source? Existing leads keep their data but lose the source link.')) return;
    const res = await OrganizationService.deleteLeadSource(id);
    if (res?.success) { toast.success('Source deleted'); load(); }
    else toast.error(res?.message || 'Failed');
  };

  const update = async (id: number, patch: Partial<LeadSource>) => {
    const res = await OrganizationService.updateLeadSource(id, patch);
    if (res?.success) {
      setSources((ss) => ss.map((s) => s.id === id ? { ...s, ...res.data } : s));
      toast.success('Source updated');
    } else toast.error(res?.message || 'Failed');
  };

  const rotateKey = async (id: number) => {
    if (!confirm('Rotate the API key? Any integrations using the old key will stop working immediately.')) return;
    const res = await OrganizationService.rotateLeadSourceKey(id);
    if (res?.success) {
      setSources((ss) => ss.map((s) => s.id === id ? { ...s, ...res.data } : s));
      toast.success('Key rotated. Update your integrations.');
    } else toast.error(res?.message || 'Failed');
  };

  if (loading) return <PageSkeleton kind="grid" />;

  const editing = sources.find((s) => s.id === editingId) ?? null;
  const intakeFor = sources.find((s) => s.id === intakeForId) ?? null;

  return (
    <div>
      <div className="flex items-start justify-between mb-6 gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">Lead sources</h1>
          <p className="text-sm text-slate-400 mt-1">
            Channels your leads come from. Each has its own auto-pilot — set the landing stage and who picks it up, and the system handles the rest.
          </p>
          <div className="mt-2">
            <QuotaChip quota="lead_sources" workspaceId={wsId} />
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold inline-flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add source
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {sources.map((s) => (
          <div key={s.id} className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 flex flex-col">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${s.color}26`, color: s.color }}
                >
                  <Tag className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-white truncate">{s.name}</h3>
                  <p className="text-[11px] text-slate-500">{s.leads_count} leads</p>
                </div>
              </div>
              <button onClick={() => remove(s.id)} className="p-1.5 rounded text-slate-500 hover:text-red-300 hover:bg-red-500/10">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Auto-pilot summary */}
            <div className="mt-4 space-y-1.5 text-[11px]">
              <div className="inline-flex items-center gap-1.5 text-slate-300">
                <Bot className="w-3 h-3 text-emerald-300" />
                <span>Lands in:</span>
                {s.default_stage_name ? (
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                    {s.default_stage_name}
                  </span>
                ) : (
                  <span className="text-amber-300">Not configured</span>
                )}
              </div>
              <div className="inline-flex items-center gap-1.5 text-slate-300">
                {s.auto_assign === 'round_robin' && <Shuffle className="w-3 h-3 text-cyan-300" />}
                {s.auto_assign === 'fixed' && <UserIcon className="w-3 h-3 text-violet-300" />}
                {s.auto_assign === 'none' && <UserIcon className="w-3 h-3 text-slate-500" />}
                <span>Owner:</span>
                {s.auto_assign === 'round_robin' && <span className="text-cyan-300">Round-robin</span>}
                {s.auto_assign === 'fixed' && <span className="text-violet-300">{s.fixed_assignee_email || 'Not picked'}</span>}
                {s.auto_assign === 'none' && <span className="text-amber-300">Unassigned</span>}
              </div>
              <div className="inline-flex items-center gap-1.5 text-slate-300">
                <Zap className="w-3 h-3 text-amber-300" />
                <span>{s.rules_count} {s.rules_count === 1 ? 'follow-up' : 'follow-ups'} per lead</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setEditingId(s.id)}
                  className="text-xs font-semibold text-slate-300 hover:text-white inline-flex items-center gap-1.5"
                >
                  <Settings2 className="w-3 h-3" />
                  Auto-pilot
                </button>
                <button
                  onClick={() => setIntakeForId(s.id)}
                  className="text-xs font-semibold text-cyan-300 hover:text-cyan-200 inline-flex items-center gap-1.5"
                  title="Public API endpoint for pushing leads into this source"
                >
                  <Key className="w-3 h-3" />
                  Intake API
                  {s.intake_enabled === false && (
                    <span className="text-[9px] px-1 py-0.5 rounded bg-red-500/10 text-red-300 border border-red-500/20">off</span>
                  )}
                </button>
              </div>
              <Link
                href="../automation"
                className="text-xs text-emerald-400 hover:underline inline-flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" />
                Edit flow →
              </Link>
            </div>
          </div>
        ))}
        {sources.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-500 text-sm">
            No sources yet. Add one to start tagging leads by channel.
          </div>
        )}
      </div>

      {showCreate && (
        <CreateSourceModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}

      {editing && (
        <AutoPilotDrawer
          source={editing}
          stages={stages}
          members={members}
          onClose={() => setEditingId(null)}
          onSave={(patch) => { update(editing.id, patch); setEditingId(null); }}
        />
      )}

      {intakeFor && (
        <IntakeApiModal
          source={intakeFor}
          workspaceId={wsId}
          onClose={() => setIntakeForId(null)}
          onRotate={() => rotateKey(intakeFor.id)}
          onTogglePower={() => update(intakeFor.id, { intake_enabled: !(intakeFor.intake_enabled ?? true) })}
          onPinWorkspace={(pin) =>
            update(intakeFor.id, { intake_workspace: pin ? wsId : null })
          }
        />
      )}
    </div>
  );
}

function CreateSourceModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', slug: '', color: PRESET_COLORS[0], description: '' });
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Name required'); return; }
    setBusy(true);
    try {
      const slug = (form.slug || form.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const res = await OrganizationService.createLeadSource({
        name: form.name, slug, color: form.color, description: form.description,
        auto_assign: 'round_robin',
      });
      if (res?.success) { toast.success('Source created'); onCreated(); }
      else toast.error(res?.message || 'Failed');
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed');
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-[#0c1424] border border-white/10 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">New source</h2>
        <div className="space-y-3">
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-slate-500">Name</span>
            <input className="mt-1 w-full px-3 py-2 rounded-lg bg-[#080e1c] border border-white/10 text-sm text-white"
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-slate-500">Slug (optional)</span>
            <input className="mt-1 w-full px-3 py-2 rounded-lg bg-[#080e1c] border border-white/10 text-sm text-white"
              value={form.slug} placeholder="auto-generated"
              onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          </label>
          <div>
            <span className="text-[11px] uppercase tracking-wider text-slate-500">Color</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button type="button" key={c} onClick={() => setForm({ ...form, color: c })}
                  className={`w-7 h-7 rounded-md border-2 transition-transform ${form.color === c ? 'scale-110 border-white/40' : 'border-transparent'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-slate-500">Description</span>
            <textarea rows={2} className="mt-1 w-full px-3 py-2 rounded-lg bg-[#080e1c] border border-white/10 text-sm text-white"
              value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-white/5">Cancel</button>
          <button type="submit" disabled={busy} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold disabled:opacity-50">
            {busy ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}

function AutoPilotDrawer({
  source, stages, members, onClose, onSave,
}: {
  source: LeadSource;
  stages: LeadStage[];
  members: StaffMember[];
  onClose: () => void;
  onSave: (patch: Partial<LeadSource>) => void;
}) {
  const [form, setForm] = useState({
    default_stage: source.default_stage ?? '',
    auto_assign: source.auto_assign,
    fixed_assignee: source.fixed_assignee ?? '',
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      default_stage: form.default_stage ? Number(form.default_stage) : null,
      auto_assign: form.auto_assign,
      fixed_assignee: form.auto_assign === 'fixed' && form.fixed_assignee ? Number(form.fixed_assignee) : null,
    } as Partial<LeadSource>);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-[#0c1424] border border-white/10 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-300">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">{source.name} auto-pilot</h2>
              <p className="text-[11px] text-slate-500">Fires the moment a lead arrives from this source.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-slate-500">Default stage on arrival</span>
            <select
              className="mt-1 w-full px-3 py-2 rounded-lg bg-[#080e1c] border border-white/10 text-sm text-white"
              value={form.default_stage}
              onChange={(e) => setForm({ ...form, default_stage: e.target.value })}
            >
              <option value="">— don't auto-stage —</option>
              {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <p className="mt-1 text-[10px] text-slate-500">
              Every new lead lands directly on this kanban column. No manual stage move needed.
            </p>
          </label>

          <div>
            <span className="text-[11px] uppercase tracking-wider text-slate-500">Auto-assign owner</span>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              <RadioCard
                active={form.auto_assign === 'round_robin'}
                onClick={() => setForm({ ...form, auto_assign: 'round_robin' })}
                Icon={Shuffle} label="Round-robin"
                sub="Spread evenly across members"
              />
              <RadioCard
                active={form.auto_assign === 'fixed'}
                onClick={() => setForm({ ...form, auto_assign: 'fixed' })}
                Icon={UserIcon} label="One person"
                sub="Always the same owner"
              />
              <RadioCard
                active={form.auto_assign === 'none'}
                onClick={() => setForm({ ...form, auto_assign: 'none' })}
                Icon={X} label="Manual"
                sub="Leave unassigned"
              />
            </div>
            {form.auto_assign === 'fixed' && (
              <select
                className="mt-3 w-full px-3 py-2 rounded-lg bg-[#080e1c] border border-white/10 text-sm text-white"
                value={form.fixed_assignee}
                onChange={(e) => setForm({ ...form, fixed_assignee: e.target.value })}
              >
                <option value="">— pick a member —</option>
                {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.full_name} ({m.email})</option>)}
              </select>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-white/5">Cancel</button>
          <button type="submit" className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold">
            Save auto-pilot
          </button>
        </div>
      </form>
    </div>
  );
}

function CopyRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error('Copy failed — select and copy manually.');
    }
  };
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-slate-500">{label}</span>
        <button
          onClick={copy}
          type="button"
          className="text-[11px] inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300"
        >
          <Copy className="w-3 h-3" /> Copy
        </button>
      </div>
      <div className="mt-1 rounded-lg bg-[#080e1c] border border-white/10 px-3 py-2 font-mono text-[11px] text-slate-200 break-all max-h-32 overflow-y-auto">
        {value || <span className="text-slate-600">— not available —</span>}
      </div>
      {hint && <p className="mt-1 text-[10px] text-slate-500">{hint}</p>}
    </div>
  );
}

function IntakeApiModal({
  source, workspaceId, onClose, onRotate, onTogglePower, onPinWorkspace,
}: {
  source: LeadSource;
  workspaceId: number;
  onClose: () => void;
  onRotate: () => void;
  onTogglePower: () => void;
  onPinWorkspace: (pin: boolean) => void;
}) {
  const enabled = source.intake_enabled ?? true;
  const pinned = source.intake_workspace === workspaceId;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl rounded-2xl bg-[#0c1424] border border-white/10 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4 gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-300">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">{source.name} — Intake API</h2>
              <p className="text-[11px] text-slate-500">
                Push leads into this source from any HTML form, Zapier, ad-platform webhook, or your own backend.
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded text-slate-500 hover:text-white shrink-0"><X className="w-4 h-4" /></button>
        </div>

        {/* Power & workspace pin */}
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onTogglePower}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              enabled
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200 hover:bg-emerald-500/20'
                : 'bg-red-500/10 border-red-500/30 text-red-200 hover:bg-red-500/20'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            {enabled ? 'Intake ON' : 'Intake OFF — POSTs are rejected'}
          </button>
          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-white/10 bg-white/[0.02] text-slate-300 cursor-pointer hover:bg-white/[0.04]">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => onPinWorkspace(e.target.checked)}
              className="accent-cyan-500"
            />
            Pin to this workspace ({pinned ? '#' + workspaceId : 'caller must pass ?workspace='})
          </label>
          <button
            type="button"
            onClick={onRotate}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-amber-500/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Rotate key
          </button>
        </div>

        <div className="space-y-4">
          <CopyRow
            label="Endpoint URL"
            value={source.intake_url || ''}
            hint="Paste this directly into your form's action attribute or a Zapier Webhook → POST step."
          />
          <CopyRow
            label="API key"
            value={source.api_key || ''}
            hint="Send as ?key=… (URL above already includes it) or as the X-Lead-Intake-Key header."
          />
          <CopyRow
            label="curl example"
            value={source.intake_curl || ''}
            hint="Run this from a terminal to test the endpoint with a sample lead."
          />

          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">Accepted fields</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-300 font-mono">
              <span><span className="text-emerald-300">first_name</span> (str)</span>
              <span><span className="text-emerald-300">last_name</span> (str)</span>
              <span><span className="text-emerald-300">email</span> (str)*</span>
              <span><span className="text-emerald-300">phone</span> (str)*</span>
              <span><span className="text-emerald-300">company</span> (str)</span>
              <span><span className="text-emerald-300">value</span> (number)</span>
              <span><span className="text-emerald-300">notes</span> (str)</span>
              <span><span className="text-emerald-300">workspace</span> (id){pinned ? '' : ' — required'}</span>
            </div>
            <p className="mt-2 text-[10px] text-slate-500">
              * At least one of <span className="font-mono text-slate-300">email</span> or <span className="font-mono text-slate-300">phone</span> is required. Common aliases like <span className="font-mono">fname</span>, <span className="font-mono">mobile</span>, <span className="font-mono">message</span> are auto-mapped.
            </p>
          </div>

          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">HTML form example</div>
            <pre className="text-[11px] text-slate-300 font-mono whitespace-pre-wrap break-all">
{`<form method="POST" action="${source.intake_url || ''}">
  <input name="first_name" placeholder="First name" required />
  <input name="email" type="email" placeholder="Email" required />
  <input name="phone" placeholder="Phone" />
  <button type="submit">Get in touch</button>
</form>`}
            </pre>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm font-medium text-slate-200">Close</button>
        </div>
      </div>
    </div>
  );
}

function RadioCard({
  active, onClick, Icon, label, sub,
}: {
  active: boolean; onClick: () => void;
  Icon: React.ComponentType<{ className?: string }>;
  label: string; sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-xl p-3 border transition-colors ${
        active
          ? 'bg-emerald-500/10 border-emerald-500/40 text-white'
          : 'bg-white/[0.02] border-white/5 text-slate-300 hover:border-white/10'
      }`}
    >
      <Icon className={`w-4 h-4 mb-1 ${active ? 'text-emerald-300' : 'text-slate-500'}`} />
      <div className="text-xs font-semibold">{label}</div>
      <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>
    </button>
  );
}
