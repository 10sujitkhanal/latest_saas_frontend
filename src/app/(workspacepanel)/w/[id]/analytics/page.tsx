'use client';

import { useCallback, useEffect, useMemo, useState, use as reactUse } from 'react';
import {
  Activity, AlertTriangle, BarChart3, Calendar, CalendarClock, CheckSquare,
  Database, Inbox, KeyRound, RefreshCw, Sparkles, TrendingUp, Wand2, Zap,
} from 'lucide-react';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { OrganizationService } from '@/services/organization.service';

/**
 * Unified analytics — every service in one page.
 *
 * Hits ``GET /leads/analytics/overview/`` once; renders one card per
 * service the tenant actually owns. Quota usage gauges live in their
 * own panel up top so the user can see "X used / Y allowed" for each
 * paid feature at a glance.
 *
 * Layout:
 *   ┌─────────────────────────────────────────────────────────┐
 *   │  Quota usage (cap-aware progress bars)                  │
 *   └─────────────────────────────────────────────────────────┘
 *   ┌──── Leads ────┐  ┌──── Inbox ────┐  ┌──── Tasks ─────┐
 *   ┌── Appointments ─┐ ┌── Knowledge ──┐ ┌── Credentials ─┐
 *   ┌── Workflows ──┐  ┌── Automation ──┐ ┌── Scheduling ──┐
 */

type QuotaRow = {
  label: string;
  used: number;
  cap: number;
  unlimited: boolean;
  remaining: number | null;
  percent: number;
  over: boolean;
};

interface Overview {
  generated_at: string;
  sections: {
    leads?: {
      total: number;
      last_30_days: Record<string, number>;
      new_this_week: number;
      by_status: { status: string; n: number }[];
      by_temperature: { temperature: string; n: number }[];
      by_source: { source__name: string | null; n: number }[];
      won_count: number;
      lost_count: number;
      contacts: number;
    };
    inbox?: {
      messages_this_month: number;
      messages_7d: number;
      last_30_days: Record<string, number>;
      unread_conversations: number;
      ai_handled_pct: number;
      by_channel: { channel__kind: string | null; n: number }[];
    };
    tasks?: {
      total: number;
      open: number;
      in_progress: number;
      done: number;
      overdue: number;
      due_today: number;
      by_kind: { kind: string; n: number }[];
      last_30_days: Record<string, number>;
    };
    appointments?: {
      total: number;
      upcoming: number;
      today: number;
      this_week: number;
      past: number;
      by_status: { status: string; n: number }[];
      last_30_days: Record<string, number>;
    };
    scheduling?: { event_types: number; active_event_types: number };
    knowledge?: {
      documents: number;
      chunks: number;
      last_indexed_at: string | null;
      by_kind: { kind: string; n: number }[];
    };
    credentials?: {
      total: number;
      active: number;
      by_kind: { kind: string; n: number }[];
    };
    workflows?: {
      total: number;
      active: number;
      runs_7d: number;
      last_30_days: Record<string, number>;
    };
    automation?: {
      pending_followups: number;
      done_followups: number;
      last_30_days: Record<string, number>;
    };
    quotas?: Record<string, QuotaRow & { _meta?: undefined }>;
  };
}

export default function AnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard service="analytics" required="analytics.view" workspaceId={wsId} skeleton="dashboard">
      <Inner />
    </PermissionGuard>
  );
}

