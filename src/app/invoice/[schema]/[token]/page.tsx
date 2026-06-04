'use client';

import { useCallback, useEffect, useState, use as reactUse } from 'react';
import { Receipt, Download, CheckCircle2, Clock } from 'lucide-react';
import { resolveApiV1Base } from '@/lib/apiBase';

interface PublicLine { description: string; quantity: string; unit_price: string; total: string }
interface PublicInvoice {
  invoice_no: string; customer_name: string; status: string; currency: string;
  issue_date: string; due_date: string;
  subtotal: string; discount_total: string; tax_total: string; total: string; amount_paid: string; amount_due: string;
  terms?: string; notes?: string; lines: PublicLine[];
  business_name: string; is_paid: boolean;
}

async function publicFetch(path: string) {
  const base = resolveApiV1Base();
  const res = await fetch(`${base}${path}`, { headers: { 'Content-Type': 'application/json' } });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, ...data } as { ok: boolean; success?: boolean; data?: PublicInvoice; message?: string };
}

function fmt(amount: string | number, currency: string) {
  return `${currency} ${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PublicInvoicePage({ params }: { params: Promise<{ schema: string; token: string }> }) {
  const { schema, token } = reactUse(params);
  const [inv, setInv] = useState<PublicInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await publicFetch(`/public/invoices/${schema}/${token}/`);
      if (r.ok && r.success && r.data) setInv(r.data);
      else setError(r.message || 'This invoice link is invalid or has expired.');
    } catch { setError('Could not load this invoice. Please check your connection.'); }
    finally { setLoading(false); }
  }, [schema, token]);
  useEffect(() => { load(); }, [load]);

  const pdfUrl = `${resolveApiV1Base()}/public/invoices/${schema}/${token}/pdf/`;

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#06090f]"><div className="w-8 h-8 rounded-full border-4 border-slate-700 border-t-emerald-500 animate-spin" /></div>;
  }
  if (error || !inv) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#06090f] p-4">
        <div className="max-w-md w-full rounded-2xl bg-slate-900/80 border border-white/10 p-8 text-center">
          <Clock className="w-10 h-10 mx-auto text-amber-300" />
          <h1 className="mt-3 text-xl font-bold text-white">Invoice unavailable</h1>
          <p className="text-sm text-slate-400 mt-2">{error || 'This invoice link is invalid or has expired.'}</p>
        </div>
      </div>
    );
  }

  const due = Number(inv.amount_due);
  return (
    <div className="min-h-screen bg-[#06090f] text-slate-200">
      <div className="absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.10),transparent_60%)]" />
      <div className="relative mx-auto max-w-2xl px-4 py-10">
        <div className="flex items-center gap-2 text-sm font-bold text-white mb-6">
          <span className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-emerald-300"><Receipt className="w-4 h-4" /></span>
          {inv.business_name}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Invoice {inv.invoice_no}</h1>
              <p className="text-sm text-slate-400 mt-0.5">Billed to {inv.customer_name}</p>
            </div>
            {inv.is_paid
              ? <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[12px] text-emerald-300"><CheckCircle2 className="w-3.5 h-3.5" /> Paid</span>
              : <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[12px] capitalize text-slate-300">{inv.status}</span>}
          </div>

          <div className="mt-5 rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.03] text-[11px] uppercase tracking-wide text-slate-500">
                <tr><th className="px-3 py-2">Item</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Price</th><th className="px-3 py-2 text-right">Amount</th></tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {inv.lines.map((l, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 text-slate-200">{l.description}</td>
                    <td className="px-3 py-2 text-right text-slate-400">{Number(l.quantity)}</td>
                    <td className="px-3 py-2 text-right text-slate-400">{fmt(l.unit_price, inv.currency)}</td>
                    <td className="px-3 py-2 text-right text-slate-200">{fmt(l.total, inv.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 ml-auto w-full max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-400"><span>Subtotal</span><span>{fmt(inv.subtotal, inv.currency)}</span></div>
            {Number(inv.tax_total) > 0 && <div className="flex justify-between text-slate-400"><span>Tax</span><span>{fmt(inv.tax_total, inv.currency)}</span></div>}
            {Number(inv.amount_paid) > 0 && <div className="flex justify-between text-slate-400"><span>Paid</span><span>−{fmt(inv.amount_paid, inv.currency)}</span></div>}
            <div className="flex justify-between border-t border-white/10 pt-1.5 text-base font-semibold text-white"><span>Amount due</span><span className={due > 0 ? 'text-emerald-300' : ''}>{fmt(inv.amount_due, inv.currency)}</span></div>
          </div>

          <p className="mt-4 text-[12px] text-slate-500">Issued {inv.issue_date} · Due {inv.due_date}</p>
          {inv.terms && <p className="mt-3 text-[12px] text-slate-400"><span className="text-slate-500">Terms: </span>{inv.terms}</p>}
          {inv.notes && <p className="mt-1 text-[12px] text-slate-400">{inv.notes}</p>}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <a href={pdfUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold px-6 py-3">
            <Download className="w-4 h-4" /> Download PDF
          </a>
          {!inv.is_paid && due > 0 && <span className="text-[13px] text-slate-400">To settle this invoice, please contact {inv.business_name} using the details on your invoice.</span>}
        </div>

        <p className="mt-8 text-center text-[11px] text-slate-600">Powered by Merkoll</p>
      </div>
    </div>
  );
}
