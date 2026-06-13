"use client";

import { useState } from "react";
import { Gift, Check, Loader2, Copy } from "lucide-react";
import { buyGiftCard } from "@/lib/storefront/storefrontPublicApi";

/**
 * Public storefront gift-card purchase. Shows the business's preset amounts; a
 * shopper picks one, enters who it's for + their own contact, and buys. The
 * backend issues the code and posts the sale to the books — this component never
 * computes money, it only collects the choice and shows the issued code.
 */
export default function GiftCardBuySection({
  slug,
  currency,
  denominations,
  message,
}: {
  slug: string;
  currency: string;
  denominations: number[];
  message?: string;
}) {
  const [amount, setAmount] = useState<number | null>(denominations[0] ?? null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", recipient: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ code: string; amount: string } | null>(null);
  const [copied, setCopied] = useState(false);

  if (!denominations || denominations.length === 0) return null;

  const fmt = (n: number) => `${currency} ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!amount) { setError("Choose an amount."); return; }
    setSubmitting(true);
    setError(null);
    try {
      const res = await buyGiftCard(slug, {
        amount,
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        recipient: form.recipient.trim() || undefined,
      });
      setDone({ code: res.code, amount: res.amount });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not complete the purchase. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const copy = async () => {
    if (!done) return;
    try { await navigator.clipboard.writeText(done.code); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { /* clipboard unavailable */ }
  };

  return (
    <div className="scroll-mt-24">
      <p className="mb-1 flex items-center gap-2 font-bold text-slate-900">
        <Gift className="h-4 w-4 text-pink-600" /> Gift cards
      </p>
      <p className="mb-3 text-sm text-slate-500">{message || "Give the gift of choice — buy a gift card they can spend in-store."}</p>

      <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-4">
        {done ? (
          <div className="rounded-xl bg-emerald-50 p-4 text-emerald-800">
            <p className="flex items-center gap-1.5 font-semibold"><Check className="h-4 w-4" /> Gift card purchased!</p>
            <p className="mt-1 text-[13px] text-emerald-700/90">{fmt(Number(done.amount))} — share this code with the lucky recipient:</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-center font-mono text-sm font-bold tracking-wide text-slate-900">{done.code}</code>
              <button type="button" onClick={copy} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-700">Amount</label>
              <div className="flex flex-wrap gap-2">
                {denominations.map((d) => (
                  <button key={d} type="button" onClick={() => setAmount(d)}
                    className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${amount === d ? "border-pink-500 bg-pink-50 text-pink-700" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"}`}>
                    {fmt(d)}
                  </button>
                ))}
              </div>
            </div>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-pink-400" />
            <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Your email"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-pink-400" />
            <input value={form.recipient} onChange={(e) => setForm({ ...form, recipient: e.target.value })} placeholder="Recipient name (optional)"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-pink-400" />
            {error && <p className="text-xs text-rose-600">{error}</p>}
            <button type="submit" disabled={submitting || !amount}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-pink-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-pink-700 disabled:opacity-50">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
              {submitting ? "Processing…" : amount ? `Buy ${fmt(amount)} gift card` : "Buy gift card"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
