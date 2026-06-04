'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Topbar from '@/components/Topbar';
import { PageSpinner, PageError, EmptyState } from '@/components/StateViews';
import { OrganizationService, type CurrentSubscription } from '@/services/organization.service';
import { useAuthStore } from '@/store/authStore';
import PaymentMethods from '@/components/billing/PaymentMethods';

const statusClass: Record<string, string> = {
  PAID: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  PENDING: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  FAILED: 'bg-red-500/10 text-red-300 border-red-500/20',
  VOID: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
};

const money = (a: string | number) => {
  const n = typeof a === 'string' ? parseFloat(a) : a;
  return `$${n.toFixed(2)}`;
};

export default function BillingPage() {
  const isAdmin = useAuthStore((s) => s.user?.role) === 'ADMIN';
  const [data, setData] = useState<CurrentSubscription | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const PAGE_SIZE = 10;

  const load = async (p = page) => {
    setLoading(true);
    setError(null);
    try {
      const res = await OrganizationService.currentSubscription(p, PAGE_SIZE);
      if (res.success) setData(res.data);
      else setError(res.message || 'Failed to load billing.');
    } catch (err) {
      const v = err as { response?: { data?: { message?: string } } };
      setError(v.response?.data?.message ?? 'Failed to load billing.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(page);
  }, [page]);

  const sub = data?.subscription;
  const invoices = data?.invoices ?? [];
  const totalPaid = invoices.filter((i) => i.status === 'PAID').reduce((sum, i) => sum + parseFloat(i.amount), 0);
  const pendingCount = invoices.filter((i) => i.status === 'PENDING').length;

  return (
    <>
      <Topbar
        title="Billing"
        subtitle="Track invoices and payments."
        actions={
          <Link
            href="/subscription"
            className="px-3 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 text-slate-200 text-sm font-medium"
          >
            Change plan
          </Link>
        }
      />

      <main className="flex-1 px-6 lg:px-10 py-8 overflow-y-auto">
        {loading && !data && <PageSpinner />}
        {error && <PageError message={error} onRetry={() => load(page)} />}

        {/* Saved payment cards — admin only (backend also enforces). */}
        {isAdmin && <PaymentMethods />}

        {data && (
          <>
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <SummaryCard
                label="Current plan"
                value={sub?.plan_name ?? '—'}
                hint={sub ? `${sub.billing_cycle === 'YEARLY' ? 'Annual' : 'Monthly'} billing · ${sub.status}` : ''}
              />
              <SummaryCard
                label="Total paid"
                value={money(totalPaid)}
                hint={`Across ${invoices.filter((i) => i.status === 'PAID').length} invoices on this page`}
              />
              <SummaryCard
                label="Pending"
                value={String(pendingCount)}
                hint={pendingCount === 0 ? "You're all settled up" : 'Action required'}
                tone={pendingCount > 0 ? 'amber' : 'emerald'}
              />
            </section>

            <h2 className="text-lg font-semibold text-white mb-4">Invoices</h2>
            {invoices.length === 0 ? (
              <EmptyState
                title="No invoices yet"
                description="Invoices will appear here once your subscription starts billing."
              />
            ) : (
              <div className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-white/[0.02] border-b border-white/5">
                    <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                      <th className="px-5 py-3 font-medium">Invoice</th>
                      <th className="px-5 py-3 font-medium">Plan</th>
                      <th className="px-5 py-3 font-medium">Period</th>
                      <th className="px-5 py-3 font-medium">Amount</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-white/[0.02]">
                        <td className="px-5 py-3 font-medium text-white">#{inv.id}</td>
                        <td className="px-5 py-3 text-slate-300">{inv.plan_name ?? '—'}</td>
                        <td className="px-5 py-3 text-slate-400">
                          {inv.period_start ? new Date(inv.period_start).toLocaleDateString() : '—'}
                          {' → '}
                          {inv.period_end ? new Date(inv.period_end).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-5 py-3 text-slate-200">{money(inv.amount)}</td>
                        <td className="px-5 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full border ${
                              statusClass[inv.status] ?? 'bg-slate-500/10 text-slate-300 border-slate-500/20'
                            }`}
                          >
                            {inv.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {data.pagination.total_pages > 1 && (
                  <div className="flex items-center justify-between px-5 py-3 border-t border-white/5 text-xs text-slate-400">
                    <span>
                      Page {data.pagination.page} of {data.pagination.total_pages} · {data.pagination.total} invoices total
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={!data.pagination.has_prev}
                        className="px-3 py-1.5 rounded-md border border-white/10 hover:bg-white/[0.05] disabled:opacity-40"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setPage((p) => p + 1)}
                        disabled={!data.pagination.has_next}
                        className="px-3 py-1.5 rounded-md border border-white/10 hover:bg-white/[0.05] disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  tone = 'emerald',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'emerald' | 'amber';
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
      <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-2 text-2xl font-bold ${tone === 'amber' ? 'text-amber-300' : 'text-white'}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}
