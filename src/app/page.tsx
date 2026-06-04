'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Store, Calculator, Users, CalendarCheck, Gift, Sparkles, ShoppingCart,
  ArrowRight, Building2, Briefcase, BarChart3,
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

const INDUSTRIES = ['Restaurant', 'Hotel', 'Salon / Spa', 'Wellness / Supplements', 'Retail', 'Wholesale', 'Events', 'Café', 'Brewery', 'Trekking'];

const FEATURES = [
  { icon: Store, title: 'Industry storefront', desc: 'A public store tuned to your trade — cart, bookings, rooms, tables or tickets.' },
  { icon: Calculator, title: 'Real accounting', desc: 'Every sale posts a balanced double-entry journal. Invoices, payments, reports — automatic.' },
  { icon: ShoppingCart, title: 'Orders & inventory', desc: 'Online orders draw down stock, raise invoices, take payment — one flow.' },
  { icon: CalendarCheck, title: 'Bookings & tables', desc: 'Appointments, room nights, table reservations and ticketed events.' },
  { icon: Gift, title: 'Loyalty & memberships', desc: 'Points, tiers, gift cards and membership plans, sold on your store.' },
  { icon: Briefcase, title: 'B2B / wholesale', desc: 'Trade accounts with their own pricing and net terms — on the same store.' },
  { icon: Users, title: 'CRM, HR & staff', desc: 'Leads, inbox, employees, attendance and payroll in one workspace.' },
  { icon: BarChart3, title: 'MoreDealsX reach', desc: 'Get discovered on the consumer marketplace, filtered by industry.' },
];

function Landing() {
  return (
    <div className="min-h-screen bg-[#06090f] text-slate-200">
      <div className="absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.12),transparent_60%)]" />

      <header className="relative mx-auto max-w-6xl flex items-center justify-between px-4 py-5">
        <div className="flex items-center gap-2 font-bold text-white text-lg">
          <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500/30 to-emerald-600/10 border border-emerald-400/30 flex items-center justify-center text-emerald-300"><Store className="w-4 h-4" /></span>
          Merkoll
        </div>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/deals" className="text-slate-300 hover:text-white">Browse deals</Link>
          <a href={AGENCY_SIGNUP_URL} className="text-slate-300 hover:text-white hidden sm:inline">Partners</a>
          <a href="/auth/login" className="text-slate-300 hover:text-white">Sign in</a>
          <Link href="/signup" className="rounded-full bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-4 py-2">Start free</Link>
        </nav>
      </header>

      <section className="relative mx-auto max-w-6xl px-4 pt-16 pb-20 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/[0.08] px-3 py-1 text-[12px] text-emerald-200 mb-6">
          <Sparkles className="w-3.5 h-3.5" /> One platform · every industry
        </span>
        <h1 className="text-4xl sm:text-6xl font-bold text-white tracking-tight leading-[1.05]">
          Run your business <span className="text-emerald-400">and</span> sell online —<br className="hidden sm:block" /> built for your industry.
        </h1>
        <p className="mt-5 max-w-2xl mx-auto text-slate-400 text-base sm:text-lg">
          CRM, accounting, inventory, a public storefront, bookings, loyalty and B2B —
          one workspace that configures itself to how <em>your</em> trade actually works.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/signup" className="inline-flex items-center gap-2 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold px-6 py-3">
            Start your business free <ArrowRight className="w-4 h-4" />
          </Link>
          <a href={AGENCY_SIGNUP_URL} className="inline-flex items-center gap-2 rounded-full border border-white/15 hover:bg-white/[0.06] text-slate-200 text-sm font-semibold px-6 py-3">
            <Building2 className="w-4 h-4" /> Become a partner
          </a>
        </div>
        <p className="mt-3 text-[12px] text-slate-500">14-day Pro trial · no card required</p>

        <div className="mt-10 flex flex-wrap justify-center gap-1.5">
          {INDUSTRIES.map((i) => (
            <span key={i} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[12px] text-slate-400">{i}</span>
          ))}
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl px-4 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <f.icon className="w-6 h-6 text-emerald-300" />
              <h3 className="mt-3 font-semibold text-white">{f.title}</h3>
              <p className="mt-1 text-[13px] text-slate-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative mx-auto max-w-4xl px-4 pb-24">
        <h2 className="text-center text-2xl font-bold text-white mb-10">Live in three steps</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { n: '1', t: 'Pick your industry', d: 'Your storefront, modules and accounting auto-configure to your trade.' },
            { n: '2', t: 'Add products or services', d: 'Publish listings, rooms, services, menu or events in minutes.' },
            { n: '3', t: 'Open your store', d: 'Take orders, bookings and payments — all posted to your books.' },
          ].map((s) => (
            <div key={s.n} className="text-center">
              <div className="mx-auto w-10 h-10 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 flex items-center justify-center font-bold">{s.n}</div>
              <h3 className="mt-3 font-semibold text-white">{s.t}</h3>
              <p className="mt-1 text-[13px] text-slate-400">{s.d}</p>
            </div>
          ))}
        </div>
        <div className="mt-12 text-center">
          <Link href="/signup" className="inline-flex items-center gap-2 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold px-6 py-3">
            Get started <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <footer className="relative border-t border-white/[0.06] py-8 text-center text-[12px] text-slate-600">
        <div className="flex items-center justify-center gap-4 mb-2">
          <Link href="/signup" className="hover:text-slate-300">Start a business</Link>
          <a href={AGENCY_SIGNUP_URL} className="hover:text-slate-300">Partners</a>
          <Link href="/deals" className="hover:text-slate-300">MoreDealsX</Link>
          <a href="/auth/login" className="hover:text-slate-300">Sign in</a>
        </div>
        © {new Date().getFullYear()} Merkoll — the business operating system.
      </footer>
    </div>
  );
}