function Inner() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await OrganizationService.analyticsOverview();
      if (res?.success) setData(res.data as Overview);
      else setError(res?.message || 'Failed to load analytics.');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err.response?.data?.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <PageSkeleton kind="dashboard" />;
  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.04] p-6 text-center max-w-md mx-auto">
        <AlertTriangle className="w-8 h-8 text-red-300 mx-auto mb-2" />
        <h2 className="text-sm font-semibold text-white">Couldn&apos;t load analytics</h2>
        <p className="text-[12px] text-slate-400 mt-1">{error}</p>
        <button onClick={load} className="mt-3 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1.5">
          <RefreshCw className="w-3 h-3" /> Try again
        </button>
      </div>
    );
  }
  if (!data) return null;
  const s = data.sections;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white inline-flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-emerald-300" /> Analytics
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Every service in one view. Counts, trends, and live quota usage —
            updated {new Date(data.generated_at).toLocaleTimeString()}.
          </p>
        </div>
        <button onClick={load} className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-slate-300 hover:bg-white/[0.08] text-xs font-semibold inline-flex items-center gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Quota usage bars */}
      {s.quotas && <QuotaPanel rows={s.quotas} />}

      {/* Service cards */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {s.leads && <LeadsCard data={s.leads} />}
        {s.inbox && <InboxCard data={s.inbox} />}
        {s.tasks && <TasksCard data={s.tasks} />}
        {s.appointments && <AppointmentsCard data={s.appointments} />}
        {s.scheduling && <SchedulingCard data={s.scheduling} />}
        {s.knowledge && <KnowledgeCard data={s.knowledge} />}
        {s.credentials && <CredentialsCard data={s.credentials} />}
        {s.workflows && <WorkflowsCard data={s.workflows} />}
        {s.automation && <AutomationCard data={s.automation} />}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
//  Quota usage strip
// ──────────────────────────────────────────────────────────────────────

function QuotaPanel({ rows }: { rows: Record<string, QuotaRow & { _meta?: undefined }> }) {
  const entries = useMemo(
    () => Object.entries(rows).filter(([k]) => !k.startsWith('_')),
    [rows],
  );
  if (entries.length === 0) return null;
  return (
    <section className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
      <h2 className="text-sm font-bold text-white mb-3 inline-flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-cyan-300" /> Quota usage
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        {entries.map(([key, q]) => (
          <QuotaBar key={key} label={q.label || key} row={q} />
        ))}
      </div>
    </section>
  );
}

function QuotaBar({ label, row }: { label: string; row: QuotaRow }) {
  const isUnlimited = row.unlimited || row.cap <= 0;
  const pct = isUnlimited ? 0 : Math.min(100, row.percent ?? 0);
  const bar =
    row.over   ? 'bg-red-500'
    : pct >= 80 ? 'bg-amber-400'
    :             'bg-emerald-500';
  return (
    <div className="rounded-xl border border-white/5 bg-[#0a1322] p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] uppercase tracking-wider text-slate-400 truncate">{label}</span>
        <span className="text-[10px] text-slate-500 tabular-nums">
          {isUnlimited
            ? `${row.used.toLocaleString()} / ∞`
            : `${row.used.toLocaleString()} / ${row.cap.toLocaleString()}`}
        </span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
        <div className={`h-full rounded-full transition-all ${bar}`}
             style={{ width: isUnlimited ? '100%' : `${pct}%`, opacity: isUnlimited ? 0.15 : 1 }} />
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
//  Per-service cards
// ──────────────────────────────────────────────────────────────────────

function Card({ icon, title, accent, children }: {
  icon: React.ReactNode; title: string; accent: string; children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-8 h-8 rounded-xl border flex items-center justify-center ${accent}`}>
          {icon}
        </span>
        <h2 className="text-sm font-bold text-white">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-xl font-bold text-white tabular-nums leading-tight">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      {hint && <div className="text-[10px] text-slate-500 mt-0.5">{hint}</div>}
    </div>
  );
}

// Sparkline rendered as SVG — small inline chart that fits in a card.
function Sparkline({ points, color }: { points: number[]; color: string }) {
  if (!points.length) return null;
  const max = Math.max(1, ...points);
  const w = 200, h = 36;
  const step = w / Math.max(1, points.length - 1);
  const d = points
    .map((y, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(h - (y / max) * h).toFixed(1)}`)
    .join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-9">
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

function Breakdown({ items, max = 5 }: { items: { label: string; n: number }[]; max?: number }) {
  if (!items.length) return null;
  const total = items.reduce((s, it) => s + it.n, 0) || 1;
  return (
    <div className="mt-3 space-y-1.5">
      {items.slice(0, max).map((it) => (
        <div key={it.label}>
          <div className="flex justify-between text-[11px] text-slate-300">
            <span className="truncate pr-2">{it.label || '—'}</span>
            <span className="tabular-nums text-slate-500">{it.n.toLocaleString()}</span>
          </div>
          <div className="h-1 rounded-full bg-white/[0.04] mt-0.5 overflow-hidden">
            <div className="h-full bg-emerald-500/60 rounded-full" style={{ width: `${(it.n / total) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function LeadsCard({ data }: { data: NonNullable<Overview['sections']['leads']> }) {
  const points = Object.values(data.last_30_days);
  return (
    <Card icon={<Sparkles className="w-4 h-4 text-emerald-300" />} title="Leads"
      accent="bg-emerald-500/15 border-emerald-500/30">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Total" value={data.total} />
        <Stat label="This week" value={data.new_this_week} />
        <Stat label="Won" value={data.won_count} hint={`${data.lost_count} lost`} />
      </div>
      <Sparkline points={points} color="rgb(52,211,153)" />
      <Breakdown items={data.by_status.map((b) => ({ label: b.status, n: b.n }))} />
    </Card>
  );
}

function InboxCard({ data }: { data: NonNullable<Overview['sections']['inbox']> }) {
  return (
    <Card icon={<Inbox className="w-4 h-4 text-cyan-300" />} title="Inbox"
      accent="bg-cyan-500/15 border-cyan-500/30">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Messages / mo" value={data.messages_this_month} />
        <Stat label="Last 7 days" value={data.messages_7d} />
        <Stat label="Unread" value={data.unread_conversations} hint={`AI handled ${data.ai_handled_pct}%`} />
      </div>
      <Sparkline points={Object.values(data.last_30_days)} color="rgb(34,211,238)" />
      <Breakdown items={data.by_channel.map((b) => ({ label: b.channel__kind || '—', n: b.n }))} />
    </Card>
  );
}

function TasksCard({ data }: { data: NonNullable<Overview['sections']['tasks']> }) {
  return (
    <Card icon={<CheckSquare className="w-4 h-4 text-amber-300" />} title="Tasks"
      accent="bg-amber-500/15 border-amber-500/30">
      <div className="grid grid-cols-4 gap-3">
        <Stat label="Open" value={data.open} />
        <Stat label="In-progress" value={data.in_progress} />
        <Stat label="Done" value={data.done} />
        <Stat label="Overdue" value={data.overdue} hint={`${data.due_today} due today`} />
      </div>
      <Sparkline points={Object.values(data.last_30_days)} color="rgb(251,191,36)" />
      <Breakdown items={data.by_kind.map((b) => ({ label: b.kind, n: b.n }))} />
    </Card>
  );
}

function AppointmentsCard({ data }: { data: NonNullable<Overview['sections']['appointments']> }) {
  return (
    <Card icon={<CalendarClock className="w-4 h-4 text-purple-300" />} title="Appointments"
      accent="bg-purple-500/15 border-purple-500/30">
      <div className="grid grid-cols-4 gap-3">
        <Stat label="Upcoming" value={data.upcoming} />
        <Stat label="Today" value={data.today} />
        <Stat label="This week" value={data.this_week} />
        <Stat label="Past" value={data.past} />
      </div>
      <Sparkline points={Object.values(data.last_30_days)} color="rgb(192,132,252)" />
      <Breakdown items={data.by_status.map((b) => ({ label: b.status, n: b.n }))} />
    </Card>
  );
}

function SchedulingCard({ data }: { data: NonNullable<Overview['sections']['scheduling']> }) {
  return (
    <Card icon={<Calendar className="w-4 h-4 text-blue-300" />} title="Scheduling"
      accent="bg-blue-500/15 border-blue-500/30">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Event types" value={data.event_types} />
        <Stat label="Active" value={data.active_event_types} hint={`${data.event_types - data.active_event_types} inactive`} />
      </div>
    </Card>
  );
}

function KnowledgeCard({ data }: { data: NonNullable<Overview['sections']['knowledge']> }) {
  return (
    <Card icon={<Database className="w-4 h-4 text-cyan-300" />} title="Knowledge base"
      accent="bg-cyan-500/15 border-cyan-500/30">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Documents" value={data.documents} />
        <Stat label="Chunks" value={data.chunks} />
        <Stat label="Updated" value={data.last_indexed_at ? new Date(data.last_indexed_at).toLocaleDateString() : '—'} />
      </div>
      <Breakdown items={data.by_kind.map((b) => ({ label: b.kind, n: b.n }))} />
    </Card>
  );
}

function CredentialsCard({ data }: { data: NonNullable<Overview['sections']['credentials']> }) {
  return (
    <Card icon={<KeyRound className="w-4 h-4 text-emerald-300" />} title="Credentials"
      accent="bg-emerald-500/15 border-emerald-500/30">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Total" value={data.total} />
        <Stat label="Active" value={data.active} hint={`${data.total - data.active} inactive`} />
      </div>
      <Breakdown items={data.by_kind.map((b) => ({ label: b.kind, n: b.n }))} />
    </Card>
  );
}

function WorkflowsCard({ data }: { data: NonNullable<Overview['sections']['workflows']> }) {
  return (
    <Card icon={<Wand2 className="w-4 h-4 text-purple-300" />} title="Workflows"
      accent="bg-purple-500/15 border-purple-500/30">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Total" value={data.total} />
        <Stat label="Active" value={data.active} />
        <Stat label="Runs 7d" value={data.runs_7d} />
      </div>
      <Sparkline points={Object.values(data.last_30_days)} color="rgb(192,132,252)" />
    </Card>
  );
}

function AutomationCard({ data }: { data: NonNullable<Overview['sections']['automation']> }) {
  return (
    <Card icon={<Zap className="w-4 h-4 text-amber-300" />} title="Automation"
      accent="bg-amber-500/15 border-amber-500/30">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Pending follow-ups" value={data.pending_followups} />
        <Stat label="Done follow-ups" value={data.done_followups} />
      </div>
      <Sparkline points={Object.values(data.last_30_days)} color="rgb(251,191,36)" />
    </Card>
  );
}

// Silence unused-import warnings for icons we may render conditionally.
void Activity;
