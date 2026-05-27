'use client';

import { useCallback, useEffect, useState, use as reactUse } from 'react';
import {
  Plus, Columns3, Utensils, Bed, Scissors, Building2, Briefcase, Tag, Star,
  ChevronDown, ChevronRight, Sparkles, Trash2, Save, X, Edit3, GripVertical,
  CheckCircle2, AlertTriangle, Trophy, XCircle, BadgeCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageSkeleton, Skeleton } from '@/components/workspace/Skeleton';
import QuotaChip from '@/components/workspace/QuotaChip';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { OrganizationService } from '@/services/organization.service';

/**
 * Pipelines page — master/detail in one view.
 *
 * Each pipeline renders as an expandable card:
 *   - Collapsed: name, industry, stage count, lead count, status.
 *   - Expanded: list of stages with inline rename / color / probability /
 *     delete + an "Add stage" button at the end. Reorder via up/down.
 *
 * A header "Install templates" button bulk-installs the 7 industry
 * pipelines (Sales, Restaurant, Hotel, Salon, B2B, Agency, Offer) for
 * tenants that started empty or want to add the rest later. Quota-aware
 * — skipped pipelines are surfaced in the toast.
 */

interface Pipeline {
  id: number;
  name: string;
  slug: string;
  industry: string;
  description: string;
  color: string;
  is_default: boolean;
  is_active: boolean;
  stages_count: number;
  leads_count: number;
}

interface Stage {
  id: number;
  name: string;
  slug: string;
  color: string;
  order: number;
  probability: number;
  is_won: boolean;
  is_lost: boolean;
  requires_lost_reason: boolean;
  leads_count?: number;
}

const INDUSTRY_ICONS: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  generic:    Columns3,
  restaurant: Utensils,
  hotel:      Bed,
  salon:      Scissors,
  b2b:        Building2,
  agency:     Briefcase,
  offer:      Tag,
  retail:     Star,
  events:     Star,
};

const STAGE_COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#ec4899', '#64748b'];

export default function PipelinesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard required="crm.leads_edit" workspaceId={wsId} skeleton="grid">
      <PipelinesInner wsId={wsId} />
    </PermissionGuard>
  );
}

