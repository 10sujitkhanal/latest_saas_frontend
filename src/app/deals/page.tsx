'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Sparkles, Store, Tag, AlertTriangle, ArrowRight, CalendarCheck, ShoppingCart, Search, Star, CalendarDays } from 'lucide-react';

/**
 * MoreDealsX — the cross-tenant consumer discovery feed. No auth.
 *
 * Aggregates featured published listings + active coupons from every business
 * with an open storefront, filterable by industry. Each card links to that
 * business's storefront at /store/<schema>. The demand-side growth engine.
 */

import { resolveApiV1Base } from '@/lib/apiBase';

interface Listing { id: number; title: string; price: string; currency: string; in_stock: boolean; }
interface Coupon { code: string; type: string; value: string; description: string; }
interface Membership { id: number; name: string; price: string; currency: string; interval: string; benefits?: string; }
interface EventItem { id: number; title: string; starts_at?: string | null; price: string; currency: string; free: boolean; }
interface Business {
  tenant_schema: string; tenant_name: string; industry: string;
  booking_type: string; show_cart: boolean; listing_type: string;
  listings: Listing[]; deals: Coupon[];
  memberships?: Membership[]; events?: EventItem[];
  sells_memberships?: boolean; has_events?: boolean;
}

type ContentFilter = '' | 'deals' | 'memberships' | 'events';

async function publicFetch(path: string) {
  const base = resolveApiV1Base();
  const res = await fetch(`${base}${path}`, { headers: { 'Content-Type': 'application/json' } });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, ...data } as { ok: boolean; success?: boolean; data?: unknown; message?: string };
}

