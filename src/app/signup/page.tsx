'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Store, ArrowRight, CheckCircle2, ShoppingCart, CalendarCheck } from 'lucide-react';
import { resolveApiV1Base } from '@/lib/apiBase';
import { AGENCY_SIGNUP_URL } from '@/lib/agencyLinks';

interface Industry { industry: string; mode: 'cart' | 'booking'; booking_type: string; membership: boolean; }
interface SignupResult { business_name: string; industry: string; subdomain: string; login_url: string; store_url: string; admin_email: string; }

async function publicFetch(path: string, init?: RequestInit) {
  const base = resolveApiV1Base();
  const res = await fetch(`${base}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, ...data } as { status: number; ok: boolean; success?: boolean; data?: unknown; message?: string };
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40);
}

export default function BusinessSignupPage() {
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [form, setForm] = useState({ business_name: '', industry: '', subdomain: '', subdomainTouched: false, admin_email: '', admin_password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SignupResult | null>(null);

  useEffect(() => {
    publicFetch('/public/industries/').then((r) => { if (r.ok && r.success && Array.isArray(r.data)) setIndustries(r.data as Industry[]); }).catch(() => {});
  }, []);

  const subdomain = useMemo(() => form.subdomainTouched ? slugify(form.subdomain) : slugify(form.business_name), [form]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.business_name.trim()) { setError('Enter your business name.'); return; }
    if (!form.industry) { setError('Pick your industry.'); return; }
    if (!form.admin_email.trim() || form.admin_password.length < 8) { setError('Enter an email and a password (8+ chars).'); return; }
    setSubmitting(true); setError(null);
    try {
      const r = await publicFetch('/public/business/signup/', {
        method: 'POST',
        body: JSON.stringify({
          business_name: form.business_name.trim(), industry: form.industry, subdomain,
          admin_email: form.admin_email.trim(), admin_password: form.admin_password,
        }),
      });
      if (r.ok && r.success && r.data) setResult(r.data as SignupResult);
      else setError(r.message || 'Could not create your business.');
    } catch { setError('Network error.'); }
    finally { setSubmitting(false); }
  };

  if (result) {
    return (
      <div className="min-h-screen bg-[#06090f] text-slate-200 flex items-center justify-center p-6">
        <div className="max-w-lg w-full rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.04] p-8 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 flex items-center justify-center mb-4"><CheckCircle2 className="w-7 h-7" /></div>
          <h1 className="text-2xl font-bold text-white">{result.business_name} is ready! 🎉</h1>
          <p className="text-sm text-slate-300 mt-1">Your <strong>{result.industry}</strong> workspace + storefront are set up on a 14-day Pro trial.</p>
          <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-left text-[13px] space-y-1.5">
            <div className="flex justify-between"><span className="text-slate-500">Login</span><span className="text-slate-200">{result.admin_email}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Your app</span><span className="text-slate-200">{result.subdomain}.localhost:3000</span></div>
          </div>
          <a href={result.login_url} className="mt-6 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold">
            Go to your dashboard <ArrowRight className="w-4 h-4" />
          </a>
          <div className="mt-3"><a href={result.store_url} className="text-[12px] text-cyan-300 hover:text-cyan-200">Preview your storefront ↗</a></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#06090f] text-slate-200">
      <div className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.1),transparent_60%)]" />
      <div className="relative mx-auto max-w-xl px-4 py-12">
        <Link href="/" className="inline-flex items-center gap-2 font-bold text-white mb-8"><span className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300"><Store className="w-4 h-4" /></span>Merkoll</Link>
        <h1 className="text-3xl font-bold text-white tracking-tight">Start your business</h1>
        <p className="text-sm text-slate-400 mt-1">Pick your industry — your storefront, modules and books configure themselves. 14-day Pro trial.</p>

        {submitting ? (
          <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-center">
            <div className="w-8 h-8 mx-auto rounded-full border-4 border-slate-700 border-t-emerald-500 animate-spin" />
            <p className="mt-4 text-sm font-semibold text-white">Building your business…</p>
            <p className="mt-1 text-[13px] text-slate-400">Creating your workspace, accounting ledger and industry storefront. This can take up to a minute — please keep this tab open.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-4">
            <Field label="Business name">
              <input value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} placeholder="e.g. Lakeside Café" className={inp} />
            </Field>
            <Field label="Industry">
              <select value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} className={inp}>
                <option value="">— Choose your industry —</option>
                {industries.map((i) => <option key={i.industry} value={i.industry}>{i.industry} ({i.mode === 'cart' ? 'online ordering' : 'bookings'})</option>)}
              </select>
            </Field>
            <Field label="Your address">
              <div className="flex items-center rounded-xl bg-[#0a1020] border border-white/[0.06] focus-within:border-emerald-400/60">
                <input value={form.subdomainTouched ? form.subdomain : subdomain} onChange={(e) => setForm({ ...form, subdomain: e.target.value, subdomainTouched: true })} placeholder="yourbiz" className="flex-1 bg-transparent px-3 py-2.5 text-sm text-white focus:outline-none" />
                <span className="px-3 text-[12px] text-slate-500">.localhost:3000</span>
              </div>
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Admin email"><input type="email" value={form.admin_email} onChange={(e) => setForm({ ...form, admin_email: e.target.value })} placeholder="you@business.com" className={inp} /></Field>
              <Field label="Password"><input type="password" value={form.admin_password} onChange={(e) => setForm({ ...form, admin_password: e.target.value })} placeholder="8+ characters" className={inp} /></Field>
            </div>
            {error && <p className="text-xs text-red-300">{error}</p>}
            <button type="submit" className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold px-6 py-3">
              Create my business <ArrowRight className="w-4 h-4" />
            </button>
            <p className="text-center text-[12px] text-slate-500">Already have an account? <a href="/auth/login" className="text-emerald-300 hover:text-emerald-200">Sign in</a> · Reselling? <a href={AGENCY_SIGNUP_URL} className="text-emerald-300 hover:text-emerald-200">Become a partner</a></p>
          </form>
        )}

        <div className="mt-8 flex items-center justify-center gap-5 text-[11px] text-slate-600">
          <span className="inline-flex items-center gap-1"><ShoppingCart className="w-3.5 h-3.5" /> Online store</span>
          <span className="inline-flex items-center gap-1"><CalendarCheck className="w-3.5 h-3.5" /> Bookings</span>
          <span className="inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Real accounting</span>
        </div>
      </div>
    </div>
  );
}

const inp = 'w-full rounded-xl bg-[#0a1020] border border-white/[0.06] px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-400/60';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-[12px] font-medium text-slate-400">{label}</span>{children}</label>;
}
