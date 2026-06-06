'use client';

import { useCallback, useEffect, useMemo, useState, use as reactUse } from 'react';
import { businessCurrency } from '@/lib/currency';
import {
  AlertTriangle,
  BookOpen,
  Calculator,
  FileText,
  Landmark,
  Receipt,
  RefreshCw,
  Scale,
  Wallet,
} from 'lucide-react';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { AccountingTabs } from '@/components/accounting/kit';
import {
  AccountingService,
  type AccountRow,
  type BillRow,
  type InvoiceRow,
  type JournalEntryRow,
  type PaymentRow,
  type ProfitLossReport,
  type TrialBalanceReport,
} from '@/services/accounting.service';

type AccountingSnapshot = {
  accounts: AccountRow[];
  journals: JournalEntryRow[];
  invoices: InvoiceRow[];
  bills: BillRow[];
  payments: PaymentRow[];
  trialBalance: TrialBalanceReport | null;
  profitLoss: ProfitLossReport | null;
};

function numberValue(value: string | number | null | undefined) {
  const n = Number.parseFloat(String(value ?? 0));
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(value: string | number | null | undefined, currency = businessCurrency()) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(numberValue(value));
}

function statusTone(status: string) {
  const s = status.toLowerCase();
  if (['paid', 'posted', 'completed'].includes(s)) return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200';
  if (['draft', 'pending', 'sent', 'received', 'partial'].includes(s)) return 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200';
  if (['overdue', 'failed', 'void', 'cancelled'].includes(s)) return 'border-red-400/30 bg-red-400/10 text-red-200';
  return 'border-white/10 bg-white/[0.04] text-slate-300';
}

export default function AccountingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard service="accounting" required="accounting.view" workspaceId={wsId} skeleton="dashboard">
      <AccountingInner workspaceId={wsId} />
    </PermissionGuard>
  );
}

