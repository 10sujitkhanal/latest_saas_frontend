'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Store, Calculator, ShoppingCart, CalendarCheck, Gift, Briefcase, Sparkles,
  ArrowRight, Building2, Search, Check, ScrollText, MapPin, Bell,
} from 'lucide-react';
import { getAuthToken } from '@/lib/storage';
import { AGENCY_SIGNUP_URL } from '@/lib/agencyLinks';

/**
 * Apex root. On the marketing apex (localhost / morefungi.com) we render the
 * landing page. On a tenant subdomain (demo.localhost, acme.morefungi.com) we
 * bounce to the app (dashboard if logged in, else login).
 */
function isApexHost(host: string): boolean {
  if (!host) return true;
  if (host === 'localhost' || host === '127.0.0.1') return true;
  if (host.endsWith('.localhost')) return false;           // <tenant>.localhost
  return host.split('.').length <= 2;                       // apex like morefungi.com
}

export default function RootPage() {
  const router = useRouter();
  const [view, setView] = useState<'loading' | 'landing'>('loading');

  useEffect(() => {
    if (isApexHost(window.location.hostname)) {
      setView('landing');
    } else {
      router.replace(getAuthToken('access') ? '/dashboard' : '/auth/login');
    }
  }, [router]);

  if (view === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#030712]">
        <div className="w-8 h-8 rounded-full border-4 border-slate-700 border-t-emerald-500 animate-spin" />
      </div>
    );
  }
  return <Landing />;
}

// Industry "modes" for the hero demo morph.
const MODES = [
  { key: 'Restaurant', line: 'Table 7 · split bill', sub: 'Recipe cost posted · stock drawn', amt: '$84.50' },
  { key: 'Retail', line: 'Order #1043 · walk-in', sub: 'Inventory −3 · invoice raised', amt: '$219.00' },
  { key: 'Hotel', line: 'Room 204 · 3 nights', sub: 'Deposit taken · guest ledger', amt: '$540.00' },
  { key: 'Salon', line: 'Booking · color + cut', sub: 'Commission tracked · upsell', amt: '$130.00' },
];

const INDUSTRY_CONFIG = [
  { icon: Store, title: 'Restaurants & Cafés', desc: 'Tables, QR codes, split bills, and recipe costing.' },
  { icon: MapPin, title: 'Hotels & Trekking', desc: 'Rooms, availability calendars, deposits, and guest ledgers.' },
  { icon: ShoppingCart, title: 'Retail & Wholesale', desc: 'Unified inventory that knows a walk-in from a net-30 B2B buyer.' },
  { icon: CalendarCheck, title: 'Salons & Wellness', desc: 'Appointments, memberships, product upsells, and commission tracking.' },
];

const FLYWHEEL = [
  { icon: Store, t: 'Public storefront', d: 'Cart, rooms, or tables' },
  { icon: ShoppingCart, t: 'Order & inventory', d: 'Draws down stock, raises the invoice' },
  { icon: Calculator, t: 'Real accounting', d: 'Double-entry journal, ready for tax' },
  { icon: Gift, t: 'Loyalty & CRM', d: 'Points, tiers & history on the contact' },
  { icon: Briefcase, t: 'B2B portal', d: 'Trade pricing, min orders, net terms' },
];

