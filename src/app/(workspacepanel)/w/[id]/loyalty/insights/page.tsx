'use client';

import { useCallback, use as reactUse } from 'react';
import { TrendingUp, Users, RefreshCw, UserPlus, UserMinus, CalendarClock } from 'lucide-react';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { LoyaltyService, type MembershipInsights } from '@/services/loyalty.service';
import {
  PageHeader, Card, ErrorBox, TableShell, EmptyRow, Pill, useList, LoyaltyTabs,
} from '@/components/loyalty/kit';

function fmtMoney(v: string, currency: string) {
  const n = Number(v || 0);
  return `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function MembershipInsightsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard service="loyalty" required="loyalty.view" workspaceId={wsId} skeleton="list">
      <Inner wsId={wsId} />
    </PermissionGuard>
  );
}

function Inner({ wsId }: { wsId: string }) {
  const fetcher = useCallback(async () => {
    const r = await LoyaltyService.memberships.insights(wsId);
    return { ...r, data: r.data ? [r.data] : [] };
  }, [wsId]);
  const { rows, loading, error, reload } = useList<MembershipInsights>(fetcher);
  const d = rows[0];

  return (
    <div className="space-y-5">
      <PageHeader title="Subscription insights" subtitle="Recurring revenue, growth and churn across your membership base." />
      <LoyaltyTabs wsId={wsId} />
      {loading ? <PageSkeleton kind="list" /> : error ? <ErrorBox message={error} onRetry={reload} /> : d ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat icon={<TrendingUp className="h-5 w-5" />} label="MRR" value={fmtMoney(d.mrr, d.currency)} sub={`${fmtMoney(d.arr, d.currency)} ARR`} accent />
            <Stat icon={<Users className="h-5 w-5" />} label="Active members" value={String(d.active_members)} sub={`${d.auto_renew_count} auto-renew`} />
            <Stat icon={<UserPlus className="h-5 w-5" />} label="New this month" value={String(d.new_this_month)} />
            <Stat icon={<UserMinus className="h-5 w-5" />} label="Churn (mo.)" value={`${(d.churn_rate * 100).toFixed(1)}%`} sub={`${d.churned_this_month} lost`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Revenue by plan */}
            <Card>
              <h3 className="text-sm font-semibold text-white px-1 pb-3">Revenue by plan</h3>
              <TableShell head={<tr><th className="px-3 py-2">Plan</th><th className="px-3 py-2 text-center">Members</th><th className="px-3 py-2 text-right">MRR</th></tr>}>
                {d.by_plan.map((p) => (
                  <tr key={p.plan} className="text-slate-300">
                    <td className="px-3 py-2 text-white">{p.plan} <span className="text-[11px] text-slate-500">/{p.interval.replace('_', ' ')}</span></td>
                    <td className="px-3 py-2 text-center">{p.members}</td>
                    <td className="px-3 py-2 text-right font-semibold text-white">{fmtMoney(p.mrr, d.currency)}</td>
                  </tr>
                ))}
                {d.by_plan.length === 0 && <EmptyRow colSpan={3} label="No active members yet." />}
              </TableShell>
            </Card>

            {/* Upcoming renewals */}
            <Card>
              <h3 className="text-sm font-semibold text-white px-1 pb-3 inline-flex items-center gap-2"><CalendarClock className="h-4 w-4 text-pink-300" /> Renewing in 30 days <span className="text-[11px] text-slate-500">({d.expiring_30d})</span></h3>
              <TableShell head={<tr><th className="px-3 py-2">Member</th><th className="px-3 py-2">Plan</th><th className="px-3 py-2">Renews</th><th className="px-3 py-2 text-center">Auto</th></tr>}>
                {d.upcoming_renewals.map((m) => (
                  <tr key={m.member_no} className="text-slate-300">
                    <td className="px-3 py-2"><span className="text-slate-400">{m.member_no}</span> <span className="text-white">{m.customer}</span></td>
                    <td className="px-3 py-2">{m.plan}</td>
                    <td className="px-3 py-2">{m.end_date}</td>
                    <td className="px-3 py-2 text-center">{m.auto_renew ? <Pill>auto</Pill> : <span className="text-[11px] text-slate-500">manual</span>}</td>
                  </tr>
                ))}
                {d.upcoming_renewals.length === 0 && <EmptyRow colSpan={4} label="Nothing renewing in the next 30 days." />}
              </TableShell>
            </Card>
          </div>

          <p className="flex items-center gap-1.5 text-[11px] text-slate-600"><RefreshCw className="h-3.5 w-3.5" /> Auto-renew memberships are billed nightly — renewal revenue posts to Accounting automatically.</p>
        </>
      ) : null}
    </div>
  );
}

function Stat({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${accent ? 'border-pink-400/30 bg-pink-500/[0.06]' : 'border-white/[0.06] bg-white/[0.02]'}`}>
      <div className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${accent ? 'text-pink-200' : 'text-slate-400'}`}>{icon}{label}</div>
      <div className="mt-1 text-2xl font-bold text-white">{value}</div>
      {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}
