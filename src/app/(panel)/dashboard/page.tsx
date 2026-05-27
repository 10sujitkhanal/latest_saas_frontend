'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Topbar from '@/components/Topbar';
import { PageSpinner, PageError } from '@/components/StateViews';
import { useAuthStore } from '@/store/authStore';
import { useNotificationsStore } from '@/store/notificationsStore';
import { OrganizationService, type CurrentSubscription, type NotificationItem } from '@/services/organization.service';
import { Sparkles } from 'lucide-react';

const accentMap = {
  emerald: 'from-emerald-500/20 to-emerald-500/0 text-emerald-300',
  sky: 'from-sky-500/20 to-sky-500/0 text-sky-300',
  violet: 'from-violet-500/20 to-violet-500/0 text-violet-300',
  amber: 'from-amber-500/20 to-amber-500/0 text-amber-300',
} as const;
type Accent = keyof typeof accentMap;

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const notifications = useNotificationsStore((s) => s.items);
  const unread = useNotificationsStore((s) => s.unread);
  const fetchNotifications = useNotificationsStore((s) => s.fetch);
  const [data, setData] = useState<CurrentSubscription | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await OrganizationService.currentSubscription(1, 5);
      if (res.success) {
        setData(res.data);
      } else {
        setError(res.message || 'Failed to load dashboard.');
      }
    } catch (err) {
      const v = err as { response?: { data?: { message?: string } } };
      setError(v.response?.data?.message ?? 'Failed to load dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    fetchNotifications();
  }, [fetchNotifications]);

  const greeting = user?.email?.split('@')[0] ?? 'there';

  return (
    <>
      <Topbar
        title={`Welcome back, ${greeting}`}
        subtitle="Here's what's happening across your organization."
        actions={
          <Link
            href="/subscription"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-lg shadow-emerald-500/20 transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Manage plan
          </Link>
        }
      />

      <main className="flex-1 px-6 lg:px-10 py-8 overflow-y-auto">
        {loading && <PageSpinner />}
        {!loading && error && <PageError message={error} onRetry={load} />}
        {!loading && !error && data && <DashboardBody data={data} unread={unread} recent={notifications.slice(0, 5)} />}
      </main>
    </>
  );
}

function DashboardBody({
  data,
  unread,
  recent,
}: {
  data: CurrentSubscription;
  unread: number;
  // ``ReturnType<typeof useNotificationsStore>`` resolves to the
  // selector's return value (not the state itself), which TS infers
  // as ``unknown``. Use the canonical NotificationItem type from
  // the service for a stable shape.
  recent: NotificationItem[];
}) {
  const sub = data.subscription;
  // ``-1`` / ``0`` both signal an unlimited cap. Render it as "∞" in
  // the small "of X cap" delta so the dashboard never reads
  // "of -1 cap".
  const fmtCap = (n: number) => (n == null || n <= 0 ? 'unlimited' : n.toLocaleString());
  const cards: Array<{ label: string; value: string; delta: string; accent: Accent }> = [
    {
      label: 'Workspaces',
      value: data.usage.workspaces.toLocaleString(),
      delta: `of ${fmtCap(sub.effective_max_workspaces)} cap`,
      accent: 'emerald',
    },
    {
      label: 'Team members',
      value: data.usage.users.toLocaleString(),
      delta: `of ${fmtCap(sub.effective_max_users)} cap`,
      accent: 'sky',
    },
    {
      label: 'Leads',
      value: data.usage.leads.toLocaleString(),
      delta: `of ${fmtCap(sub.effective_max_leads)} cap`,
      accent: 'violet',
    },
    {
      label: 'Unread alerts',
      value: unread.toLocaleString(),
      delta: 'across the org',
      accent: 'amber',
    },
  ];

  const renewsLabel = sub.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString()
    : '—';

  return (
    <>
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="relative overflow-hidden rounded-2xl bg-white/[0.02] border border-white/5 p-5">
            <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full blur-2xl bg-gradient-to-br ${accentMap[c.accent]}`} />
            <div className="relative">
              <div className="text-xs uppercase tracking-wider text-slate-500">{c.label}</div>
              <div className="mt-2 text-3xl font-bold text-white">{c.value}</div>
              <div className={`mt-1 text-xs ${accentMap[c.accent].split(' ').slice(-1)[0]}`}>{c.delta}</div>
            </div>
          </div>
        ))}
      </section>

      <section className="mt-8 grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 rounded-2xl bg-white/[0.02] border border-white/5 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Recent notifications</h2>
            <Link href="/notifications" className="text-xs text-emerald-300 hover:text-emerald-200">View all →</Link>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-slate-500">No recent notifications.</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {recent.map((n) => (
                <li key={n.id} className="py-3 flex items-start gap-3 text-sm">
                  <span
                    className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                      n.type === 'SUCCESS' || n.type === 'PLAN_RENEWED'
                        ? 'bg-emerald-400'
                        : n.type === 'WARNING'
                        ? 'bg-amber-400'
                        : n.type === 'ERROR' || n.type === 'PLAN_EXPIRED'
                        ? 'bg-red-400'
                        : 'bg-sky-400'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-medium">{n.title}</div>
                    {n.message && <div className="text-xs text-slate-400 truncate">{n.message}</div>}
                  </div>
                  <div className="text-xs text-slate-500 whitespace-nowrap">
                    {new Date(n.created_at).toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-6">
          <h2 className="text-sm font-semibold text-white mb-4">Current plan</h2>
          <div className="text-xs uppercase tracking-wider text-emerald-300">Plan</div>
          <div className="text-xl font-bold text-white mt-1">{sub.plan_name}</div>
          <div className="text-xs text-slate-400 mt-0.5">
            Status: <span className="text-white font-medium uppercase tracking-wider">{sub.status}</span>
            {' · '}
            Renews {renewsLabel}
          </div>
          <Usage label="Workspaces" used={data.usage.workspaces} cap={sub.effective_max_workspaces} />
          <Usage label="Members" used={data.usage.users} cap={sub.effective_max_users} />
          <Usage label="Leads" used={data.usage.leads} cap={sub.effective_max_leads} />
          {sub.is_agency && sub.agency_fee_percentage && (
            <p className="mt-4 text-xs text-slate-500">
              Agency platform fee: <span className="text-white font-medium">{sub.agency_fee_percentage}%</span>
            </p>
          )}
          <Link
            href="/subscription"
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-300 hover:text-emerald-200"
          >
            Manage subscription →
          </Link>
        </div>
      </section>
    </>
  );
}

function Usage({ label, used, cap }: { label: string; used: number; cap: number }) {
  // ``-1`` (and ``0``) both mean unlimited. The original ``!cap`` check
  // only caught ``0`` because JS treats ``-1`` as truthy, so the chart
  // tried to compute a percentage against a negative cap and rendered
  // "WORKSPACES -100%". Tighten to ``cap <= 0``.
  if (cap == null || cap <= 0) {
    return (
      <div className="mt-4">
        <div className="flex justify-between text-xs text-slate-400">
          <span>{label}</span>
          <span>unlimited</span>
        </div>
        <div className="mt-1.5 h-1.5 rounded-full bg-white/5" />
      </div>
    );
  }
  const pct = Math.min(100, Math.round((used / cap) * 100));
  return (
    <div className="mt-4">
      <div className="flex justify-between text-xs text-slate-400">
        <span>{label}</span>
        <span className="text-white">{pct}%</span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className={`h-full ${pct > 85 ? 'bg-amber-500' : 'bg-gradient-to-r from-emerald-500 to-sky-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