function AccountingInner({ workspaceId }: { workspaceId: string }) {
  const [snapshot, setSnapshot] = useState<AccountingSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [accounts, journals, invoices, bills, payments, trialBalance, profitLoss] = await Promise.all([
        AccountingService.listAccounts(workspaceId),
        AccountingService.listJournalEntries(workspaceId),
        AccountingService.listInvoices(workspaceId),
        AccountingService.listBills(workspaceId),
        AccountingService.listPayments(workspaceId),
        AccountingService.trialBalance(workspaceId),
        AccountingService.profitLoss(workspaceId),
      ]);

      const failed = [accounts, journals, invoices, bills, payments, trialBalance, profitLoss].find((res) => !res?.success);
      if (failed) {
        setError(failed.message || 'Accounting data could not be loaded.');
        return;
      }

      setSnapshot({
        accounts: accounts.data ?? [],
        journals: journals.data ?? [],
        invoices: invoices.data ?? [],
        bills: bills.data ?? [],
        payments: payments.data ?? [],
        trialBalance: trialBalance.data ?? null,
        profitLoss: profitLoss.data ?? null,
      });
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err.response?.data?.message || 'Network error while loading accounting.');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]);

  const metrics = useMemo(() => {
    const invoices = snapshot?.invoices ?? [];
    const bills = snapshot?.bills ?? [];
    const payments = snapshot?.payments ?? [];
    const currency = invoices[0]?.currency || bills[0]?.currency || payments[0]?.currency || businessCurrency();
    const receivables = invoices.reduce((sum, invoice) => sum + numberValue(invoice.amount_due), 0);
    const payables = bills.reduce((sum, bill) => sum + numberValue(bill.amount_due), 0);
    const received = payments.filter((p) => p.type === 'received').reduce((sum, p) => sum + numberValue(p.amount), 0);
    const made = payments.filter((p) => p.type === 'made').reduce((sum, p) => sum + numberValue(p.amount), 0);
    return {
      currency,
      accountCount: snapshot?.accounts.length ?? 0,
      postedJournals: (snapshot?.journals ?? []).filter((j) => j.status === 'posted').length,
      receivables,
      payables,
      netCashMovement: received - made,
      netProfit: numberValue(snapshot?.profitLoss?.net_profit),
      trialBalanced: snapshot?.trialBalance?.is_balanced ?? true,
    };
  }, [snapshot]);

  if (loading) return <PageSkeleton kind="dashboard" />;

  if (error) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-red-500/20 bg-red-500/[0.04] p-6 text-center">
        <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-red-300" />
        <h1 className="text-sm font-semibold text-white">Couldn&apos;t load accounting</h1>
        <p className="mt-1 text-xs text-slate-400">{error}</p>
        <button
          onClick={load}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="inline-flex items-center gap-2 text-2xl font-bold text-white">
            <Calculator className="h-6 w-6 text-emerald-300" /> Accounting
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Ledgers, invoices, bills, payments, and financial position for this workspace.
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/[0.08]"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      <AccountingTabs wsId={workspaceId} />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Metric icon={BookOpen} label="Accounts" value={metrics.accountCount.toString()} accent="#10b981" />
        <Metric icon={Scale} label="Posted Journals" value={metrics.postedJournals.toString()} accent="#38bdf8" />
        <Metric icon={FileText} label="Receivables" value={formatMoney(metrics.receivables, metrics.currency)} accent="#f59e0b" />
        <Metric icon={Receipt} label="Payables" value={formatMoney(metrics.payables, metrics.currency)} accent="#f43f5e" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="inline-flex items-center gap-2 text-sm font-bold text-white">
              <Landmark className="h-4 w-4 text-cyan-300" /> Financial Snapshot
            </h2>
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
              metrics.trialBalanced ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' : 'border-red-400/30 bg-red-400/10 text-red-200'
            }`}>
              {metrics.trialBalanced ? 'Balanced' : 'Out of balance'}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <PanelValue label="Net Profit" value={formatMoney(metrics.netProfit, metrics.currency)} />
            <PanelValue label="Net Cash Movement" value={formatMoney(metrics.netCashMovement, metrics.currency)} />
            <PanelValue label="Trial Balance Debit" value={formatMoney(snapshot?.trialBalance?.total_debit, metrics.currency)} />
            <PanelValue label="Trial Balance Credit" value={formatMoney(snapshot?.trialBalance?.total_credit, metrics.currency)} />
          </div>
        </section>

        <section className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
          <h2 className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-white">
            <Wallet className="h-4 w-4 text-emerald-300" /> Recent Payments
          </h2>
          <div className="space-y-2">
            {(snapshot?.payments ?? []).slice(0, 5).map((payment) => (
              <div key={payment.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-black/10 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{payment.payment_no}</p>
                  <p className="truncate text-xs text-slate-500">{payment.customer_name || payment.vendor_name || payment.method}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-white">{formatMoney(payment.amount, payment.currency)}</p>
                  <span className={`inline-flex rounded-full border px-1.5 py-0.5 text-[10px] ${statusTone(payment.status)}`}>
                    {payment.status}
                  </span>
                </div>
              </div>
            ))}
            {(snapshot?.payments ?? []).length === 0 && (
              <p className="rounded-xl border border-white/5 bg-black/10 px-3 py-6 text-center text-xs text-slate-500">
                No payments recorded.
              </p>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <DocumentTable
          title="Open Invoices"
          rows={(snapshot?.invoices ?? []).filter((invoice) => !['paid', 'void', 'cancelled'].includes(invoice.status)).slice(0, 6)}
          kind="invoice"
        />
        <DocumentTable
          title="Open Bills"
          rows={(snapshot?.bills ?? []).filter((bill) => !['paid', 'void'].includes(bill.status)).slice(0, 6)}
          kind="bill"
        />
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: `${accent}1f`, color: accent }}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-white">{value}</p>
    </div>
  );
}

function PanelValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-black/10 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-white">{value}</p>
    </div>
  );
}

function DocumentTable({
  title,
  rows,
  kind,
}: {
  title: string;
  rows: Array<InvoiceRow | BillRow>;
  kind: 'invoice' | 'bill';
}) {
  return (
    <section className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
      <h2 className="mb-4 text-sm font-bold text-white">{title}</h2>
      <div className="overflow-hidden rounded-xl border border-white/5">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">No.</th>
              <th className="px-3 py-2">{kind === 'invoice' ? 'Customer' : 'Vendor'}</th>
              <th className="px-3 py-2">Due</th>
              <th className="px-3 py-2 text-right">Amount Due</th>
              <th className="px-3 py-2 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map((row) => {
              const isInvoice = kind === 'invoice';
              const no = isInvoice ? (row as InvoiceRow).invoice_no : (row as BillRow).bill_no;
              const party = isInvoice ? (row as InvoiceRow).customer_name : (row as BillRow).vendor_name;
              return (
                <tr key={`${kind}-${row.id}`} className="text-slate-300">
                  <td className="px-3 py-2 font-medium text-white">{no}</td>
                  <td className="px-3 py-2">{party}</td>
                  <td className="px-3 py-2">{new Date(row.due_date).toLocaleDateString()}</td>
                  <td className="px-3 py-2 text-right font-semibold text-white">{formatMoney(row.amount_due, row.currency)}</td>
                  <td className="px-3 py-2 text-right">
                    <span className={`inline-flex rounded-full border px-1.5 py-0.5 text-[10px] ${statusTone(row.status)}`}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-xs text-slate-500">
                  Nothing open.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