function PipelinesInner({ wsId }: { wsId: string }) {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [installing, setInstalling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await OrganizationService.listPipelines();
      if (res?.success) setPipelines(res.data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const installTemplates = async () => {
    setInstalling(true);
    try {
      const res = await OrganizationService.installPipelineTemplates();
      if (res?.success) {
        const { installed, skipped_existing, skipped_quota } = res.data ?? {};
        const parts: string[] = [];
        if (installed?.length) parts.push(`installed ${installed.length}`);
        if (skipped_existing?.length) parts.push(`${skipped_existing.length} already existed`);
        if (skipped_quota?.length) parts.push(`${skipped_quota.length} blocked by quota — upgrade your plan`);
        toast.success(parts.join(' · ') || 'Nothing to install');
        load();
      } else toast.error(res?.message || 'Install failed');
    } finally { setInstalling(false); }
  };

  if (loading) return <PageSkeleton kind="grid" />;

  return (
    <div>
      <div className="flex items-start justify-between mb-6 gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">Pipelines</h1>
          <p className="text-sm text-slate-400 mt-1">
            Each industry gets a tailored pipeline. Click a card to manage its stages — rename, recolor, set win probability, reorder, delete.
          </p>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <QuotaChip quota="pipelines" workspaceId={wsId} />
            <button
              onClick={installTemplates}
              disabled={installing}
              className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-slate-200 text-xs font-medium inline-flex items-center gap-1.5 disabled:opacity-50"
              title="Bulk-install the 7 industry pipeline templates (Sales / Restaurant / Hotel / Salon / B2B / Agency / Offer)"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
              {installing ? 'Installing…' : 'Install industry templates'}
            </button>
          </div>
        </div>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold inline-flex items-center gap-2">
          <Plus className="w-4 h-4" /> New pipeline
        </button>
      </div>

      {pipelines.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center">
          <Columns3 className="w-10 h-10 text-slate-500 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-white">No pipelines yet</h3>
          <p className="text-xs text-slate-500 mt-1">
            Create one manually or install the 7 industry templates to get started.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <button onClick={() => setShowCreate(true)} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> New pipeline
            </button>
            <button onClick={installTemplates} disabled={installing} className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-slate-200 text-xs font-medium inline-flex items-center gap-1 disabled:opacity-50">
              <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
              {installing ? 'Installing…' : 'Install templates'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {pipelines.map((p) => (
            <PipelineRow key={p.id} pipeline={p} onChanged={load} />
          ))}
        </div>
      )}

      {showCreate && (
        <CreatePipelineModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />
      )}
    </div>
  );
}

// -------------------------------------------------------------------------
// Expandable pipeline row — collapsed summary + inline stage manager.
// -------------------------------------------------------------------------

function PipelineRow({ pipeline, onChanged }: { pipeline: Pipeline; onChanged: () => void }) {
  const Icon = INDUSTRY_ICONS[pipeline.industry] ?? Columns3;
  const [open, setOpen] = useState(false);
  const [stages, setStages] = useState<Stage[] | null>(null);
  const [stagesLoading, setStagesLoading] = useState(false);

  const loadStages = useCallback(async () => {
    setStagesLoading(true);
    try {
      const res = await OrganizationService.getPipeline(pipeline.id);
      if (res?.success) setStages(res.data.stages || []);
    } finally { setStagesLoading(false); }
  }, [pipeline.id]);

  useEffect(() => {
    if (open && stages === null) loadStages();
  }, [open, stages, loadStages]);

  const removePipeline = async () => {
    if (!confirm(`Delete pipeline "${pipeline.name}"? Its stages will be removed too.`)) return;
    const res = await OrganizationService.deletePipeline(pipeline.id);
    if (res?.success) { toast.success('Pipeline deleted'); onChanged(); }
    else toast.error(res?.message || 'Failed');
  };

  const makeDefault = async () => {
    if (pipeline.is_default) return;
    const res = await OrganizationService.setDefaultPipeline(pipeline.id);
    if (res?.success) {
      toast.success(`${pipeline.name} is now the default pipeline`);
      onChanged();
    } else toast.error(res?.message || 'Failed');
  };

  return (
    <article className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
      {/* Header row — click to expand */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full p-4 flex items-center gap-3 hover:bg-white/[0.02] text-left transition-colors"
      >
        {open
          ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
          : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${pipeline.color}26`, color: pipeline.color }}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white truncate">{pipeline.name}</h3>
            {pipeline.is_default && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">Default</span>}
          </div>
          <div className="mt-0.5 flex items-center gap-3 text-[11px] text-slate-500">
            <span className="capitalize">{pipeline.industry}</span>
            <span>·</span>
            <span>{pipeline.stages_count} stages</span>
            <span>·</span>
            <span>{pipeline.leads_count} leads</span>
            <span>·</span>
            <span className={pipeline.is_active ? 'text-emerald-300' : 'text-slate-600'}>
              {pipeline.is_active ? 'Active' : 'Disabled'}
            </span>
          </div>
        </div>
      </button>

      {/* Expanded body — stage manager */}
      {open && (
        <div className="border-t border-white/5 p-4 bg-[#080e1c]/40">
          {stagesLoading || stages === null ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} height={48} rounded="rounded-lg" />
              ))}
            </div>
          ) : (
            <StageManager
              pipelineId={pipeline.id}
              stages={stages}
              onChanged={() => { loadStages(); onChanged(); }}
            />
          )}

          <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between gap-3">
            <p className="text-[10px] text-slate-500 truncate">
              Pipeline id <code className="text-slate-400">{pipeline.id}</code> · slug <code className="text-slate-400">{pipeline.slug}</code>
            </p>
            <div className="flex items-center gap-2 shrink-0">
              {pipeline.is_default ? (
                <span className="px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-300 border border-emerald-500/30 bg-emerald-500/10 inline-flex items-center gap-1">
                  <BadgeCheck className="w-3.5 h-3.5" /> Current default
                </span>
              ) : (
                <button
                  onClick={makeDefault}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-300 border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/15 inline-flex items-center gap-1"
                  title="Make this the pipeline the kanban opens by default"
                >
                  <BadgeCheck className="w-3.5 h-3.5" /> Set as default
                </button>
              )}
              <button
                onClick={removePipeline}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-300 border border-red-500/30 bg-red-500/5 hover:bg-red-500/10 inline-flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" /> Delete pipeline
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

// -------------------------------------------------------------------------
// Stage manager — inline CRUD + reorder for the stages of one pipeline.
// -------------------------------------------------------------------------

function StageManager({
  pipelineId, stages, onChanged,
}: {
  pipelineId: number;
  stages: Stage[];
  onChanged: () => void;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const removeStage = async (id: number) => {
    if (!confirm('Delete this stage? Existing leads on it will be moved to Unstaged.')) return;
    const res = await OrganizationService.deleteLeadStage(id);
    if (res?.success) { toast.success('Stage deleted'); onChanged(); }
    else toast.error(res?.message || 'Failed');
  };

  const move = async (id: number, direction: -1 | 1) => {
    const idx = stages.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const next = idx + direction;
    if (next < 0 || next >= stages.length) return;
    const newOrder = [...stages];
    [newOrder[idx], newOrder[next]] = [newOrder[next], newOrder[idx]];
    const res = await OrganizationService.reorderStages(newOrder.map((s) => s.id));
    if (res?.success) onChanged();
    else toast.error(res?.message || 'Failed');
  };

  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2 font-semibold">
        Stages ({stages.length})
      </div>

      {stages.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 p-4 text-center text-xs text-slate-500">
          No stages yet. Add the first one to start moving leads.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {stages.map((s, idx) => (
            <li key={s.id}>
              {editingId === s.id ? (
                <StageEditor
                  stage={s}
                  onCancel={() => setEditingId(null)}
                  onSaved={() => { setEditingId(null); onChanged(); }}
                />
              ) : (
                <StageRow
                  stage={s}
                  isFirst={idx === 0}
                  isLast={idx === stages.length - 1}
                  onEdit={() => setEditingId(s.id)}
                  onDelete={() => removeStage(s.id)}
                  onMoveUp={() => move(s.id, -1)}
                  onMoveDown={() => move(s.id, 1)}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3">
        {showAdd ? (
          <StageEditor
            stage={null}
            pipelineId={pipelineId}
            defaultOrder={(stages[stages.length - 1]?.order ?? 0) + 10}
            onCancel={() => setShowAdd(false)}
            onSaved={() => { setShowAdd(false); onChanged(); }}
          />
        ) : (
          <button
            onClick={() => setShowAdd(true)}
            className="w-full px-3 py-2 rounded-lg text-xs font-medium text-emerald-300 border border-dashed border-emerald-500/30 hover:bg-emerald-500/[0.04] inline-flex items-center justify-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Add stage
          </button>
        )}
      </div>
    </div>
  );
}

function StageRow({
  stage, isFirst, isLast, onEdit, onDelete, onMoveUp, onMoveDown,
}: {
  stage: Stage;
  isFirst: boolean;
  isLast: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-[#0c1424] p-2.5">
      {/* Reorder handle */}
      <div className="flex flex-col -my-1">
        <button
          onClick={onMoveUp}
          disabled={isFirst}
          className="p-0.5 text-slate-500 hover:text-emerald-300 disabled:opacity-30 disabled:hover:text-slate-500"
          title="Move up"
        >
          <ChevronDown className="w-3 h-3 rotate-180" />
        </button>
        <button
          onClick={onMoveDown}
          disabled={isLast}
          className="p-0.5 text-slate-500 hover:text-emerald-300 disabled:opacity-30 disabled:hover:text-slate-500"
          title="Move down"
        >
          <ChevronDown className="w-3 h-3" />
        </button>
      </div>

      {/* Color swatch */}
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />

      {/* Name + flags */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">{stage.name}</span>
          {stage.is_won && (
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              <Trophy className="w-2.5 h-2.5" /> Won
            </span>
          )}
          {stage.is_lost && (
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-300 border border-red-500/20">
              <XCircle className="w-2.5 h-2.5" /> Lost
            </span>
          )}
          {stage.requires_lost_reason && !stage.is_lost && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 inline-flex items-center gap-1">
              <AlertTriangle className="w-2.5 h-2.5" /> Reason required
            </span>
          )}
        </div>
        <div className="text-[10px] text-slate-500 mt-0.5">
          Probability {stage.probability}% · slug <code className="text-slate-400">{stage.slug}</code>
          {typeof stage.leads_count === 'number' && <> · {stage.leads_count} leads</>}
        </div>
      </div>

      {/* Probability mini-bar */}
      <div className="hidden md:block w-20">
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div className="h-full" style={{ width: `${stage.probability}%`, backgroundColor: stage.color }} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5">
        <button onClick={onEdit} className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/5" title="Edit">
          <Edit3 className="w-3.5 h-3.5" />
        </button>
        <button onClick={onDelete} className="p-1.5 rounded-md text-slate-500 hover:text-red-300 hover:bg-red-500/10" title="Delete">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// Inline editor — used for both "Add new" and "Edit existing".
function StageEditor({
  stage, pipelineId, defaultOrder, onCancel, onSaved,
}: {
  stage: Stage | null;
  pipelineId?: number;
  defaultOrder?: number;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: stage?.name ?? '',
    color: stage?.color ?? STAGE_COLORS[0],
    probability: stage?.probability ?? 30,
    is_won: stage?.is_won ?? false,
    is_lost: stage?.is_lost ?? false,
    requires_lost_reason: stage?.requires_lost_reason ?? false,
  });
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Name required'); return; }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        color: form.color,
        probability: form.probability,
        is_won: form.is_won,
        is_lost: form.is_lost,
        requires_lost_reason: form.requires_lost_reason || form.is_lost,
      };
      let res;
      if (stage) {
        res = await OrganizationService.updateLeadStage(stage.id, payload);
      } else {
        payload.pipeline = pipelineId;
        if (defaultOrder) payload.order = defaultOrder;
        res = await OrganizationService.createLeadStage(payload);
      }
      if (res?.success) { toast.success(stage ? 'Stage updated' : 'Stage created'); onSaved(); }
      else toast.error(res?.message || 'Failed');
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed');
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.04] p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Stage name (e.g. Contacted)"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="flex-1 px-3 py-1.5 rounded-md bg-[#080e1c] border border-white/10 text-sm text-white"
        />
        <input
          type="number"
          min={0}
          max={100}
          step={5}
          value={form.probability}
          onChange={(e) => setForm({ ...form, probability: Math.max(0, Math.min(100, Number(e.target.value))) })}
          className="w-20 px-3 py-1.5 rounded-md bg-[#080e1c] border border-white/10 text-sm text-white text-right"
          title="Win probability %"
        />
        <span className="text-xs text-slate-500">%</span>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] uppercase tracking-wider text-slate-500 mr-1">Color:</span>
        {STAGE_COLORS.map((c) => (
          <button
            type="button"
            key={c}
            onClick={() => setForm({ ...form, color: c })}
            className={`w-6 h-6 rounded transition-transform ${form.color === c ? 'scale-110 ring-2 ring-white/40' : ''}`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

      <div className="flex items-center gap-3 text-[11px] text-slate-300 flex-wrap">
        <label className="inline-flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={form.is_won} onChange={(e) => setForm({ ...form, is_won: e.target.checked, is_lost: e.target.checked ? false : form.is_lost })} className="accent-emerald-500" />
          <Trophy className="w-3 h-3 text-emerald-300" /> Closes as won (100%)
        </label>
        <label className="inline-flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={form.is_lost} onChange={(e) => setForm({ ...form, is_lost: e.target.checked, is_won: e.target.checked ? false : form.is_won })} className="accent-red-500" />
          <XCircle className="w-3 h-3 text-red-300" /> Closes as lost (0%)
        </label>
        {!form.is_lost && (
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={form.requires_lost_reason} onChange={(e) => setForm({ ...form, requires_lost_reason: e.target.checked })} className="accent-amber-500" />
            <AlertTriangle className="w-3 h-3 text-amber-300" /> Require lost reason
          </label>
        )}
      </div>

      <div className="flex items-center justify-end gap-1.5 pt-1">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded-md text-xs font-medium text-slate-300 hover:bg-white/5 inline-flex items-center gap-1">
          <X className="w-3 h-3" /> Cancel
        </button>
        <button type="submit" disabled={busy} className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-50">
          <Save className="w-3 h-3" /> {busy ? 'Saving…' : stage ? 'Save' : 'Add stage'}
        </button>
      </div>
    </form>
  );
}

// -------------------------------------------------------------------------
// Create-pipeline modal — same shape as before but with auto-stage hint.
// -------------------------------------------------------------------------

function CreatePipelineModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', industry: 'generic', color: '#10b981' });
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Name required'); return; }
    setBusy(true);
    try {
      const res = await OrganizationService.createPipeline(form);
      if (res?.success) { toast.success('Pipeline created with 5 starter stages'); onCreated(); }
      else toast.error(res?.message || 'Failed');
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed');
    } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-[#0c1424] border border-white/10 p-6">
        <h2 className="text-lg font-semibold text-white mb-1">New pipeline</h2>
        <p className="text-[11px] text-slate-500 mb-4">We'll auto-create 5 starter stages (New / Contacted / Qualified / Won / Lost) — rename them after.</p>
        <div className="space-y-3">
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-slate-500">Name</span>
            <input className="mt-1 w-full px-3 py-2 rounded-lg bg-[#080e1c] border border-white/10 text-sm text-white" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Wholesale buyers" />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-slate-500">Industry</span>
            <select className="mt-1 w-full px-3 py-2 rounded-lg bg-[#080e1c] border border-white/10 text-sm text-white" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })}>
              <option value="generic">Generic sales</option>
              <option value="restaurant">Restaurant</option>
              <option value="hotel">Hotel</option>
              <option value="salon">Salon / spa</option>
              <option value="b2b">B2B supplier</option>
              <option value="agency">Agency / service</option>
              <option value="retail">Retail / e-commerce</option>
              <option value="events">Events / tickets</option>
              <option value="offer">Offer / deal flow</option>
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-slate-500">Accent color</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {['#10b981', '#06b6d4', '#3b82f6', '#a855f7', '#ec4899', '#f59e0b', '#ef4444', '#64748b'].map((c) => (
                <button type="button" key={c} onClick={() => setForm({ ...form, color: c })} className={`w-7 h-7 rounded-md transition-transform ${form.color === c ? 'scale-110 ring-2 ring-white/40' : ''}`} style={{ backgroundColor: c }} />
              ))}
            </div>
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-white/5">Cancel</button>
          <button type="submit" disabled={busy} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold disabled:opacity-50">{busy ? 'Creating…' : 'Create'}</button>
        </div>
      </form>
    </div>
  );
}
