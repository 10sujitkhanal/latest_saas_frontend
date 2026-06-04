'use client';

import { useCallback, useEffect, useState, use as reactUse } from 'react';
import { CheckCircle2, XCircle, FileSignature, Clock } from 'lucide-react';
import { resolveApiV1Base } from '@/lib/apiBase';

interface PublicLine {
  description: string;
  quantity: string;
  unit_price: string;
  discount_amount: string;
  tax_amount: string;
  total: string;
}
interface PublicQuote {
  quote_no: string;
  customer_name: string;
  status: string;
  currency: string;
  issue_date: string;
  valid_until?: string | null;
  subtotal: string;
  discount_total: string;
  tax_total: string;
  total: string;
  system_description?: string;
  terms?: string;
  notes?: string;
  lines: PublicLine[];
  business_name: string;
  can_act: boolean;
}

async function publicFetch(path: string, init?: RequestInit) {
  const base = resolveApiV1Base();
  const res = await fetch(`${base}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, ...data } as { status: number; ok: boolean; success?: boolean; data?: PublicQuote; message?: string };
}

function fmt(amount: string | number, currency: string) {
  const n = Number(amount || 0);
  return `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PublicQuotePage({ params }: { params: Promise<{ schema: string; token: string }> }) {
  const { schema, token } = reactUse(params);
  const [quote, setQuote] = useState<PublicQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [done, setDone] = useState<{ kind: 'accepted' | 'rejected'; message: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await publicFetch(`/public/quotes/${schema}/${token}/`);
      if (r.ok && r.success && r.data) setQuote(r.data);
      else setError(r.message || 'This quote link is invalid or has expired.');
    } catch { setError('Could not load this quote. Please check your connection.'); }
    finally { setLoading(false); }
  }, [schema, token]);

  useEffect(() => { load(); }, [load]);

  const act = async (kind: 'accept' | 'decline') => {
    setActing(true);
    try {
      const r = await publicFetch(`/public/quotes/${schema}/${token}/${kind}/`, { method: 'POST', body: '{}' });
      if (r.ok && r.success) setDone({ kind: kind === 'accept' ? 'accepted' : 'rejected', message: r.message || 'Recorded.' });
      else { alert(r.message || 'Could not record your response.'); load(); }
    } catch { alert('Network error — please try again.'); }
    finally { setActing(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#06090f]">
        <div className="w-8 h-8 rounded-full border-4 border-slate-700 border-t-emerald-500 animate-spin" />
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#06090f] p-4">
        <div className="max-w-md w-full rounded-2xl bg-slate-900/80 border border-white/10 p-8 text-center">
          <Clock className="w-10 h-10 mx-auto text-amber-300" />
          <h1 className="mt-3 text-xl font-bold text-white">Quote unavailable</h1>
          <p className="text-sm text-slate-400 mt-2">{error || 'This quote link is invalid or has expired.'}</p>
        </div>
      </div>
    );
  }

  const decided = done || ['accepted', 'rejected', 'converted', 'expired', 'cancelled'].includes(quote.status);

  return (
    <div className="min-h-screen bg-[#06090f] text-slate-200">
      <div className="absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_top,rgba(245,158,11,0.10),transparent_60%)]" />
      <div className="relative mx-auto max-w-2xl px-4 py-10">
        <div className="flex items-center gap-2 text-sm font-bold text-white mb-6">
          <span className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-amber-300"><FileSignature className="w-4 h-4" /></span>
          {quote.business_name}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Quote {quote.quote_no}</h1>
              <p className="text-sm text-slate-400 mt-0.5">Prepared for {quote.customer_name}</p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[12px] capitalize text-slate-300">{quote.status}</span>
          </div>

          {quote.system_description && <p className="mt-4 text-sm text-slate-300">{quote.system_description}</p>}

          <div className="mt-5 rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.03] text-[11px] uppercase tracking-wide text-slate-500">
                <tr><th className="px-3 py-2">Item</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Price</th><th className="px-3 py-2 text-right">Amount</th></tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {quote.lines.map((l, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 text-slate-200">{l.description}</td>
                    <td className="px-3 py-2 text-right text-slate-400">{Number(l.quantity)}</td>
                    <td className="px-3 py-2 text-right text-slate-400">{fmt(l.unit_price, quote.currency)}</td>
                    <td className="px-3 py-2 text-right text-slate-200">{fmt(l.total, quote.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 ml-auto w-full max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-400"><span>Subtotal</span><span>{fmt(quote.subtotal, quote.currency)}</span></div>
            {Number(quote.discount_total) > 0 && <div className="flex justify-between text-slate-400"><span>Discount</span><span>−{fmt(quote.discount_total, quote.currency)}</span></div>}
            {Number(quote.tax_total) > 0 && <div className="flex justify-between text-slate-400"><span>Tax</span><span>{fmt(quote.tax_total, quote.currency)}</span></div>}
            <div className="flex justify-between border-t border-white/10 pt-1.5 text-base font-semibold text-white"><span>Total</span><span>{fmt(quote.total, quote.currency)}</span></div>
          </div>

          {quote.valid_until && <p className="mt-4 text-[12px] text-slate-500">Valid until {quote.valid_until}</p>}
          {quote.terms && <p className="mt-3 text-[12px] text-slate-400"><span className="text-slate-500">Terms: </span>{quote.terms}</p>}
          {quote.notes && <p className="mt-1 text-[12px] text-slate-400">{quote.notes}</p>}
        </div>

        {done ? (
          <div className={`mt-6 rounded-2xl border p-6 text-center ${done.kind === 'accepted' ? 'border-emerald-500/30 bg-emerald-500/[0.04]' : 'border-slate-600/30 bg-white/[0.02]'}`}>
            {done.kind === 'accepted' ? <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-300" /> : <XCircle className="w-10 h-10 mx-auto text-slate-400" />}
            <p className="mt-2 text-sm text-slate-200">{done.message}</p>
          </div>
        ) : quote.can_act && !decided ? (
          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={() => act('accept')} disabled={acting} className="flex-1 min-w-[160px] inline-flex items-center justify-center gap-2 rounded-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white text-sm font-semibold px-6 py-3">
              <CheckCircle2 className="w-4 h-4" /> Accept quote
            </button>
            <button onClick={() => act('decline')} disabled={acting} className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 hover:bg-white/[0.06] disabled:opacity-50 text-slate-200 text-sm font-semibold px-6 py-3">
              <XCircle className="w-4 h-4" /> Decline
            </button>
          </div>
        ) : (
          <p className="mt-6 text-center text-[13px] text-slate-500">This quote is {quote.status} and is no longer awaiting a response.</p>
        )}

        <p className="mt-8 text-center text-[11px] text-slate-600">Powered by Merkoll</p>
      </div>
    </div>
  );
}
