'use client';

import { useCallback, useEffect, useState, use as reactUse } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Printer, Send, Ban } from 'lucide-react';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { AccountingService, type InvoiceDetail, type OrgBranding } from '@/services/accounting.service';
import { ErrorBox, Pill, money, apiError, usePrintStyles } from '@/components/accounting/kit';

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string; invId: string }> }) {
  const { id: wsId, invId } = reactUse(params);
  return (
    <PermissionGuard service="accounting" required="accounting.view" workspaceId={wsId} skeleton="detail">
      <Inner wsId={wsId} invId={invId} />
    </PermissionGuard>
  );
}

function Inner({ wsId, invId }: { wsId: string; invId: string }) {
  usePrintStyles();
  const router = useRouter();
  const [inv, setInv] = useState<InvoiceDetail | null>(null);
  const [brand, setBrand] = useState<OrgBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [invRes, brandRes] = await Promise.all([
        AccountingService.invoices.get(wsId, invId),
        AccountingService.branding(wsId),
      ]);
      if (!invRes.success) { setError(invRes.message || 'Could not load invoice.'); return; }
      setInv(invRes.data);
      if (brandRes.success) setBrand(brandRes.data);
    } catch (e) { setError(apiError(e, 'Network error.')); }
    finally { setLoading(false); }
  }, [wsId, invId]);

  useEffect(() => { load(); }, [load]);

  const send = async () => {
    if (!inv) return;
    setBusy(true);
    try {
      const res = await AccountingService.sendInvoice(wsId, inv.id);
      alert(res.message || (res.success ? 'Invoice sent.' : 'Send failed.'));
      load();
    } catch (e) { alert(apiError(e, 'Send failed.')); }
    finally { setBusy(false); }
  };

  const voidInvoice = async () => {
    if (!inv || !confirm(`Void invoice ${inv.invoice_no}?`)) return;
    setBusy(true);
    try {
      const res = await AccountingService.voidInvoice(wsId, inv.id);
      if (!res.success) alert(res.message || 'Void failed.');
      load();
    } catch (e) { alert(apiError(e, 'Void failed.')); }
    finally { setBusy(false); }
  };

  if (loading) return <PageSkeleton kind="detail" />;
  if (error || !inv) return <ErrorBox message={error || 'Invoice not found.'} onRetry={load} />;

  const accent = brand?.brand_color || '#1E6BFE';
  const canSend = ['draft', 'sent', 'partial', 'overdue'].includes(inv.status);
  const canVoid = !['paid', 'void', 'cancelled'].includes(inv.status);

  return (
    <div className="space-y-4">
      {/* Toolbar (hidden on print) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <button onClick={() => router.push(`/w/${wsId}/accounting/invoices`)} className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back to invoices
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/[0.08]"><Printer className="h-3.5 w-3.5" /> Print / PDF</button>
          {canVoid && <button disabled={busy} onClick={voidInvoice} className="inline-flex items-center gap-2 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-200 hover:bg-red-500/20 disabled:opacity-50"><Ban className="h-3.5 w-3.5" /> Void</button>}
          {canSend && <button disabled={busy} onClick={send} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"><Send className="h-3.5 w-3.5" /> {busy ? 'Sending…' : 'Send to customer'}</button>}
        </div>
      </div>

      {/* Printable invoice document */}
      <div id="print-area" className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-white text-slate-800">
        <div className="flex items-start justify-between gap-4 px-8 py-6" style={{ borderTop: `4px solid ${accent}` }}>
          <div>
            {brand?.logo_url
              ? <img src={brand.logo_url} alt={brand.name} className="max-h-14" />
              : <h2 className="text-xl font-bold" style={{ color: accent }}>{brand?.name || 'Your Company'}</h2>}
            {brand?.address && <p className="mt-2 max-w-xs whitespace-pre-line text-xs text-slate-500">{brand.address}</p>}
            {brand?.contact_email && <p className="text-xs text-slate-500">{brand.contact_email}</p>}
          </div>
          <div className="text-right">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">INVOICE</h1>
            <p className="font-mono text-sm text-slate-600">{inv.invoice_no}</p>
            <span className="mt-1 inline-block"><Pill>{inv.status}</Pill></span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 px-8 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Bill to</p>
            <p className="font-semibold text-slate-800">{inv.customer_name}</p>
          </div>
          <div className="text-right text-sm">
            <p><span className="text-slate-400">Issued: </span>{inv.issue_date}</p>
            <p><span className="text-slate-400">Due: </span>{inv.due_date}</p>
          </div>
        </div>

        <div className="px-8 pb-2">
          <table className="w-full text-left text-sm">
            <thead><tr className="text-white" style={{ background: accent }}>
              <th className="px-3 py-2">Description</th><th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-right">Unit Price</th><th className="px-3 py-2 text-right">Total</th>
            </tr></thead>
            <tbody>
              {inv.lines.map((l, i) => (
                <tr key={l.id ?? i} className="border-b border-slate-100">
                  <td className="px-3 py-2">{l.description}</td>
                  <td className="px-3 py-2 text-right">{l.quantity}</td>
                  <td className="px-3 py-2 text-right">{money(l.unit_price, inv.currency)}</td>
                  <td className="px-3 py-2 text-right">{money(l.total ?? 0, inv.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end px-8 py-4">
          <div className="w-64 space-y-1 text-sm">
            <Row label="Subtotal" value={money(inv.subtotal, inv.currency)} />
            <Row label="Discount" value={money(inv.discount_total, inv.currency)} />
            <Row label="Tax" value={money(inv.tax_total, inv.currency)} />
            <div className="my-1 border-t border-slate-200" />
            <Row label="Total" value={money(inv.total, inv.currency)} bold />
            <Row label="Paid" value={money(inv.amount_paid, inv.currency)} />
            <Row label="Amount due" value={money(inv.amount_due, inv.currency)} bold accent={accent} />
          </div>
        </div>

        {inv.notes && <div className="px-8 pb-6 text-xs text-slate-500"><span className="font-semibold">Notes: </span>{inv.notes}</div>}
        <div className="px-8 pb-6 text-center text-[11px] text-slate-400">Thank you for your business.</div>
      </div>
    </div>
  );
}

function Row({ label, value, bold, accent }: { label: string; value: string; bold?: boolean; accent?: string }) {
  return (
    <div className="flex justify-between">
      <span className={bold ? 'font-semibold text-slate-700' : 'text-slate-500'}>{label}</span>
      <span className={bold ? 'font-bold' : 'text-slate-700'} style={accent ? { color: accent } : undefined}>{value}</span>
    </div>
  );
}