function money(amount: string, currency: string) {
  const n = parseFloat(amount);
  return `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function MoreDealsXPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [activeIndustry, setActiveIndustry] = useState<string>('');
  const [content, setContent] = useState<ContentFilter>('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    publicFetch('/public/moredealsx/')
      .then((r) => {
        if (r.ok && r.success && r.data) {
          const d = r.data as { businesses: Business[]; industries: string[] };
          setBusinesses(d.businesses || []);
          setIndustries(d.industries || []);
        } else setError(r.message || 'Could not load deals.');
      })
      .catch(() => setError('Network error.'))
      .finally(() => setLoading(false));
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return businesses.filter((b) =>
      (!activeIndustry || b.industry === activeIndustry) &&
      (content === '' ||
        (content === 'deals' && b.deals.length > 0) ||
        (content === 'memberships' && (b.memberships?.length ?? 0) > 0) ||
        (content === 'events' && (b.events?.length ?? 0) > 0)) &&
      (!q || b.tenant_name.toLowerCase().includes(q)
        || b.listings.some((l) => l.title.toLowerCase().includes(q))
        || (b.memberships ?? []).some((m) => m.name.toLowerCase().includes(q))),
    );
  }, [businesses, activeIndustry, content, query]);

  const counts = useMemo(() => ({
    deals: businesses.filter((b) => b.deals.length > 0).length,
    memberships: businesses.filter((b) => (b.memberships?.length ?? 0) > 0).length,
    events: businesses.filter((b) => (b.events?.length ?? 0) > 0).length,
  }), [businesses]);

  return (
    <div className="min-h-screen bg-[#06090f] text-slate-200">
      <div className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.1),transparent_60%)]" />
      <div className="relative max-w-6xl mx-auto px-4 py-12">
        <header className="text-center mb-8">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-emerald-500/25 to-emerald-600/10 border border-emerald-400/30 flex items-center justify-center text-emerald-300 mb-4">
            <Sparkles className="w-7 h-7" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">MoreDealsX</h1>
          <p className="text-sm text-slate-400 mt-2">Discover local businesses, products, services & deals — shop or book in a tap.</p>
        </header>

        {!loading && !error && businesses.length > 0 && (
          <div className="mb-8 space-y-3">
            <div className="relative max-w-md mx-auto">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search businesses & products…"
                className="w-full rounded-full bg-[#0a1020] border border-white/[0.06] pl-9 pr-3 py-2.5 text-[13.5px] text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-400/60" />
            </div>
            {/* Content type filter */}
            <div className="flex flex-wrap justify-center gap-1.5">
              {([
                ['', 'Everything', null],
                ['deals', `Deals${counts.deals ? ` (${counts.deals})` : ''}`, <Tag key="t" className="w-3 h-3" />],
                ['memberships', `Memberships${counts.memberships ? ` (${counts.memberships})` : ''}`, <Star key="s" className="w-3 h-3" />],
                ['events', `Events${counts.events ? ` (${counts.events})` : ''}`, <CalendarDays key="c" className="w-3 h-3" />],
              ] as [ContentFilter, string, React.ReactNode][]).map(([key, label, icon]) => (
                <button key={key} onClick={() => setContent(key)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold ${content === key ? 'bg-pink-600 text-white' : 'border border-white/10 text-slate-400 hover:text-white'}`}>{icon}{label}</button>
              ))}
            </div>
            {/* Industry filter */}
            <div className="flex flex-wrap justify-center gap-1.5">
              <button onClick={() => setActiveIndustry('')}
                className={`rounded-full px-3 py-1 text-[12px] font-semibold ${!activeIndustry ? 'bg-emerald-600 text-white' : 'border border-white/10 text-slate-400 hover:text-white'}`}>All</button>
              {industries.map((i) => (
                <button key={i} onClick={() => setActiveIndustry(i)}
                  className={`rounded-full px-3 py-1 text-[12px] font-semibold ${activeIndustry === i ? 'bg-emerald-600 text-white' : 'border border-white/10 text-slate-400 hover:text-white'}`}>{i}</button>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16"><div className="w-8 h-8 rounded-full border-4 border-slate-700 border-t-emerald-500 animate-spin" /></div>
        ) : error ? (
          <div className="max-w-md mx-auto rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
            <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-red-300" />
            <p className="text-sm text-slate-400">{error}</p>
          </div>
        ) : shown.length === 0 ? (
          <p className="text-center text-slate-500 py-16 text-sm">{businesses.length === 0 ? 'No open storefronts yet. Check back soon.' : 'No businesses match your filter.'}</p>
        ) : (
          <div className="space-y-6">
            {shown.map((b) => (
              <section key={b.tenant_schema} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-emerald-300"><Store className="w-5 h-5" /></div>
                    <div>
                      <div className="font-semibold text-white">{b.tenant_name}</div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <span className="uppercase tracking-wider">{b.industry}</span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 ${b.show_cart ? 'bg-emerald-500/10 text-emerald-300' : 'bg-cyan-500/10 text-cyan-300'}`}>
                          {b.show_cart ? <><ShoppingCart className="w-3 h-3" /> shop</> : <><CalendarCheck className="w-3 h-3" /> book</>}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Link href={`/store/${b.tenant_schema}`} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-emerald-300 hover:text-emerald-200">
                    {b.show_cart ? 'Visit store' : 'Book now'} <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>

                {b.deals.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {b.deals.map((c) => (
                      <span key={c.code} className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/[0.06] px-3 py-1 text-[12px] text-emerald-200" title={c.description}>
                        <Tag className="w-3 h-3" /> <span className="font-semibold">{c.code}</span>
                        <span className="text-emerald-300/70">{c.type === 'percent' ? `${c.value}% off` : `${money(c.value, 'NPR')} off`}</span>
                      </span>
                    ))}
                  </div>
                )}

                {b.listings.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {b.listings.map((l) => (
                      <Link key={l.id} href={`/store/${b.tenant_schema}`} className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3 hover:border-emerald-400/30 transition-colors">
                        <div className="text-[13px] font-medium text-white truncate">{l.title}</div>
                        <div className="mt-1 text-emerald-300 font-bold text-sm">{money(l.price, l.currency)}{!b.show_cart && <span className="text-[10px] font-normal text-slate-500"> /unit</span>}</div>
                        {b.show_cart && !l.in_stock && <div className="text-[10px] text-slate-500 mt-0.5">Sold out</div>}
                      </Link>
                    ))}
                  </div>
                )}

                {/* Memberships — Join deep-links into the store's plans */}
                {(b.memberships?.length ?? 0) > 0 && (
                  <div className="mt-4">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-pink-300 mb-2 inline-flex items-center gap-1.5"><Star className="w-3.5 h-3.5" /> Memberships</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {b.memberships!.map((m) => (
                        <div key={m.id} className="rounded-xl border border-pink-400/20 bg-pink-500/[0.04] p-3 flex flex-col">
                          <div className="text-[13px] font-semibold text-white">{m.name}</div>
                          {m.benefits && <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{m.benefits}</div>}
                          <div className="mt-auto pt-2 flex items-center justify-between">
                            <span className="text-sm font-bold text-white">{money(m.price, m.currency)}<span className="text-[10px] font-normal text-slate-500">/{m.interval.replace('_', ' ')}</span></span>
                            <Link href={`/store/${b.tenant_schema}?join=1`} className="rounded-full bg-pink-500 hover:bg-pink-400 text-white text-[12px] font-semibold px-3 py-1.5">Join</Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Upcoming events */}
                {(b.events?.length ?? 0) > 0 && (
                  <div className="mt-4">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-cyan-300 mb-2 inline-flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" /> Events</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {b.events!.map((ev) => (
                        <Link key={ev.id} href={`/store/${b.tenant_schema}`} className="rounded-xl border border-cyan-400/20 bg-cyan-500/[0.04] p-3 hover:border-cyan-400/40 transition-colors flex flex-col">
                          <div className="text-[13px] font-semibold text-white truncate">{ev.title}</div>
                          {ev.starts_at && <div className="text-[11px] text-slate-400 mt-0.5">{new Date(ev.starts_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>}
                          <div className="mt-auto pt-2 text-sm font-bold text-white">{ev.free ? 'Free' : money(ev.price, ev.currency)}</div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
