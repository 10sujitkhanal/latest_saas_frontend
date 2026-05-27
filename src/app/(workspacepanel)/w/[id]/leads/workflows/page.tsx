'use client';

import { useCallback, useEffect, useMemo, useState, use as reactUse } from 'react';
import Link from 'next/link';
import {
  Plus, Sparkles, Trash2, Play, Edit3, Zap, Mail, MessageCircle,
  Calendar as CalendarIcon, CheckSquare, ArrowRight, Tag, User as UserIcon,
  TrendingUp, Bell, AlertCircle, CheckCircle2, Search, Activity,
} from 'lucide-react';
import { toast } from 'sonner';
import QuotaChip from '@/components/workspace/QuotaChip';
import QuotaBadge from '@/components/QuotaBadge';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { OrganizationService } from '@/services/organization.service';

/**
 * Workflows list — the entry point for the visual builder.
 *
 * "Add new workflow" → /workflows/builder (n8n-style canvas, prompt+drag).
 * Each row → /workflows/builder/<id> to edit the existing flow.
 * Templates / recipes live inside the builder's "Generate from prompt"
 * modal as one-click examples (kept out of this list so it stays
 * focused on the user's own saved flows).
 */

type LucideIcon = React.ComponentType<{ className?: string; style?: React.CSSProperties }>;

interface WorkflowAction {
  type: string;
  kind?: string;
  title?: string;
  tag?: string;
  points?: number;
  target_slug?: string;
  delay_hours?: number;
  assignee_hint?: string;
  channel_kind?: string;
  provider?: string;
}
interface Workflow {
  id: number;
  name: string;
  prompt: string;
  trigger: string;
  trigger_config: Record<string, unknown>;
  conditions: { field: string; op: string; value: unknown }[];
  actions: WorkflowAction[];
  is_active: boolean;
  run_count: number;
  last_run_at: string | null;
  recent_runs: { outcome: 'ok' | 'skipped' | 'error'; ran_at: string }[];
}

const TRIGGER_META: Record<string, { label: string; Icon: LucideIcon; color: string }> = {
  lead_created:       { label: 'New lead',          Icon: Sparkles,    color: '#10b981' },
  stage_changed:      { label: 'Stage changes',     Icon: ArrowRight,  color: '#3b82f6' },
  score_threshold:    { label: 'Score threshold',   Icon: TrendingUp,  color: '#f59e0b' },
  no_activity:        { label: 'No activity',       Icon: AlertCircle, color: '#ef4444' },
  tag_added:          { label: 'Tag added',         Icon: Tag,         color: '#ec4899' },
  inbound_message:    { label: 'Message received',  Icon: MessageCircle, color: '#8b5cf6' },
  intent_detected:    { label: 'AI intent',         Icon: Sparkles,    color: '#a855f7' },
  appointment_booked: { label: 'Appointment',       Icon: CalendarIcon, color: '#06b6d4' },
  manual:             { label: 'Manual',            Icon: Play,        color: '#64748b' },
};

const ACTION_META: Record<string, { label: string; Icon: LucideIcon; color: string }> = {
  send_email:        { label: 'Email',           Icon: Mail,          color: '#3b82f6' },
  send_whatsapp:     { label: 'WhatsApp',        Icon: MessageCircle, color: '#10b981' },
  create_task:       { label: 'Task',            Icon: CheckSquare,   color: '#f59e0b' },
  move_stage:        { label: 'Move stage',      Icon: ArrowRight,    color: '#ec4899' },
  assign_to:         { label: 'Assign',          Icon: UserIcon,      color: '#06b6d4' },
  add_score:         { label: 'Score',           Icon: TrendingUp,    color: '#f97316' },
  add_tag:           { label: 'Tag',             Icon: Tag,           color: '#8b5cf6' },
  notify_owner:      { label: 'Notify',          Icon: Bell,          color: '#a855f7' },
  ai_reply:          { label: 'AI reply',        Icon: Sparkles,      color: '#10b981' },
  chat_with_kb:      { label: 'Chat w/ KB',      Icon: Sparkles,      color: '#06b6d4' },
  chat_with_ai:      { label: 'Chat w/ AI',      Icon: Sparkles,      color: '#10b981' },
  book_appointment:  { label: 'Book meeting',    Icon: CalendarIcon,  color: '#8b5cf6' },
};

export default function WorkflowsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard required="crm.leads_edit" workspaceId={wsId} skeleton="grid">
      <WorkflowsInner wsId={wsId} />
    </PermissionGuard>
  );
}

