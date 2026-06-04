'use client';

import { useCallback, useEffect, useState, use as reactUse } from 'react';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import {
  AccountingService,
  type TrialBalanceReport, type ProfitLossReport, type GeneralLedgerReport, type BalanceSheetReport, type AgingReport, type CashFlowReport,
} from '@/services/accounting.service';
import {
  AccountingTabs, PageHeader, ErrorBox, Card, TableShell, EmptyRow, Pill, money, apiError,
} from '@/components/accounting/kit';

type Tab = 'trial-balance' | 'balance-sheet' | 'profit-loss' | 'general-ledger' | 'ar-aging' | 'ap-aging' | 'cash-flow';

export default function ReportsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard service="accounting" required="accounting.reports.view" workspaceId={wsId} skeleton="list">
      <Inner wsId={wsId} />
    </PermissionGuard>
  );
}

function Inner({ wsId }: { wsId: string }) {
  const [tab, setTab] = useState<Tab>('trial-balance');
  const [tb, setTb] = useState<TrialBalanceReport | null>(null);
  const [pl, setPl] = useState<ProfitLossReport | null>(null);
  const [gl, setGl] = useState<GeneralLedgerReport | null>(null);
  const [bs, setBs] = useState<BalanceSheetReport | null>(null);
  const [ar, setAr] = useState<AgingReport | null>(null);
  const [ap, setAp] = useState<AgingReport | null>(null);
  const [cf, setCf] = useState<CashFlowReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [tbRes, plRes, glRes, bsRes, arRes, apRes, cfRes] = await Promise.all([
        AccountingService.trialBalance(wsId),
        AccountingService.profitLoss(wsId),
        AccountingService.generalLedger(wsId),
        AccountingService.balanceSheet(wsId),
        AccountingService.arAging(wsId),
        AccountingService.apAging(wsId),
        AccountingService.cashFlow(wsId),
      ]);
      const failed = [tbRes, plRes, glRes, bsRes, arRes, apRes, cfRes].find((r) => !r?.success);
      if (failed) { setError(failed.message || 'Could not load reports.'); return; }
      setTb(tbRes.data); setPl(plRes.data); setGl(glRes.data); setBs(bsRes.data); setAr(arRes.data); setAp(apRes.data); setCf(cfRes.data);
    } catch (e) { setError(apiError(e, 'Network error loading reports.')); }
    finally { setLoading(false); }
  }, [wsId]);

  useEffect(() => { load(); }, [load]);

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: 'trial-balance', label: 'Trial Balance' },
    { key: 'balance-sheet', label: 'Balance Sheet' },
    { key: 'profit-loss', label: 'Profit & Loss' },
    { key: 'general-ledger', label: 'General Ledger' },
    { key: 'cash-flow', label: 'Cash Flow' },
    { key: 'ar-aging', label: 'AR Aging' },
    { key: 'ap-aging', label: 'AP Aging' },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Reports" subtitle="Computed from posted journal entries only." />
      <AccountingTabs wsId={wsId} />

      <div className="flex gap-1 rounded-xl border border-white/5 bg-white/[0.02] p-1">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${tab === t.key ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-200'}`}>{t.label}</button>
        ))}
      </div>

      {loading ? <PageSkeleton kind="list" /> : error ? <ErrorBox message={error} onRetry={load} /> : (
        <Card>
          {tab === 'trial-balance' && tb && (
            <>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold text-white">Trial Balance</h2>
                <span className={`rounded-full border px-2 py-0.5 text-[11px] ${tb.is_balanced ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' : 'border-red-400/30 bg-red-400/10 text-red-200'}`}>{tb.is_balanced ? 'Balanced' : 'Out of balance'}</span>
              </div>
              <TableShell head={<tr><th className="px-3 py-2">Code</th><th className="px-3 py-2">Account</th><th className="px-3 py-2">Type</th><th className="px-3 py-2 text-right">Debit</th><th className="px-3 py-2 text-right">Credit</th></tr>}>
                {tb.rows.map((r) => (
                  <tr key={r.account_id} className="text-slate-300"><td className="px-3 py-2 font-mono text-white">{r.code}</td><td className="px-3 py-2">{r.name}</td><td className="px-3 py-2 capitalize">{r.type}</td><td className="px-3 py-2 text-right">{money(r.debit)}</td><td className="px-3 py-2 text-right">{money(r.credit)}</td></tr>
                ))}
                {tb.rows.length === 0 && <EmptyRow colSpan={5} label="No posted activity yet." />}
                <tr className="bg-white/[0.03] font-semibold text-white"><td className="px-3 py-2" colSpan={3}>Total</td><td className="px-3 py-2 text-right">{money(tb.total_debit)}</td><td className="px-3 py-2 text-right">{money(tb.total_credit)}</td></tr>
              </TableShell>
            </>
          )}

          {tab === 'balance-sheet' && bs && (
            <>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold text-white">Balance Sheet</h2>
                <span className={`rounded-full border px-2 py-0.5 text-[11px] ${bs.is_balanced ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' : 'border-red-400/30 bg-red-400/10 text-red-200'}`}>{bs.is_balanced ? 'Balanced' : 'Out of balance'}</span>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <BsSection title="Assets" lines={bs.assets} total={bs.total_assets} />
                <div className="space-y-4">
                  <BsSection title="Liabilities" lines={bs.liabilities} total={bs.total_liabilities} />
                  <BsSection title="Equity" lines={bs.equity} total={bs.total_equity} extra={{ label: 'Retained earnings (net income)', amount: bs.net_income }} />
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500">Assets {money(bs.total_assets)} = Liabilities {money(bs.total_liabilities)} + Equity {money(bs.total_equity)}</p>
            </>
          )}

          {tab === 'profit-loss' && pl && (
            <>
              <div className="mb-3 grid gap-3 sm:grid-cols-3">
                <Stat label="Income" value={money(pl.income)} />
                <Stat label="Expenses" value={money(pl.expenses)} />
                <Stat label="Net Profit" value={money(pl.net_profit)} accent />
              </div>
              <TableShell head={<tr><th className="px-3 py-2">Code</th><th className="px-3 py-2">Account</th><th className="px-3 py-2">Type</th><th className="px-3 py-2 text-right">Amount</th></tr>}>
                {pl.rows.map((r) => (
                  <tr key={r.account_id} className="text-slate-300"><td className="px-3 py-2 font-mono text-white">{r.code}</td><td className="px-3 py-2">{r.name}</td><td className="px-3 py-2 capitalize">{r.type}</td><td className="px-3 py-2 text-right">{money(r.amount)}</td></tr>
                ))}
                {pl.rows.length === 0 && <EmptyRow colSpan={4} label="No income or expense activity yet." />}
              </TableShell>
            </>
          )}

          {tab === 'cash-flow' && cf && (
            <>
              <div className="mb-4 grid gap-3 sm:grid-cols-4">
                <Stat label="Cash position" value={money(cf.cash_position)} accent />
                <Stat label="Total in" value={money(cf.total_in)} />
                <Stat label="Total out" value={money(cf.total_out)} />
                <Stat label="Net change" value={money(cf.net_change)} />
              </div>
              <TableShell head={<tr><th className="px-3 py-2">Month</th><th className="px-3 py-2 text-right">Cash in</th><th className="px-3 py-2 text-right">Cash out</th><th className="px-3 py-2 text-right">Net</th></tr>}>
                {cf.months.map((m) => (
                  <tr key={m.month} className="text-slate-300"><td className="px-3 py-2 text-white">{m.month}</td><td className="px-3 py-2 text-right text-emerald-300">{money(m.in)}</td><td className="px-3 py-2 text-right text-red-300">{money(m.out)}</td><td className="px-3 py-2 text-right">{money(m.net)}</td></tr>
                ))}
                {cf.months.length === 0 && <EmptyRow colSpan={4} label="No bank movement yet." />}
              </TableShell>
            </>
          )}

          {tab === 'ar-aging' && ar && <AgingTable report={ar} partyLabel="Customer" docLabel="Invoice" />}
          {tab === 'ap-aging' && ap && <AgingTable report={ap} partyLabel="Vendor" docLabel="Bill" />}

          {tab === 'general-ledger' && gl && (
            <TableShell head={<tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Journal</th><th className="px-3 py-2">Account</th><th className="px-3 py-2">Memo</th><th className="px-3 py-2 text-right">Debit</th><th className="px-3 py-2 text-right">Credit</th></tr>}>
              {gl.rows.map((r) => (
                <tr key={r.id} className="text-slate-300"><td className="px-3 py-2">{r.date}</td><td className="px-3 py-2 font-mono text-white">{r.journal_no}</td><td className="px-3 py-2">{r.account_code} {r.account_name}</td><td className="px-3 py-2">{r.description}</td><td className="px-3 py-2 text-right">{money(r.debit)}</td><td className="px-3 py-2 text-right">{money(r.credit)}</td></tr>
              ))}
              {gl.rows.length === 0 && <EmptyRow colSpan={6} label="No posted ledger lines yet." />}
            </TableShell>
          )}
        </Card>
      )}
    </div>
  );
}

