'use client';

/**
 * Shared UI kit for the Accounting module pages. Keeps every page consistent
 * with the workspace panel's dark theme and avoids repeating table/modal/form
 * boilerplate. Pure presentational helpers + a small list-loading hook that
 * talks to AccountingService (no mock fallback - surfaces API messages).
 */
import { useCallback, useEffect, useState } from 'react';
import { businessCurrency } from '@/lib/currency';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { RefreshCw, X, Plus, AlertTriangle } from 'lucide-react';
import type { ApiEnvelope } from '@/services/accounting.service';

export function numberValue(value: string | number | null | undefined) {
  const n = Number.parseFloat(String(value ?? 0));
  return Number.isFinite(n) ? n : 0;
}

export function money(value: string | number | null | undefined, currency = businessCurrency()) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(numberValue(value));
}

export function toneClass(status: string) {
  const s = (status || '').toLowerCase();
  if (['paid', 'posted', 'completed', 'active'].includes(s)) return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200';
  if (['draft', 'pending', 'sent', 'received', 'partial', 'future'].includes(s)) return 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200';
  if (['overdue', 'failed', 'void', 'cancelled', 'closed'].includes(s)) return 'border-red-400/30 bg-red-400/10 text-red-200';
  return 'border-white/10 bg-white/[0.04] text-slate-300';
}

export function Pill({ children }: { children: React.ReactNode }) {
  return <span className={`inline-flex rounded-full border px-1.5 py-0.5 text-[10px] ${toneClass(String(children))}`}>{children}</span>;
}

const TABS: Array<{ label: string; seg: string }> = [
  { label: 'Overview', seg: '' },
  { label: 'Accounts', seg: 'accounts' },
  { label: 'Journal', seg: 'journal' },
  { label: 'Customers', seg: 'customers' },
  { label: 'Vendors', seg: 'vendors' },
  { label: 'Invoices', seg: 'invoices' },
  { label: 'Bills', seg: 'bills' },
  { label: 'Payments', seg: 'payments' },
  { label: 'Banking', seg: 'banking' },
  { label: 'Assets', seg: 'fixed-assets' },
  { label: 'Recurring', seg: 'recurring' },
  { label: 'Credit Notes', seg: 'credit-notes' },
  { label: 'Debit Notes', seg: 'debit-notes' },
  { label: 'Tax Rates', seg: 'tax-rates' },
  { label: 'Reports', seg: 'reports' },
];

export function AccountingTabs({ wsId }: { wsId: string }) {
  const pathname = usePathname();
  const baseHref = `/w/${wsId}/accounting`;
  return (
    <nav className="flex flex-wrap gap-1 rounded-xl border border-white/5 bg-white/[0.02] p-1">
      {TABS.map((t) => {
        const href = t.seg ? `${baseHref}/${t.seg}` : baseHref;
        const active = t.seg ? pathname.startsWith(href) : pathname === baseHref;
        return (
          <Link
            key={t.label}
            href={href}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              active ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-200'
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function PrimaryButton({ children, onClick, type = 'button', disabled }: { children: React.ReactNode; onClick?: () => void; type?: 'button' | 'submit'; disabled?: boolean }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <PrimaryButton onClick={onClick}>
      <Plus className="h-3.5 w-3.5" /> {label}
    </PrimaryButton>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-red-500/20 bg-red-500/[0.04] p-6 text-center">
      <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-red-300" />
      <h2 className="text-sm font-semibold text-white">Something went wrong</h2>
      <p className="mt-1 text-xs text-slate-400">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500">
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      )}
    </div>
  );
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-white/5 bg-white/[0.02] p-5 ${className}`}>{children}</section>;
}

export function TableShell({ head, children }: { head: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/5">
      <table className="w-full text-left text-sm">
        <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-slate-500">{head}</thead>
        <tbody className="divide-y divide-white/5">{children}</tbody>
      </table>
    </div>
  );
}

export function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-10 text-center text-xs text-slate-500">{label}</td>
    </tr>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
      <div className="mt-12 w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0c1320] p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-white">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-400">{label}</span>
      {children}
    </label>
  );
}

const inputClass = 'w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-400/50';

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={inputClass} />;
}

export function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={inputClass} />;
}

/** Minimal list loader bound to an AccountingService list call. */
export function useList<T>(fetcher: () => Promise<ApiEnvelope<T[]>>) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetcher();
      if (!res?.success) { setError(res?.message || 'Could not load data.'); return; }
      setRows(res.data ?? []);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err.response?.data?.message || 'Network error.');
    } finally {
      setLoading(false);
    }
  }, [fetcher]);

  useEffect(() => { reload(); }, [reload]);
  return { rows, loading, error, reload, setRows };
}

/** Extract a friendly message from an axios error / DRF envelope. */
export function apiError(e: unknown, fallback = 'Request failed.'): string {
  const err = e as { response?: { data?: { message?: string; errors?: Record<string, unknown> } } };
  return err.response?.data?.message || fallback;
}

/** Print only #print-area. Injected once; used by the invoice preview page. */
export const PRINT_CSS = `@media print {
  body * { visibility: hidden !important; }
  #print-area, #print-area * { visibility: visible !important; }
  #print-area { position: absolute; inset: 0; margin: 0; padding: 24px; background: #fff; color: #111; }
  .no-print { display: none !important; }
}`;

export function usePrintStyles() {
  useEffect(() => {
    if (document.getElementById('acct-print-css')) return;
    const tag = document.createElement('style');
    tag.id = 'acct-print-css';
    tag.textContent = PRINT_CSS;
    document.head.appendChild(tag);
    return () => { document.getElementById('acct-print-css')?.remove(); };
  }, []);
}
