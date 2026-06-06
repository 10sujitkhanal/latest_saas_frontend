'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Store, Calculator, ShoppingCart, CalendarCheck, Gift, Briefcase, Sparkles,
  ArrowRight, Building2, Check, ScrollText, MapPin, Menu, X,
  Plus, Minus, ShieldCheck, Zap, Globe, Star, Inbox, Workflow, MessageSquare,
  TrendingUp, BrainCircuit,
} from 'lucide-react';
import { getAuthToken } from '@/lib/storage';
import { AGENCY_SIGNUP_URL } from '@/lib/agencyLinks';
import { SITE_NAME, FAQ, RESOURCE_LINKS, SOCIAL_LINKS } from '@/lib/seo';

/* ───────────────────────── host routing ───────────────────────── */
function isApexHost(host: string): boolean {
  if (!host) return true;
  if (host === 'localhost' || host === '127.0.0.1') return true;
  if (host.endsWith('.localhost')) return false;     // <tenant>.localhost
  return host.split('.').length <= 2;                 // apex like morefungi.com
}

/* ───────────────────────── scroll reveal ──────────────────────── */
function Reveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) { setShown(true); return; }
    if (!('IntersectionObserver' in window) || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setShown(true); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    io.observe(el);
    // Safety net: never leave content hidden if the observer doesn't fire
    // (odd browsers, restored scroll position, headless capture, etc.).
    const fallback = window.setTimeout(() => setShown(true), 1500);
    return () => { io.disconnect(); window.clearTimeout(fallback); };
  }, []);
  return (
    <div ref={ref} style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-out ${shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'} ${className}`}>
      {children}
    </div>
  );
}

/* ───────────────────────── content ────────────────────────────── */
// The AI sales engine — the lead message.
const AI_ENGINE = [
  { icon: Inbox, t: 'Capture every lead', d: 'Web forms, your storefront, WhatsApp, email and calls — all into one inbox, auto-deduped.' },
  { icon: Sparkles, t: 'AI lead scoring', d: 'Every lead ranked on intent & fit, so your team works the hottest first.' },
  { icon: Workflow, t: 'Automated follow-up', d: 'No-code workflows chase, remind and nurture 24/7 — nobody slips through the cracks.' },
  { icon: MessageSquare, t: 'AI replies & nurture', d: 'On-brand responses drafted in seconds, so a lead never waits for an answer.' },
  { icon: CalendarCheck, t: 'Auto-book & convert', d: 'Hot leads book themselves; won deals turn into orders & invoices automatically.' },
  { icon: TrendingUp, t: 'Pipeline & forecast', d: 'Kanban pipeline, quotas and AI forecasts — see revenue before it lands.' },
];

// The "runs the business after the sale" layer.
const FLYWHEEL = [
  { icon: Store, t: 'Public storefront', d: 'Cart, rooms, or tables' },
  { icon: ShoppingCart, t: 'Order & inventory', d: 'Draws down stock, raises the invoice' },
  { icon: Calculator, t: 'Real accounting', d: 'Double-entry journal, ready for tax' },
  { icon: Gift, t: 'Loyalty & CRM', d: 'Points, tiers & history on the contact' },
  { icon: Briefcase, t: 'B2B portal', d: 'Trade pricing, min orders, net terms' },
];

const WHY = [
  { icon: Zap, t: 'One source of truth', d: 'Leads, sales, stock, customers and books live in one place — no exports, no midnight reconciliation.' },
  { icon: ShieldCheck, t: 'Tax-ready by default', d: 'Every won deal posts a real double-entry journal automatically, so your accountant smiles.' },
  { icon: Globe, t: 'Scales from 1 to 100 outlets', d: 'Multi-currency, multi-business, role-based access — run one shop or a whole group, across Europe & Asia.' },
];

