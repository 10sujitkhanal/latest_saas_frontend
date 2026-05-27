'use client';

import { useCallback, useEffect, useRef, useState, use as reactUse } from 'react';
import Link from 'next/link';
import {
  Activity, Zap, AlertTriangle, CheckCircle2, Clock, Mail, Phone,
  MessageCircle, Calendar as CalendarIcon, CheckSquare, ArrowRight,
  Sparkles, RefreshCw, TrendingUp,
} from 'lucide-react';
import { PageSpinner } from '@/components/StateViews';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { OrganizationService } from '@/services/organization.service';

/**
 * Automation Center — the "self-driving" cockpit.
 *
 * Auto-refreshes every 20s so users see the system advancing leads in real
 * time without any clicks. Shows:
 *   - Live counters (pending / fired / overdue / total leads)
 *   - Per-source contribution (how much work each channel generates)
 *   - Upcoming queue (what fires in the next 24h)
 *   - Recent auto-fires (what the engine just did)
 */

interface TickSummary { fired: number; moved: number; errors: number; next_due: string | null; }

interface FollowUpRow {
  id: number;
  lead_id: number;
  lead_name: string;
  kind: 'call' | 'email' | 'whatsapp' | 'meeting' | 'task' | 'move_stage';
  title: string;
  due_at: string | null;
  completed_at: string | null;
  source_name: string | null;
  source_color: string | null;
}

interface AutomationStatus {
  tick: TickSummary;
  counts: {
    pending: number;
    auto_fired: number;
    done: number;
    skipped: number;
    overdue: number;
    leads_total: number;
    sources_total: number;
    rules_total: number;
  };
  upcoming: FollowUpRow[];
  recent_fires: FollowUpRow[];
  per_source: { source_id: number; source_name: string; source_color: string; total: number; fired: number; pending: number; }[];
}

const KIND_META: Record<string, { Icon: React.ComponentType<{ className?: string }>; color: string; label: string }> = {
  call:       { Icon: Phone,         color: '#06b6d4', label: 'Call' },
  email:      { Icon: Mail,          color: '#3b82f6', label: 'Email' },
  whatsapp:   { Icon: MessageCircle, color: '#10b981', label: 'WhatsApp' },
  meeting:    { Icon: CalendarIcon,  color: '#8b5cf6', label: 'Meeting' },
  task:       { Icon: CheckSquare,   color: '#f59e0b', label: 'Task' },
  move_stage: { Icon: ArrowRight,    color: '#ec4899', label: 'Stage move' },
};

export default function AutomationCenterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard required="crm.leads_view" workspaceId={wsId} skeleton="dashboard">
      <AutomationCenterInner />
    </PermissionGuard>
  );
}