function Landing() {
  const [mode, setMode] = useState(0);
  const m = MODES[mode];
  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-200 antialiased">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[600px] bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.10),transparent_62%)]" />

      {/* Navbar */}
      <header className="relative mx-auto max-w-6xl flex items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2 font-bold text-white text-lg tracking-tight">
          <span className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-emerald-300"><Store className="w-4 h-4" /></span>
          Merkoll
        </div>
        <nav className="flex items-center gap-5 text-sm">
          <Link href="/deals" className="text-slate-300 hover:text-white transition-colors">Browse deals</Link>
          <Link href="/payroll" className="text-slate-300 hover:text-white transition-colors hidden sm:inline">Payroll &amp; HR</Link>
          <a href={AGENCY_SIGNUP_URL} className="text-slate-300 hover:text-white transition-colors hidden sm:inline">Partners</a>
          <a href="/auth/login" className="text-slate-300 hover:text-white transition-colors">Sign in</a>
          <Link href="/signup" className="rounded-lg border border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/10 font-semibold px-4 py-2 transition-colors">Start free</Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-6xl px-5 pt-14 pb-20 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/[0.07] px-3 py-1 text-[12px] text-emerald-200 mb-6">
            <Sparkles className="w-3.5 h-3.5" /> The anti-ERP
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-[3.4rem] font-bold text-white tracking-tight leading-[1.04]">
            One operating system.<br /><span className="text-emerald-400">Every vertical.</span>
          </h1>
          <p className="mt-5 max-w-xl text-slate-400 text-base sm:text-lg leading-relaxed">
            Stop gluing together accounting, bookings, and inventory. Merkoll configures itself to
            your industry — a CRM, POS, B2B portal, and double-entry ledger in one unified workspace.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/signup" className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-[#06251c] text-sm font-bold px-6 py-3 shadow-lg shadow-emerald-500/20 transition-colors">
              Start your free Pro trial <ArrowRight className="w-4 h-4" />
            </Link>
            <a href={AGENCY_SIGNUP_URL} className="inline-flex items-center gap-2 rounded-lg border border-white/15 hover:bg-white/[0.06] text-slate-200 text-sm font-semibold px-6 py-3 transition-colors">
              <Building2 className="w-4 h-4" /> Become a partner
            </a>
          </div>
          <p className="mt-3 text-[12px] text-slate-500">No card. 14 days.</p>
        </div>

        {/* Morphing dashboard mock */}
        <div className="relative">
          <div className="rounded-2xl border border-white/10 bg-[#0e1626]/80 backdrop-blur shadow-2xl shadow-black/40 overflow-hidden">
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400/70" /><span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" /><span className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
              <span className="ml-3 text-[11px] text-slate-500 font-mono">{m.key.toLowerCase()}.merkoll.com</span>
            </div>
            <div className="p-4">
              <div className="flex flex-wrap gap-1.5 mb-4">
                {MODES.map((x, i) => (
                  <button key={x.key} onClick={() => setMode(i)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${i === mode ? 'bg-emerald-500 text-[#06251c]' : 'bg-white/[0.04] text-slate-400 hover:text-white'}`}>
                    {x.key}
                  </button>
                ))}
              </div>
              <div className="rounded-xl bg-white/[0.03] border border-white/5 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">{m.line}</span>
                  <span className="font-mono text-emerald-300 font-bold">{m.amt}</span>
                </div>
                <p className="text-[12px] text-slate-500 mt-1">{m.sub}</p>
              </div>
              {/* mini double-entry */}
              <div className="mt-3 rounded-xl bg-white/[0.03] border border-white/5 p-4 font-mono text-[12px]">
                <div className="flex items-center gap-2 text-slate-500 mb-2"><ScrollText className="w-3.5 h-3.5" /> Journal · auto-posted</div>
                <div className="flex justify-between text-slate-300"><span>Dr  Cash / Receivable</span><span className="text-emerald-300">{m.amt}</span></div>
                <div className="flex justify-between text-slate-300"><span>Cr  Sales</span><span className="text-emerald-300">{m.amt}</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The Switch */}
      <section className="relative mx-auto max-w-5xl px-5 pb-20">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-6">
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">The old way</span>
            <p className="mt-3 text-slate-400 leading-relaxed">You manage a booking engine, a separate POS, a spreadsheet for staff, and an accountant for invoices — none of them talking to each other.</p>
          </div>
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.04] p-6">
            <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-300">The Merkoll way</span>
            <p className="mt-3 text-slate-300 leading-relaxed">You sell a product. We post the journal entry, update the stock, reward the customer, and log the revenue. <span className="text-emerald-300 font-semibold">Automatically.</span></p>
          </div>
        </div>
      </section>

      {/* Industry-first configuration */}
      <section className="relative mx-auto max-w-6xl px-5 pb-20">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Don’t bend your business to fit software.</h2>
          <p className="mt-2 text-slate-400">The software becomes you.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {INDUSTRY_CONFIG.map((f) => (
            <div key={f.title} className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 transition-all hover:-translate-y-0.5 hover:border-emerald-400/30 hover:bg-white/[0.04]">
              <span className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-400/20 flex items-center justify-center text-emerald-300"><f.icon className="w-5 h-5" /></span>
              <h3 className="mt-4 font-semibold text-white">{f.title}</h3>
              <p className="mt-1 text-[13px] text-slate-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-[12px] text-slate-600">…and 15 other modules — HR, payroll, expenses, e-signature, analytics.</p>
      </section>

      {/* The Flywheel */}
      <section className="relative mx-auto max-w-6xl px-5 pb-20">
        <h2 className="text-center text-2xl sm:text-3xl font-bold text-white tracking-tight mb-10">How the modules fit</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {FLYWHEEL.map((s, i) => (
            <div key={s.t} className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 transition-all hover:-translate-y-0.5 hover:border-emerald-400/30">
              <div className="flex items-center justify-between">
                <span className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-400/20 flex items-center justify-center text-emerald-300"><s.icon className="w-4 h-4" /></span>
                <span className="font-mono text-[12px] text-slate-600">0{i + 1}</span>
              </div>
              <h3 className="mt-3 font-semibold text-white text-sm">{s.t}</h3>
              <p className="mt-1 text-[12px] text-slate-500 leading-relaxed">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Trust bar */}
      <section className="relative mx-auto max-w-4xl px-5 pb-20 text-center">
        <p className="text-slate-400">Trusted by <span className="font-mono text-emerald-300 font-bold">10,000+</span> businesses moving beyond “good enough” software.</p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-6 opacity-50 text-slate-500 font-semibold tracking-tight">
          <span>NORTHWIND</span><span>ALPINE CO</span><span>CRUST &amp; CRUMB</span><span>SALT BREWING</span><span>VITAL SPA</span>
        </div>
      </section>

      {/* MoreDealsX network effect */}
      <section className="relative mx-auto max-w-6xl px-5 pb-20">
        <div className="rounded-3xl border border-white/[0.08] bg-gradient-to-br from-emerald-500/[0.06] to-transparent p-8 grid lg:grid-cols-2 gap-8 items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/[0.08] px-3 py-1 text-[12px] text-emerald-200 mb-4"><Search className="w-3.5 h-3.5" /> MoreDealsX</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Get discovered. Not just managed.</h2>
            <p className="mt-3 text-slate-400 leading-relaxed">
              Every Merkoll storefront is automatically searchable on the MoreDealsX consumer app —
              filtered by location and industry. A trekker looking for a guide, a couple searching
              “Japanese restaurant open now” — they find you.
            </p>
            <p className="mt-3 text-emerald-300 font-semibold">You pay 0% commission on discovery sales.</p>
            <Link href="/deals" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-white hover:text-emerald-300 transition-colors">Browse MoreDealsX <ArrowRight className="w-4 h-4" /></Link>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#0e1626]/80 p-4">
            <div className="flex items-center gap-2 text-[12px] text-slate-400 mb-3"><MapPin className="w-3.5 h-3.5 text-emerald-300" /> Brewery · Pet-friendly · Open now</div>
            <div className="space-y-2">
              {['Salt Brewing Co — 0.4 km', 'Crust & Crumb — 0.9 km'].map((x) => (
                <div key={x} className="rounded-lg bg-white/[0.03] border border-white/5 px-3 py-2 text-sm text-slate-300 flex items-center justify-between">{x}<span className="text-emerald-300 text-[11px]">View →</span></div>
              ))}
            </div>
            <div className="mt-3 rounded-lg bg-emerald-500/10 border border-emerald-400/20 px-3 py-2 text-[12px] text-emerald-200 flex items-center gap-2">
              <Bell className="w-3.5 h-3.5" /> New lead from MoreDealsX — Table for 4 at 7pm · auto-booked
            </div>
          </div>
        </div>
      </section>

      {/* 3-step launch */}
      <section className="relative mx-auto max-w-4xl px-5 pb-24">
        <h2 className="text-center text-2xl sm:text-3xl font-bold text-white tracking-tight mb-10">Live in three steps</h2>
        <div className="rounded-2xl border border-white/[0.08] bg-[#0e1626]/60 p-6 font-mono text-sm">
          {[
            { n: '01', t: 'Select your trade', d: 'Restaurant, Hotel, Salon, Retail…' },
            { n: '02', t: 'Import your list', d: 'Menu, rooms, or SKUs' },
            { n: '03', t: 'Go live', d: 'Payments sync to your books instantly' },
          ].map((s) => (
            <div key={s.n} className="flex items-center gap-4 py-3 border-b border-white/5 last:border-0">
              <span className="text-emerald-300">{s.n}</span>
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-white font-semibold font-sans">{s.t}</span>
              <span className="text-slate-500 ml-auto text-right hidden sm:block">{s.d}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative mx-auto max-w-4xl px-5 pb-24 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">Stop managing chaos.<br className="hidden sm:block" /> Start running your business.</h2>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/signup" className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-[#06251c] text-sm font-bold px-6 py-3 shadow-lg shadow-emerald-500/20 transition-colors">
            Start your free Pro trial <ArrowRight className="w-4 h-4" />
          </Link>
          <a href={AGENCY_SIGNUP_URL} className="inline-flex items-center gap-2 rounded-lg border border-white/15 hover:bg-white/[0.06] text-slate-200 text-sm font-semibold px-6 py-3 transition-colors">
            <Building2 className="w-4 h-4" /> Become a partner
          </a>
        </div>
        <p className="mt-3 text-[12px] text-slate-500">No card. 14 days.</p>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-white/[0.06] py-8">
        <div className="mx-auto max-w-6xl px-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-[12px] text-slate-500">
          <div className="flex items-center gap-2 font-bold text-slate-300"><Store className="w-4 h-4 text-emerald-300" /> Merkoll</div>
          <div className="flex items-center gap-5">
            <Link href="/signup" className="hover:text-slate-200">Start a business</Link>
            <Link href="/deals" className="hover:text-slate-200">MoreDealsX</Link>
            <a href={AGENCY_SIGNUP_URL} className="hover:text-slate-200">Partners</a>
            <a href="/auth/login" className="hover:text-slate-200">Sign in</a>
          </div>
          <span>© {new Date().getFullYear()} Merkoll</span>
        </div>
      </footer>
    </div>
  );
}