// Industry presets (the morphing demo, now proof — not the lead).
const MODES = [
  { key: 'Restaurant', line: 'Table 7 · split bill', sub: 'Recipe cost posted · stock drawn', amt: '€84.50' },
  { key: 'Retail', line: 'Order #1043 · walk-in', sub: 'Inventory −3 · invoice raised', amt: '€219.00' },
  { key: 'Hotel', line: 'Room 204 · 3 nights', sub: 'Deposit taken · guest ledger', amt: '€540.00' },
  { key: 'Salon', line: 'Booking · color + cut', sub: 'Commission tracked · upsell', amt: '€130.00' },
];

const INDUSTRY_CONFIG = [
  { icon: Store, title: 'Restaurants & Cafés', desc: 'Tables, QR ordering, split bills, and live recipe costing.' },
  { icon: MapPin, title: 'Hotels & Trekking', desc: 'Rooms, availability calendars, deposits, and guest ledgers.' },
  { icon: ShoppingCart, title: 'Retail & Wholesale', desc: 'Unified inventory that knows a walk-in from a net-30 B2B buyer.' },
  { icon: CalendarCheck, title: 'Salons & Wellness', desc: 'Appointments, memberships, upsells, and commission tracking.' },
];

const STATS = [
  { v: '3×', l: 'faster lead response with AI follow-up' },
  { v: '24/7', l: 'the AI never stops chasing leads' },
  { v: '100%', l: 'of leads captured, scored & followed up' },
  { v: '14 days', l: 'free Pro trial, no card' },
];

const TESTIMONIALS = [
  { quote: 'The AI follows up the second a lead comes in. We close deals we used to forget existed — and every won deal lands straight in the books.', name: 'Aria Lindqvist', role: 'Owner · Salt Brewing Co' },
  { quote: 'Leads from WhatsApp, the website and walk-ins all land in one place, scored. My team finally works the right ones first.', name: 'Marco Bianchi', role: 'GM · Alpine Lodge' },
  { quote: 'Setup took an afternoon. Within a week the AI had booked appointments we’d have lost — and the rest of the business runs itself.', name: 'Priya Sharma', role: 'Founder · Crust & Crumb' },
];

const STEPS = [
  { n: '01', t: 'Connect your lead sources', d: 'Website, storefront, WhatsApp, email & calls' },
  { n: '02', t: 'Let the AI qualify & follow up', d: 'Scores, nurtures and books automatically' },
  { n: '03', t: 'Win & run the business', d: 'Deals become orders, invoices & bookkeeping' },
];

// Hero AI pipeline preview rows.
const PIPELINE = [
  { icon: Inbox, label: 'New lead · website form', meta: 'just now', tone: 'slate' },
  { icon: Sparkles, label: 'AI score: 92 · high intent', meta: 'auto', tone: 'emerald' },
  { icon: MessageSquare, label: 'Follow-up sent · WhatsApp', meta: '0s later', tone: 'emerald' },
  { icon: CalendarCheck, label: 'Meeting booked · Thu 3pm', meta: 'auto', tone: 'emerald' },
  { icon: ScrollText, label: 'Deal won → invoice + journal posted', meta: '€1,240', tone: 'emerald' },
];