function AutomationCenterInner() {
  const [status, setStatus] = useState<AutomationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastTick, setLastTick] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true);
    try {
      const res = await OrganizationService.automationStatus();
      if (res?.success) {
        setStatus(res.data);
        setLastTick(new Date());
      }
    } finally {
      setRefreshing(false);
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(() => load(true), 20_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [load]);

  if (loading) return <PageSkeleton kind="dashboard" />;
  if (!status) return null;

  const { counts, upcoming, recent_fires, per_source, tick } = status;
  const maxSourceTotal = Math.max(1, ...per_source.map((s) => s.total));

  return (
    <div>
      {/* Hero */}
      <div className="mb-6 rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-cyan-500/5 to-transparent p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white inline-flex items-center gap-2">
                Automation is running
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
              </h1>
              <p className="text-sm text-slate-300 mt-1">
                Leads land, get stage-tagged, get an owner, and follow-ups fire on their schedule — no one has to lift a finger.
              </p>
            </div>
          </div>
          <button
            onClick={() => load()}
            disabled={refreshing}
            className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-medium inline-flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Tick now
          </button>
        </div>
        <div className="mt-4 flex items-center gap-6 text-[11px] text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <Activity className="w-3 h-3 text-emerald-300" />
            Last tick: {lastTick?.toLocaleTimeString() ?? '—'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            Fired this tick: <strong className="text-emerald-300">{tick.fired}</strong>
          </span>
          <span className="inline-flex items-center gap-1.5">
            Stages auto-moved: <strong className="text-cyan-300">{tick.moved}</strong>
          </span>
          {tick.next_due && (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              Next: <strong className="text-slate-200">{relTime(tick.next_due)}</strong>
            </span>
          )}
        </div>
      </div>

      {/* Counter tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Tile
          label="Pending"
          value={counts.pending}
          Icon={Clock}
          color="#3b82f6"
          sub={counts.overdue > 0 ? `${counts.overdue} overdue` : 'On track'}
        />
        <Tile label="Auto-fired" value={counts.auto_fired} Icon={Zap} color="#10b981" sub="System completions" />
        <Tile label="Leads in play" value={counts.leads_total} Icon={TrendingUp} color="#06b6d4" sub={`${counts.sources_total} sources active`} />
        <Tile
          label="Rules active"
          value={counts.rules_total}
          Icon={Sparkles}
          color="#f59e0b"
          sub={counts.overdue > 0 ? 'Engine catching up…' : 'Engine idle'}
          warn={counts.overdue > 0}
        />
      </div>

      {/* Per-source contribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-1 rounded-2xl border border-white/5 bg-white/[0.02] p-5">
          <h3 className="text-sm font-semibold text-white mb-3 inline-flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-300" />
            Work by source
          </h3>
          {per_source.length === 0 ? (
            <p className="text-xs text-slate-500">No source data yet — create a lead to start the flow.</p>
          ) : (
            <ul className="space-y-2.5">
              {per_source.map((s) => {
                const pct = (s.total / maxSourceTotal) * 100;
                const firedPct = s.total > 0 ? (s.fired / s.total) * 100 : 0;
                return (
                  <li key={s.source_id ?? s.source_name}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.source_color }} />
                        <span className="text-slate-300">{s.source_name}</span>
                      </span>
                      <span className="text-slate-500">{s.total}</span>
                    </div>
                    <div className="relative h-2 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0"
                        style={{ width: `${pct}%`, backgroundColor: `${s.source_color}33` }}
                      />
                      <div
                        className="absolute inset-y-0 left-0"
                        style={{ width: `${(firedPct * pct) / 100}%`, backgroundColor: s.source_color }}
                      />
                    </div>
                    <div className="mt-0.5 flex items-center justify-between text-[10px] text-slate-500">
                      <span>{s.fired} fired</span>
                      <span>{s.pending} pending</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Upcoming */}
        <FeedColumn
          title="Up next (24h)"
          Icon={Clock}
          color="#3b82f6"
          empty="Nothing due in the next 24h."
          rows={upcoming}
          dateLabel={(r) => relTime(r.due_at)}
        />

        {/* Recent fires */}
        <FeedColumn
          title="Just auto-fired"
          Icon={CheckCircle2}
          color="#10b981"
          empty="The engine hasn't fired anything yet."
          rows={recent_fires}
          dateLabel={(r) => relTime(r.completed_at)}
        />
      </div>

      <div className="text-center mt-4">
        <Link href="../automation" className="text-sm text-emerald-400 hover:underline inline-flex items-center gap-1">
          Open flow builder <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}

function Tile({
  label, value, Icon, color, sub, warn,
}: {
  label: string; value: number; Icon: React.ComponentType<{ className?: string }>; color: string; sub: string; warn?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-slate-500">{label}</span>
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${color}26`, color }}
        >
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <div className="mt-2 text-2xl font-bold text-white tabular-nums">{value}</div>
      <p className={`text-[11px] mt-0.5 ${warn ? 'text-amber-300' : 'text-slate-500'}`}>
        {warn && <AlertTriangle className="w-3 h-3 inline mr-1" />}
        {sub}
      </p>
    </div>
  );
}

function FeedColumn({
  title, Icon, color, rows, empty, dateLabel,
}: {
  title: string;
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  rows: FollowUpRow[];
  empty: string;
  dateLabel: (r: FollowUpRow) => string;
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
      <h3 className="text-sm font-semibold text-white mb-3 inline-flex items-center gap-2">
        <Icon className="w-4 h-4" style={{ color }} />
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="text-xs text-slate-500">{empty}</p>
      ) : (
        <ul className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
          {rows.map((r) => {
            const meta = KIND_META[r.kind] ?? KIND_META.task;
            const KindIcon = meta.Icon;
            return (
              <li key={r.id} className="rounded-lg border border-white/5 bg-[#0c1424] p-2.5">
                <div className="flex items-start gap-2.5">
                  <div
                    className="w-7 h-7 rounded-md shrink-0 flex items-center justify-center"
                    style={{ backgroundColor: `${meta.color}26`, color: meta.color }}
                  >
                    <KindIcon className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-white truncate">{r.title || meta.label}</div>
                    <div className="text-[11px] text-slate-500 truncate">{r.lead_name}</div>
                  </div>
                  <div className="text-[10px] text-slate-500 shrink-0">{dateLabel(r)}</div>
                </div>
                {r.source_name && (
                  <div className="mt-1.5 ml-9 inline-flex items-center gap-1 text-[10px] text-slate-400">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: r.source_color || '#64748b' }} />
                    {r.source_name}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function relTime(iso: string | null): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  const diff = t - Date.now();
  const abs = Math.abs(diff);
  const m = Math.round(abs / 60_000);
  const h = Math.round(abs / 3_600_000);
  const d = Math.round(abs / 86_400_000);
  let label: string;
  if (m < 1) label = 'now';
  else if (m < 60) label = `${m}m`;
  else if (h < 48) label = `${h}h`;
  else label = `${d}d`;
  return diff < 0 ? `${label} ago` : `in ${label}`;
}
