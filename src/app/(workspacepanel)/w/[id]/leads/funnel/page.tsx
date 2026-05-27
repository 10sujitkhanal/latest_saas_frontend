'use client';

import { useCallback, useEffect, useMemo, useState, use as reactUse } from 'react';
import {
  TrendingUp, Users, DollarSign, Activity, Calendar,
  BarChart3, ArrowRight, Sparkles, Bot, User as UserIcon,
} from 'lucide-react';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { OrganizationService } from '@/services/organization.service';

/**
 * Funnel analytics — the §11 dashboard from the spec.
 *
 * Top: KPI tiles (leads, contacts, won/lost value, appointments).
 * Middle: stacked funnel chain (New → Contacted → Qualified → Proposal → Won)
 *         with drop-off percentages between stages.
 * Bottom: by-source table + AI-handled vs human-handled split.
 */

interface SourceRow { id: number | null; name: string; color: string; kind: string; total: number; won: number; lost: number; value: number; win_rate: number; }
interface StageRow  { id: number | null; name: string; color: string; order: number; probability: number; total: number; value: number; }
interface FunnelData {
  window_days: number;
  totals: { leads: number; contacts: number; won_value: number; lost_value: number; appointments: number; };
  by_source: SourceRow[];
  by_stage: StageRow[];
  funnel_chain: { slug: string; count: number }[];
  handling: { ai_handled: number; human_handled: number };
}

export default function FunnelAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard required="crm.leads_view" workspaceId={wsId} skeleton="dashboard">
      <FunnelAnalyticsInner />
    </PermissionGuard>
  );
}

function FunnelAnalyticsInner() {
  const [data, setData] = useState<FunnelData | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await OrganizationService.funnelAnalytics(days);
      if (res?.success) setData(res.data);
    } finally { setLoading(false); }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const maxStage = useMemo(() => Math.max(1, ...(data?.by_stage.map((s) => s.total) || [1])), [data]);
  const maxSource = useMemo(() => Math.max(1, ...(data?.by_source.map((s) => s.total) || [1])), [data]);

  if (loading || !data) return <PageSkeleton kind="dashboard" />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Funnel analytics</h1>
          <p className="text-sm text-slate-400 mt-1">
            Where leads are coming from, where they're dropping, and what's converting.
          </p>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="px-3 py-2 rounded-lg bg-[#080e1c] border border-white/10 text-sm text-white"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={365}>Last year</option>
        </select>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <Tile Icon={Users} label="Leads" value={data.totals.leads} color="#3b82f6" />
        <Tile Icon={Users} label="Contacts" value={data.totals.contacts} color="#06b6d4" />
        <Tile Icon={DollarSign} label="Won value" value={`$${Math.round(data.totals.won_value).toLocaleString()}`} color="#10b981" />
        <Tile Icon={Activity} label="Lost value" value={`$${Math.round(data.totals.lost_value).toLocaleString()}`} color="#ef4444" />
        <Tile Icon={Calendar} label="Appointments" value={data.totals.appointments} color="#a855f7" />
      </div>

      {/* Funnel chain */}
      <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 mb-6">
        <h3 className="text-sm font-semibold text-white mb-4 inline-flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-emerald-300" />
          Conversion funnel
        </h3>
        <div className="flex items-end gap-3">
          {data.funnel_chain.map((s, idx) => {
            const prev = data.funnel_chain[idx - 1];
            const dropPct = prev && prev.count > 0 ? ((prev.count - s.count) / prev.count) * 100 : 0;
            const maxChain = Math.max(1, ...data.funnel_chain.map(x => x.count));
            const heightPct = Math.max(8, (s.count / maxChain) * 100);
            return (
              <div key={s.slug} className="flex-1 flex flex-col items-center">
                {idx > 0 && (
                  <div className="text-[10px] text-amber-300 mb-1">
                    -{dropPct.toFixed(0)}%
                  </div>
                )}
                <div
                  className="w-full rounded-t-lg bg-gradient-to-t from-emerald-500/30 to-emerald-500/60 transition-all"
                  style={{ height: `${heightPct * 2}px`, minHeight: 30 }}
                />
                <div className="mt-2 text-center w-full">
                  <div className="text-lg font-bold text-white tabular-nums">{s.count}</div>
                  <div className="text-[11px] text-slate-500 capitalize">{s.slug}</div>
                </div>
                {idx < data.funnel_chain.length - 1 && (
                  <ArrowRight className="absolute w-4 h-4 text-slate-600 hidden" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* By stage */}
      <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 mb-6">
        <h3 className="text-sm font-semibold text-white mb-3">Leads by stage</h3>
        <ul className="space-y-2.5">
          {data.by_stage.map((s) => {
            const w = (s.total / maxStage) * 100;
            return (
              <li key={s.id ?? s.name}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="text-slate-300">{s.name}</span>
                    <span className="text-slate-500">({s.probability}%)</span>
                  </span>
                  <span className="text-slate-400">{s.total} · ${Math.round(s.value).toLocaleString()}</span>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full" style={{ width: `${w}%`, backgroundColor: s.color }} />
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* By source */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.6fr,1fr] gap-4">
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Leads by source</h3>
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="text-left py-2">Source</th>
                <th className="text-right py-2">Total</th>
                <th className="text-right py-2">Won</th>
                <th className="text-right py-2">Lost</th>
                <th className="text-right py-2">Value</th>
                <th className="text-right py-2">Win rate</th>
              </tr>
            </thead>
            <tbody>
              {data.by_source.map((s) => (
                <tr key={s.id ?? s.name} className="border-t border-white/5">
                  <td className="py-2">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className="text-slate-300">{s.name}</span>
                    </span>
                  </td>
                  <td className="text-right text-slate-300">{s.total}</td>
                  <td className="text-right text-emerald-300">{s.won}</td>
                  <td className="text-right text-red-300">{s.lost}</td>
                  <td className="text-right text-slate-400">${Math.round(s.value).toLocaleString()}</td>
                  <td className="text-right text-emerald-300">{Math.round(s.win_rate * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
          <h3 className="text-sm font-semibold text-white mb-3 inline-flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-300" /> AI vs human
          </h3>
          <div className="space-y-3">
            <Row Icon={Bot} label="AI-handled conversations" value={data.handling.ai_handled} color="#10b981" />
            <Row Icon={UserIcon} label="Human-handled" value={data.handling.human_handled} color="#06b6d4" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Tile({ Icon, label, value, color }: {
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string; value: number | string; color: string;
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-slate-500">{label}</span>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}26`, color }}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <div className="mt-2 text-2xl font-bold text-white tabular-nums">{value}</div>
    </div>
  );
}

function Row({ Icon, label, value, color }: {
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string; value: number; color: string;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5">
      <span className="inline-flex items-center gap-2 text-sm text-slate-300">
        <Icon className="w-4 h-4" style={{ color }} />
        {label}
      </span>
      <span className="text-lg font-bold text-white tabular-nums">{value}</span>
    </div>
  );
}