function AgingTable({ report, partyLabel, docLabel }: { report: AgingReport; partyLabel: string; docLabel: string }) {
  const b = report.buckets;
  const cards: Array<[string, string]> = [
    ['Current', b.current], ['1–30 days', b.d1_30], ['31–60 days', b.d31_60], ['61–90 days', b.d61_90], ['90+ days', b.d90_plus],
  ];
  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {cards.map(([label, val]) => (
          <div key={label} className="rounded-xl border border-white/5 bg-black/10 p-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 text-sm font-bold text-white">{money(val)}</p>
          </div>
        ))}
      </div>
      <TableShell head={<tr><th className="px-3 py-2">{docLabel}</th><th className="px-3 py-2">{partyLabel}</th><th className="px-3 py-2">Due</th><th className="px-3 py-2 text-right">Days overdue</th><th className="px-3 py-2 text-right">Amount due</th><th className="px-3 py-2 text-center">Bucket</th></tr>}>
        {report.rows.map((r) => (
          <tr key={r.id} className="text-slate-300">
            <td className="px-3 py-2 font-mono text-white">{r.number}</td>
            <td className="px-3 py-2">{r.party}</td>
            <td className="px-3 py-2">{r.due_date}</td>
            <td className="px-3 py-2 text-right">{r.days_overdue}</td>
            <td className="px-3 py-2 text-right">{money(r.amount_due)}</td>
            <td className="px-3 py-2 text-center"><Pill>{r.bucket === 'current' ? 'current' : r.bucket.replace('d', '').replace('_', '–') + ' days'}</Pill></td>
          </tr>
        ))}
        {report.rows.length === 0 && <EmptyRow colSpan={6} label="Nothing outstanding." />}
        <tr className="bg-white/[0.03] font-semibold text-white"><td className="px-3 py-2" colSpan={4}>Total outstanding</td><td className="px-3 py-2 text-right">{money(report.total)}</td><td /></tr>
      </TableShell>
    </>
  );
}

function BsSection({ title, lines, total, extra }: { title: string; lines: Array<{ account_id: number; code: string; name: string; amount: string }>; total: string; extra?: { label: string; amount: string } }) {
  return (
    <div className="rounded-xl border border-white/5 bg-black/10 p-4">
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">{title}</h3>
      <div className="space-y-1">
        {lines.map((l) => (
          <div key={l.account_id} className="flex justify-between text-sm text-slate-300"><span>{l.code} {l.name}</span><span className="text-white">{money(l.amount)}</span></div>
        ))}
        {extra && <div className="flex justify-between text-sm text-slate-300"><span>{extra.label}</span><span className="text-white">{money(extra.amount)}</span></div>}
        {lines.length === 0 && !extra && <p className="text-xs text-slate-500">Nothing here yet.</p>}
      </div>
      <div className="mt-2 flex justify-between border-t border-white/10 pt-2 text-sm font-bold text-white"><span>Total {title}</span><span>{money(total)}</span></div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-white/5 bg-black/10 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-bold ${accent ? 'text-emerald-300' : 'text-white'}`}>{value}</p>
    </div>
  );
}