/* ───────────────────────── page ───────────────────────────────── */
export default function LandingClient() {
  const router = useRouter();
  const [mode, setMode] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState<number | null>(0);
  const m = MODES[mode];

  // Tenant subdomains bounce into the app; the apex renders the landing. The
  // markup still renders (server + first paint) so crawlers get full content.
  useEffect(() => {
    if (!isApexHost(window.location.hostname)) {
      router.replace(getAuthToken('access') ? '/dashboard' : '/auth/login');
    }
  }, [router]);

  useEffect(() => {
    const prev = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'smooth';
    return () => { document.documentElement.style.scrollBehavior = prev; };
  }, []);

  const nav = [
    { href: '#ai', label: 'AI sales' },
    { href: '#platform', label: 'Platform' },
    { href: '#how', label: 'How it works' },
    { href: '#faq', label: 'FAQ' },
    { href: '/payroll', label: 'Payroll & HR' },
  ];

  return (
    <div className="relative min-h-screen bg-[#0B1120] text-slate-200 antialiased selection:bg-emerald-500/30">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-emerald-500 focus:px-4 focus:py-2 focus:font-bold focus:text-[#06251c]">Skip to content</a>
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[640px] bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.12),transparent_62%)]" />

      {/* ── Nav ── */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0B1120]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight text-white" aria-label={`${SITE_NAME} home`}>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-400/30 bg-emerald-500/15 text-emerald-300"><Store className="h-4 w-4" aria-hidden="true" /></span>
            {SITE_NAME}
          </Link>

          <nav aria-label="Primary" className="hidden items-center gap-6 text-sm md:flex">
            {nav.map((n) => (
              n.href.startsWith('#')
                ? <a key={n.href} href={n.href} className="text-slate-300 transition-colors hover:text-white">{n.label}</a>
                : <Link key={n.href} href={n.href} className="text-slate-300 transition-colors hover:text-white">{n.label}</Link>
            ))}
            <a href="/auth/login" className="text-slate-300 transition-colors hover:text-white">Sign in</a>
            <Link href="/signup" className="rounded-lg border border-emerald-400/40 px-4 py-2 font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/10">Start free</Link>
          </nav>

          <button type="button" onClick={() => setMenuOpen((v) => !v)} aria-expanded={menuOpen} aria-controls="mobile-menu" aria-label="Toggle menu"
            className="rounded-lg border border-white/10 p-2 text-slate-200 md:hidden">
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {menuOpen && (
          <div id="mobile-menu" className="border-t border-white/[0.06] bg-[#0B1120] px-5 py-4 md:hidden">
            <nav aria-label="Mobile" className="flex flex-col gap-3 text-sm">
              {nav.map((n) => (
                n.href.startsWith('#')
                  ? <a key={n.href} href={n.href} onClick={() => setMenuOpen(false)} className="text-slate-300 hover:text-white">{n.label}</a>
                  : <Link key={n.href} href={n.href} onClick={() => setMenuOpen(false)} className="text-slate-300 hover:text-white">{n.label}</Link>
              ))}
              <a href="/auth/login" className="text-slate-300 hover:text-white">Sign in</a>
              <Link href="/signup" onClick={() => setMenuOpen(false)} className="rounded-lg border border-emerald-400/40 px-4 py-2 text-center font-semibold text-emerald-300">Start free</Link>
            </nav>
          </div>
        )}
      </header>

      <main id="main">
        {/* ── Hero (AI sales engine) ── */}
        <section className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-14 lg:grid-cols-2">
          <Reveal>
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/[0.07] px-3 py-1 text-[12px] text-emerald-200">
              <BrainCircuit className="h-3.5 w-3.5" aria-hidden="true" /> AI sales engine + business OS
            </span>
            <h1 className="text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-[3.3rem]">
              Win more customers.<br /><span className="text-emerald-400">Let AI do the chasing.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg">
              {SITE_NAME} captures every lead, scores it, and follows up automatically — so you close more,
              faster. Then when the deal lands, the same workspace runs the rest: orders, inventory,
              bookings, payroll and real accounting. Any industry. Any size.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/signup" className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-6 py-3 text-sm font-bold text-[#06251c] shadow-lg shadow-emerald-500/20 transition-colors hover:bg-emerald-400">
                Start your free Pro trial <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <a href="#ai" className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-6 py-3 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/[0.06]">
                <Sparkles className="h-4 w-4" aria-hidden="true" /> See the AI in action
              </a>
            </div>
            <p className="mt-3 text-[12px] text-slate-500">No card. 14 days. Cancel anytime.</p>
          </Reveal>

          {/* AI pipeline preview */}
          <Reveal delay={120}>
            <div className="relative rounded-2xl border border-white/10 bg-[#0e1626]/80 shadow-2xl shadow-black/40 backdrop-blur" role="img" aria-label="Merkoll AI pipeline: a lead is captured, scored, followed up, booked and won — then posted to the books automatically">
              <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
                <BrainCircuit className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                <span className="text-[12px] font-semibold text-white">AI sales pipeline</span>
                <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-emerald-300"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> live</span>
              </div>
              <div className="space-y-2 p-4">
                {PIPELINE.map((p, i) => (
                  <div key={p.label} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${p.tone === 'emerald' ? 'border-emerald-400/20 bg-emerald-500/[0.06]' : 'border-white/5 bg-white/[0.03]'}`}>
                    <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${p.tone === 'emerald' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/[0.05] text-slate-400'}`}><p.icon className="h-3.5 w-3.5" aria-hidden="true" /></span>
                    <span className="flex-1 text-[13px] text-slate-200">{p.label}</span>
                    <span className={`font-mono text-[11px] ${p.tone === 'emerald' ? 'text-emerald-300' : 'text-slate-500'}`}>{p.meta}</span>
                    {i < PIPELINE.length - 1 && null}
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </section>

        {/* ── Stats / social proof ── */}
        <section aria-label="Key numbers" className="relative mx-auto max-w-6xl px-5 pb-16">
          <Reveal>
            <dl className="grid grid-cols-2 gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.015] p-6 sm:grid-cols-4">
              {STATS.map((s) => (
                <div key={s.l} className="text-center">
                  <dt className="sr-only">{s.l}</dt>
                  <dd className="font-mono text-2xl font-bold text-emerald-300 sm:text-3xl">{s.v}</dd>
                  <p className="mt-1 text-[12px] leading-snug text-slate-400">{s.l}</p>
                </div>
              ))}
            </dl>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm font-semibold tracking-tight text-slate-500 opacity-60">
              <span>NORTHWIND</span><span>ALPINE CO</span><span>CRUST &amp; CRUMB</span><span>SALT BREWING</span><span>VITAL SPA</span>
            </div>
          </Reveal>
        </section>

        {/* ── AI sales engine ── */}
        <section id="ai" aria-labelledby="ai-h" className="relative mx-auto max-w-6xl scroll-mt-20 px-5 pb-20">
          <Reveal className="mb-10 text-center">
            <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/[0.08] px-3 py-1 text-[12px] text-emerald-200"><BrainCircuit className="h-3.5 w-3.5" aria-hidden="true" /> The AI sales engine</span>
            <h2 id="ai-h" className="text-2xl font-bold tracking-tight text-white sm:text-3xl">An AI sales team that never sleeps</h2>
            <p className="mx-auto mt-2 max-w-2xl text-slate-400">Most software only records what already happened. {SITE_NAME} goes and gets the business — capturing, qualifying and closing leads while you run the floor.</p>
          </Reveal>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {AI_ENGINE.map((f, i) => (
              <Reveal key={f.t} delay={i * 60}>
                <article className="group h-full rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 transition-all hover:-translate-y-0.5 hover:border-emerald-400/30 hover:bg-white/[0.04]">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-500/10 text-emerald-300"><f.icon className="h-5 w-5" aria-hidden="true" /></span>
                  <h3 className="mt-4 font-semibold text-white">{f.t}</h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-slate-400">{f.d}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── The switch ── */}
        <section aria-label="Why switch" className="relative mx-auto max-w-5xl px-5 pb-20">
          <Reveal>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-6">
                <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">The old way</span>
                <p className="mt-3 leading-relaxed text-slate-400">Leads scattered across an inbox, WhatsApp and sticky notes. The hot ones go cold because nobody followed up in time — and the deals that close live in a different system than your books.</p>
              </div>
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.04] p-6">
                <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-300">The {SITE_NAME} way</span>
                <p className="mt-3 leading-relaxed text-slate-300">Every lead is captured, scored and followed up by AI in seconds. The deal closes, the order is raised, the journal is posted, the customer is rewarded. <span className="font-semibold text-emerald-300">Automatically.</span></p>
              </div>
            </div>
          </Reveal>
        </section>

        {/* ── Runs the business (platform) ── */}
        <section id="platform" aria-labelledby="platform-h" className="relative mx-auto max-w-6xl scroll-mt-20 px-5 pb-12">
          <Reveal className="mb-10 text-center">
            <h2 id="platform-h" className="text-2xl font-bold tracking-tight text-white sm:text-3xl">And when business is booming, {SITE_NAME} runs it all</h2>
            <p className="mx-auto mt-2 max-w-2xl text-slate-400">The won deal flows straight into operations — no exports, no second system, no re-keying.</p>
          </Reveal>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {FLYWHEEL.map((s, i) => (
              <Reveal key={s.t} delay={i * 60}>
                <article className="group h-full rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 transition-all hover:-translate-y-0.5 hover:border-emerald-400/30">
                  <div className="flex items-center justify-between">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-400/20 bg-emerald-500/10 text-emerald-300"><s.icon className="h-4 w-4" aria-hidden="true" /></span>
                    <span className="font-mono text-[12px] text-slate-600">0{i + 1}</span>
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-white">{s.t}</h3>
                  <p className="mt-1 text-[12px] leading-relaxed text-slate-500">{s.d}</p>
                </article>
              </Reveal>
            ))}
          </div>
          <p className="mt-4 text-center text-[12px] text-slate-600">…plus HR, payroll, expenses, e-signature, loyalty and analytics — 20+ modules in one workspace.</p>
        </section>

        {/* ── Why ── */}
        <section aria-labelledby="why-h" className="relative mx-auto max-w-6xl px-5 pb-20">
          <Reveal><h2 id="why-h" className="sr-only">Why Merkoll</h2></Reveal>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {WHY.map((w, i) => (
              <Reveal key={w.t} delay={i * 70}>
                <article className="h-full rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-500/10 text-emerald-300"><w.icon className="h-5 w-5" aria-hidden="true" /></span>
                  <h3 className="mt-4 font-semibold text-white">{w.t}</h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-slate-400">{w.d}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── Industries (proof — configures to your vertical) ── */}
        <section aria-labelledby="industries-h" className="relative mx-auto max-w-6xl px-5 pb-20">
          <Reveal className="mb-10 text-center">
            <h2 id="industries-h" className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Configured for your industry, out of the box</h2>
            <p className="mt-2 text-slate-400">Don’t bend your business to fit software — the software becomes you.</p>
          </Reveal>
          <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-center">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {INDUSTRY_CONFIG.map((f, i) => (
                <Reveal key={f.title} delay={i * 70}>
                  <article className="group h-full rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 transition-all hover:-translate-y-0.5 hover:border-emerald-400/30 hover:bg-white/[0.04]">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-500/10 text-emerald-300"><f.icon className="h-5 w-5" aria-hidden="true" /></span>
                    <h3 className="mt-4 font-semibold text-white">{f.title}</h3>
                    <p className="mt-1 text-[13px] leading-relaxed text-slate-400">{f.desc}</p>
                  </article>
                </Reveal>
              ))}
            </div>
            {/* Morphing dashboard mock */}
            <Reveal delay={120}>
              <div className="rounded-2xl border border-white/10 bg-[#0e1626]/80 shadow-2xl shadow-black/40 backdrop-blur" role="img" aria-label="Merkoll preview: a sale posting a double-entry journal across different industries">
                <div className="flex items-center gap-1.5 border-b border-white/5 px-4 py-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" /><span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
                  <span className="ml-3 font-mono text-[11px] text-slate-500">{m.key.toLowerCase()}.merkoll.com</span>
                </div>
                <div className="p-4">
                  <div className="mb-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Industry preview">
                    {MODES.map((x, i) => (
                      <button key={x.key} type="button" role="tab" aria-selected={i === mode} onClick={() => setMode(i)}
                        className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${i === mode ? 'bg-emerald-500 text-[#06251c]' : 'bg-white/[0.04] text-slate-400 hover:text-white'}`}>
                        {x.key}
                      </button>
                    ))}
                  </div>
                  <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-white">{m.line}</span>
                      <span className="font-mono font-bold text-emerald-300">{m.amt}</span>
                    </div>
                    <p className="mt-1 text-[12px] text-slate-500">{m.sub}</p>
                  </div>
                  <div className="mt-3 rounded-xl border border-white/5 bg-white/[0.03] p-4 font-mono text-[12px]">
                    <div className="mb-2 flex items-center gap-2 text-slate-500"><ScrollText className="h-3.5 w-3.5" aria-hidden="true" /> Journal · auto-posted</div>
                    <div className="flex justify-between text-slate-300"><span>Dr&nbsp;&nbsp;Cash / Receivable</span><span className="text-emerald-300">{m.amt}</span></div>
                    <div className="flex justify-between text-slate-300"><span>Cr&nbsp;&nbsp;Sales</span><span className="text-emerald-300">{m.amt}</span></div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── Testimonials ── */}
        <section aria-labelledby="loved-h" className="relative mx-auto max-w-6xl px-5 pb-20">
          <Reveal><h2 id="loved-h" className="mb-10 text-center text-2xl font-bold tracking-tight text-white sm:text-3xl">Loved by operators across Europe &amp; Asia</h2></Reveal>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.name} delay={i * 70}>
                <figure className="flex h-full flex-col rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
                  <div className="mb-3 flex gap-0.5 text-emerald-300" aria-hidden="true">{Array.from({ length: 5 }).map((_, k) => <Star key={k} className="h-4 w-4 fill-current" />)}</div>
                  <blockquote className="flex-1 text-[14px] leading-relaxed text-slate-300">“{t.quote}”</blockquote>
                  <figcaption className="mt-4 text-[13px]"><span className="font-semibold text-white">{t.name}</span><br /><span className="text-slate-500">{t.role}</span></figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── How it works ── */}
        <section id="how" aria-labelledby="how-h" className="relative mx-auto max-w-4xl scroll-mt-20 px-5 pb-24">
          <Reveal><h2 id="how-h" className="mb-10 text-center text-2xl font-bold tracking-tight text-white sm:text-3xl">Live in three steps</h2></Reveal>
          <Reveal>
            <ol className="rounded-2xl border border-white/[0.08] bg-[#0e1626]/60 p-6 font-mono text-sm">
              {STEPS.map((s) => (
                <li key={s.n} className="flex items-center gap-4 border-b border-white/5 py-3 last:border-0">
                  <span className="text-emerald-300">{s.n}</span>
                  <Check className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
                  <span className="font-sans font-semibold text-white">{s.t}</span>
                  <span className="ml-auto hidden text-right text-slate-500 sm:block">{s.d}</span>
                </li>
              ))}
            </ol>
          </Reveal>
        </section>

        {/* ── FAQ ── */}
        <section id="faq" aria-labelledby="faq-h" className="relative mx-auto max-w-3xl scroll-mt-20 px-5 pb-24">
          <Reveal><h2 id="faq-h" className="mb-8 text-center text-2xl font-bold tracking-tight text-white sm:text-3xl">Frequently asked questions</h2></Reveal>
          <div className="space-y-3">
            {FAQ.map((f, i) => {
              const open = faqOpen === i;
              return (
                <Reveal key={f.q}>
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                    <h3>
                      <button type="button" onClick={() => setFaqOpen(open ? null : i)} aria-expanded={open} aria-controls={`faq-panel-${i}`}
                        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-[15px] font-semibold text-white">
                        {f.q}
                        {open ? <Minus className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" /> : <Plus className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />}
                      </button>
                    </h3>
                    {open && <div id={`faq-panel-${i}`} className="px-5 pb-5 text-[14px] leading-relaxed text-slate-400">{f.a}</div>}
                  </div>
                </Reveal>
              );
            })}
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section aria-labelledby="cta-h" className="relative mx-auto max-w-4xl px-5 pb-24 text-center">
          <Reveal>
            <h2 id="cta-h" className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Stop chasing leads by hand.<br className="hidden sm:block" /> Let AI win the customers.</h2>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href="/signup" className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-6 py-3 text-sm font-bold text-[#06251c] shadow-lg shadow-emerald-500/20 transition-colors hover:bg-emerald-400">
                Start your free Pro trial <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <a href={AGENCY_SIGNUP_URL} className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-6 py-3 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/[0.06]">
                <Building2 className="h-4 w-4" aria-hidden="true" /> Become a partner
              </a>
            </div>
            <p className="mt-3 text-[12px] text-slate-500">No card. 14 days. Cancel anytime.</p>
          </Reveal>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="relative border-t border-white/[0.06] py-10">
        <div className="mx-auto max-w-6xl px-5">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="flex items-center gap-2 font-bold text-slate-200"><Store className="h-4 w-4 text-emerald-300" aria-hidden="true" /> {SITE_NAME}</div>
              <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-slate-500">The AI sales engine and all-in-one business OS. Built in Sweden for operators across Europe &amp; Asia.</p>
            </div>
            <nav aria-label="Product" className="text-[13px]">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-500">Product</p>
              <ul className="space-y-2 text-slate-400">
                <li><a href="#ai" className="hover:text-slate-200">AI sales engine</a></li>
                <li><a href="#platform" className="hover:text-slate-200">The platform</a></li>
                <li><a href="#industries-h" className="hover:text-slate-200">Industries</a></li>
                <li><Link href="/payroll" className="hover:text-slate-200">Payroll &amp; HR</Link></li>
              </ul>
            </nav>
            <nav aria-label="Resources" className="text-[13px]">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-500">Resources</p>
              <ul className="space-y-2 text-slate-400">
                {RESOURCE_LINKS.map((r) => <li key={r.href}><Link href={r.href} className="hover:text-slate-200">{r.label}</Link></li>)}
                <li><a href={AGENCY_SIGNUP_URL} className="hover:text-slate-200">Partners</a></li>
              </ul>
            </nav>
            <nav aria-label="Company" className="text-[13px]">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-500">Company</p>
              <ul className="space-y-2 text-slate-400">
                <li><a href="/auth/login" className="hover:text-slate-200">Sign in</a></li>
                <li><Link href="/privacy" prefetch={false} className="hover:text-slate-200">Privacy</Link></li>
                <li><Link href="/terms" prefetch={false} className="hover:text-slate-200">Terms</Link></li>
              </ul>
              <div className="mt-4 flex items-center gap-3">
                <a href={SOCIAL_LINKS.x} rel="me noopener" target="_blank" aria-label="Merkoll on X" className="text-slate-500 hover:text-emerald-300">X</a>
                <a href={SOCIAL_LINKS.linkedin} rel="me noopener" target="_blank" aria-label="Merkoll on LinkedIn" className="text-slate-500 hover:text-emerald-300">in</a>
                <a href={SOCIAL_LINKS.facebook} rel="me noopener" target="_blank" aria-label="Merkoll on Facebook" className="text-slate-500 hover:text-emerald-300">f</a>
              </div>
            </nav>
          </div>
          <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-white/[0.06] pt-6 text-[12px] text-slate-500 sm:flex-row">
            <span>© {new Date().getFullYear()} {SITE_NAME}. All rights reserved.</span>
            <span>Made in Sweden · serving Europe &amp; Asia</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