function WorkflowsInner({ wsId }: { wsId: string }) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await OrganizationService.listWorkflows();
      if (res?.success) setWorkflows(res.data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return workflows;
    return workflows.filter((w) =>
      w.name.toLowerCase().includes(q) ||
      w.prompt.toLowerCase().includes(q) ||
      w.trigger.toLowerCase().includes(q));
  }, [workflows, search]);

  const toggle = async (wf: Workflow) => {
    const res = await OrganizationService.updateWorkflow(wf.id, { is_active: !wf.is_active });
    if (res?.success) {
      setWorkflows((ws) => ws.map((w) => w.id === wf.id ? { ...w, is_active: !w.is_active } : w));
    }
  };

  const remove = async (wf: Workflow) => {
    if (!confirm(`Delete workflow "${wf.name}"?`)) return;
    const res = await OrganizationService.deleteWorkflow(wf.id);
    if (res?.success) { toast.success('Deleted'); load(); }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-white inline-flex items-center gap-3 flex-wrap">
            Workflows
            <QuotaBadge quota="workflows" label="workflows" />
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Build automations on a visual canvas — drag nodes or generate from a prompt. Like n8n.
          </p>
          <div className="mt-2">
            <QuotaChip quota="workflows" workspaceId={wsId} />
          </div>
        </div>
        <Link
          href={`/w/${wsId}/leads/workflows/builder`}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-500/20"
        >
          <Plus className="w-4 h-4" />
          Add new workflow
        </Link>
      </div>

      {/* Search */}
      <div className="mb-6 max-w-md relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          placeholder="Search workflows…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
        />
      </div>

      {loading ? (
        <PageSkeleton kind="grid" />
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center">
          <Zap className="w-10 h-10 mx-auto mb-3 text-slate-600" />
          <p className="text-sm text-slate-400">
            {search
              ? 'No matching workflows.'
              : 'No workflows yet. Click "Add new workflow" to open the visual builder.'}
          </p>
          {!search && (
            <Link
              href={`/w/${wsId}/leads/workflows/builder`}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold"
            >
              <Plus className="w-4 h-4" />
              Open builder
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {filtered.map((wf) => (
            <WorkflowCard
              key={wf.id}
              wf={wf}
              wsId={wsId}
              onToggle={() => toggle(wf)}
              onDelete={() => remove(wf)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function WorkflowCard({
  wf, wsId, onToggle, onDelete,
}: { wf: Workflow; wsId: string; onToggle: () => void; onDelete: () => void }) {
  const trigMeta = TRIGGER_META[wf.trigger] ?? TRIGGER_META.manual;
  const TIcon = trigMeta.Icon;
  return (
    <article className={`rounded-2xl border p-4 transition-colors ${
      wf.is_active ? 'border-white/5 bg-white/[0.02]' : 'border-white/5 bg-white/[0.01] opacity-60'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-white truncate">{wf.name}</h3>
          {wf.prompt && (
            <p className="text-[11px] text-slate-500 mt-0.5 italic line-clamp-2">&quot;{wf.prompt}&quot;</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <label className="inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={wf.is_active} onChange={onToggle} className="sr-only peer" />
            <span className="w-8 h-4 rounded-full bg-slate-700 peer-checked:bg-emerald-500 relative transition-colors">
              <span className="absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform peer-checked:translate-x-4" />
            </span>
          </label>
          <Link
            href={`/w/${wsId}/leads/workflows/${wf.id}/runs`}
            className="p-1 rounded text-slate-400 hover:text-emerald-300 hover:bg-emerald-500/[0.08]"
            title="View execution history"
          >
            <Activity className="w-3.5 h-3.5" />
          </Link>
          <Link
            href={`/w/${wsId}/leads/workflows/builder/${wf.id}`}
            className="p-1 rounded text-slate-400 hover:text-emerald-300 hover:bg-emerald-500/[0.08]"
            title="Edit on canvas"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </Link>
          <button onClick={onDelete} className="p-1 rounded text-slate-500 hover:text-red-300 hover:bg-red-500/10">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium"
          style={{ backgroundColor: `${trigMeta.color}26`, color: trigMeta.color, border: `1px solid ${trigMeta.color}40` }}
        >
          <TIcon className="w-3 h-3" />
          {trigMeta.label}
        </span>
        <ArrowRight className="w-3 h-3 text-slate-600" />
        {(wf.actions || []).slice(0, 6).map((a, i) => {
          const m = ACTION_META[a.type] ?? { label: a.type.replace('_', ' '), Icon: Sparkles, color: '#64748b' };
          const AIcon = m.Icon;
          return (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium"
              style={{ backgroundColor: `${m.color}26`, color: m.color, border: `1px solid ${m.color}40` }}
            >
              <AIcon className="w-3 h-3" />
              {m.label}
            </span>
          );
        })}
        {(wf.actions || []).length > 6 && (
          <span className="text-[10px] text-slate-500">+{wf.actions.length - 6} more</span>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-500">
        <span>{wf.run_count} runs</span>
        {wf.recent_runs.length > 0 && (
          <span className="inline-flex items-center gap-1">
            {wf.recent_runs[0].outcome === 'ok'
              ? <CheckCircle2 className="w-3 h-3 text-emerald-300" />
              : wf.recent_runs[0].outcome === 'error'
              ? <AlertCircle className="w-3 h-3 text-red-300" />
              : <CheckSquare className="w-3 h-3 text-slate-400" />}
            Last: {new Date(wf.recent_runs[0].ran_at).toLocaleString()}
          </span>
        )}
      </div>
    </article>
  );
}
