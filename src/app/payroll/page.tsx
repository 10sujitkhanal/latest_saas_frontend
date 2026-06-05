'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  motion, useInView, useMotionValue, useMotionTemplate, animate,
} from 'framer-motion';
import {
  Wallet, Users, CalendarCheck, Clock, Calculator, Fingerprint,
  Receipt, FileText, Shield, Check, ChevronDown, Star, ArrowRight, Sparkles, Zap,
} from 'lucide-react';

/* ============================ helpers ============================ */

const EASE = [0.22, 1, 0.36, 1] as const;

function Reveal({ children, delay = 0, y = 24, className = '' }: { children: React.ReactNode; delay?: number; y?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, ease: EASE, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function Counter({ to, suffix = '', decimals = 0 }: { to: number; suffix?: string; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, to, {
      duration: 1.8, ease: EASE,
      onUpdate: (v) => setVal(v),
    });
    return () => controls.stop();
  }, [inView, to]);
  return <span ref={ref}>{val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</span>;
}

function Magnetic({ children, className = '', href }: { children: React.ReactNode; className?: string; href: string }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const x = useMotionValue(0); const y = useMotionValue(0);
  const onMove = (e: React.MouseEvent) => {
    const r = ref.current!.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * 0.3);
    y.set((e.clientY - (r.top + r.height / 2)) * 0.3);
  };
  const reset = () => { animate(x, 0, { duration: 0.4, ease: EASE }); animate(y, 0, { duration: 0.4, ease: EASE }); };
  return (
    <motion.a ref={ref} href={href} onMouseMove={onMove} onMouseLeave={reset} style={{ x, y }} className={className}>
      {children}
    </motion.a>
  );
}

/* ============================ page ============================ */

export default function PayrollLanding() {
  // mouse-follow gradient in hero
  const mx = useMotionValue(50); const my = useMotionValue(20);
  const bg = useMotionTemplate`radial-gradient(620px circle at ${mx}% ${my}%, rgba(59,130,246,0.18), transparent 60%), radial-gradient(900px circle at 80% 0%, rgba(139,92,246,0.14), transparent 55%)`;
  const onHeroMove = (e: React.MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    mx.set(((e.clientX - r.left) / r.width) * 100);
    my.set(((e.clientY - r.top) / r.height) * 100);
  };

  return (
    <div className="min-h-screen bg-[#070b16] text-slate-200 antialiased overflow-x-hidden">
      <Nav />

      {/* ===== Hero ===== */}
      <section onMouseMove={onHeroMove} className="relative">
        <motion.div style={{ background: bg }} className="pointer-events-none absolute inset-0 -z-10" />
        <div className="mx-auto max-w-6xl px-5 pt-20 pb-24 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <motion.span
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}
              className="inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/[0.08] px-3 py-1 text-[12px] text-blue-200 mb-6">
              <Sparkles className="w-3.5 h-3.5" /> Payroll · HR · Accounting — one platform
            </motion.span>
            <motion.h1
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: EASE, delay: 0.05 }}
              className="text-4xl sm:text-5xl lg:text-[3.6rem] font-bold tracking-tight leading-[1.04] text-white">
              Payroll, HR & Accounting —{' '}
              <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">Simplified.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: EASE, delay: 0.15 }}
              className="mt-5 max-w-xl text-slate-400 text-base sm:text-lg leading-relaxed">
              Manage employees, payroll, attendance, leave, compliance and accounting from one powerful platform.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: EASE, delay: 0.25 }}
              className="mt-8 flex flex-wrap items-center gap-3">
              <Magnetic href="/signup" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 text-white text-sm font-bold px-6 py-3.5 shadow-xl shadow-blue-500/25">
                Start Free Trial <ArrowRight className="w-4 h-4" />
              </Magnetic>
              <Magnetic href="#contact" className="inline-flex items-center gap-2 rounded-xl border border-white/15 hover:bg-white/[0.06] text-slate-200 text-sm font-semibold px-6 py-3.5">
                Book a Demo
              </Magnetic>
            </motion.div>
            <p className="mt-3 text-[12px] text-slate-500">No card required · 14-day trial</p>
          </div>

          <HeroDashboard />
        </div>
      </section>

      <TrustedBy />
      <ProblemSection />
      <FeaturesSection />
      <ShowcaseSection />
      <StatsSection />
      <WhySection />
      <Testimonials />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}

/* ============================ sections ============================ */

function Nav() {
  return (
    <header className="sticky top-0 z-30 backdrop-blur-xl bg-[#070b16]/70 border-b border-white/5">
      <div className="mx-auto max-w-6xl flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2 font-bold text-white text-lg tracking-tight">
          <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center"><Wallet className="w-4 h-4 text-white" /></span>
          Meroll
        </div>
        <nav className="hidden md:flex items-center gap-6 text-sm text-slate-300">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          <Link href="/" className="hover:text-white transition-colors">Merkoll OS</Link>
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <a href="/auth/login" className="text-slate-300 hover:text-white">Sign in</a>
          <Link href="/signup" className="rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold px-4 py-2">Book a Demo</Link>
        </div>
      </div>
    </header>
  );
}

function HeroDashboard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, rotateX: 8 }} animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 1, ease: EASE, delay: 0.2 }}
      style={{ perspective: 1000 }} className="relative">
      <div className="rounded-2xl border border-white/10 bg-[#0c1322]/90 backdrop-blur shadow-2xl shadow-black/50 overflow-hidden">
        <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-400/70" /><span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" /><span className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
          <span className="ml-3 text-[11px] text-slate-500 font-mono">app.meroll.com/payroll</span>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            {[{ l: 'Net payroll', v: '$284,910', c: 'text-blue-300' }, { l: 'Employees', v: '1,204', c: 'text-indigo-300' }, { l: 'Accuracy', v: '99.9%', c: 'text-emerald-300' }].map((s) => (
              <div key={s.l} className="rounded-xl bg-white/[0.03] border border-white/5 p-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">{s.l}</div>
                <div className={`mt-1 font-mono font-bold ${s.c}`}>{s.v}</div>
              </div>
            ))}
          </div>
          {/* animated bars */}
          <div className="rounded-xl bg-white/[0.03] border border-white/5 p-4">
            <div className="text-[11px] text-slate-500 mb-3">Attendance · this week</div>
            <div className="flex items-end gap-2 h-24">
              {[60, 80, 55, 92, 74, 40, 30].map((h, i) => (
                <motion.div key={i} initial={{ height: 0 }} animate={{ height: `${h}%` }} transition={{ duration: 0.8, ease: EASE, delay: 0.5 + i * 0.08 }}
                  className="flex-1 rounded-md bg-gradient-to-t from-blue-500/40 to-indigo-400/80" />
              ))}
            </div>
          </div>
          <motion.div
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.1, duration: 0.6, ease: EASE }}
            className="rounded-xl bg-blue-500/10 border border-blue-400/20 p-3 flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-300"><Wallet className="w-4 h-4" /></span>
            <div className="text-[12px]"><span className="text-white font-semibold">Salary disbursed</span><span className="text-slate-400"> · 1,204 employees · 2.3s</span></div>
          </motion.div>
        </div>
      </div>
      {/* floating chips */}
      <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -left-6 top-16 hidden sm:flex items-center gap-2 rounded-xl border border-white/10 bg-[#0c1322] px-3 py-2 text-[12px] shadow-xl">
        <Fingerprint className="w-4 h-4 text-emerald-300" /> Clocked in
      </motion.div>
      <motion.div animate={{ y: [0, 12, 0] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -right-5 bottom-12 hidden sm:flex items-center gap-2 rounded-xl border border-white/10 bg-[#0c1322] px-3 py-2 text-[12px] shadow-xl">
        <Receipt className="w-4 h-4 text-indigo-300" /> Payslip ready
      </motion.div>
    </motion.div>
  );
}

function TrustedBy() {
  const logos = ['NORTHWIND', 'ALPINE CO', 'VERTEX', 'LUMEN', 'CRUST & CO', 'SALT', 'VITAL', 'ORBIT'];
  return (
    <section className="border-y border-white/5 py-10">
      <p className="text-center text-[12px] uppercase tracking-widest text-slate-500 mb-6">Trusted by growing businesses</p>
      <div className="relative overflow-hidden mx-auto max-w-5xl [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
        <motion.div className="flex gap-12 whitespace-nowrap" animate={{ x: ['0%', '-50%'] }} transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}>
          {[...logos, ...logos].map((l, i) => (
            <span key={i} className="text-slate-600 font-bold tracking-tight text-lg shrink-0">{l}</span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function ProblemSection() {
  const pains = [
    { icon: Calculator, t: 'Manual payroll errors', d: 'One wrong cell and a paycheck is wrong — and trust is gone.' },
    { icon: Clock, t: 'Attendance confusion', d: 'Punches in three tools that never reconcile.' },
    { icon: CalendarCheck, t: 'Leave tracking chaos', d: 'Balances live in someone’s inbox.' },
    { icon: FileText, t: 'Spreadsheet sprawl', d: 'Versioned files no one trusts at month-end.' },
    { icon: Shield, t: 'Compliance risk', d: 'Tax and filings you can’t afford to get wrong.' },
  ];
  return (
    <section className="mx-auto max-w-6xl px-5 py-24">
      <Reveal className="text-center mb-12">
        <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">The old way is held together with tape.</h2>
        <p className="mt-3 text-slate-400">Disconnected tools cost you hours, accuracy, and peace of mind.</p>
      </Reveal>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {pains.map((p, i) => (
          <Reveal key={p.t} delay={i * 0.06}>
            <div className="group h-full rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 transition-all hover:-translate-y-1 hover:border-rose-400/30">
              <span className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-400/20 flex items-center justify-center text-rose-300"><p.icon className="w-5 h-5" /></span>
              <h3 className="mt-4 font-semibold text-white text-sm">{p.t}</h3>
              <p className="mt-1 text-[12px] text-slate-500 leading-relaxed">{p.d}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

const FEATURES = [
  { icon: Wallet, t: 'Payroll Management', items: ['Salary processing', 'Bonuses & deductions', 'Tax calculations'] },
  { icon: Fingerprint, t: 'Attendance', items: ['Biometric integration', 'GPS attendance', 'Shift management'] },
  { icon: CalendarCheck, t: 'Leave Management', items: ['Approval workflows', 'Leave balances', 'Team calendars'] },
  { icon: Users, t: 'HR Management', items: ['Employee profiles', 'Documents', 'Performance records'] },
  { icon: Receipt, t: 'Employee Self-Service', items: ['Payslips', 'Leave requests', 'Attendance history'] },
  { icon: Calculator, t: 'Accounting', items: ['General ledger', 'Invoicing & expenses', 'Financial reporting'] },
];

function FeaturesSection() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-5 py-24">
      <Reveal className="text-center mb-12">
        <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">Everything, in one dashboard.</h2>
        <p className="mt-3 text-slate-400">Six tightly-integrated modules — not six bolted-on apps.</p>
      </Reveal>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {FEATURES.map((f, i) => (
          <Reveal key={f.t} delay={i * 0.05}>
            <div className="group relative h-full rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 overflow-hidden transition-all hover:-translate-y-1 hover:border-blue-400/30">
              <div className="absolute -inset-px opacity-0 group-hover:opacity-100 transition-opacity bg-[radial-gradient(300px_circle_at_var(--x,50%)_0%,rgba(59,130,246,0.12),transparent_70%)]" />
              <span className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/10 border border-blue-400/20 flex items-center justify-center text-blue-300"><f.icon className="w-5 h-5" /></span>
              <h3 className="relative mt-4 font-semibold text-white">{f.t}</h3>
              <ul className="relative mt-3 space-y-1.5">
                {f.items.map((it) => (
                  <li key={it} className="flex items-center gap-2 text-[13px] text-slate-400"><Check className="w-3.5 h-3.5 text-blue-400 shrink-0" /> {it}</li>
                ))}
              </ul>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function ShowcaseSection() {
  const steps = [
    { icon: Wallet, t: 'Run payroll in minutes', d: 'Salaries, bonuses, deductions and taxes computed and disbursed in one click — with a full audit trail.' },
    { icon: Fingerprint, t: 'Attendance that reconciles itself', d: 'Biometric, GPS and shift data flow straight into payroll. No exports, no spreadsheets.' },
    { icon: CalendarCheck, t: 'Leave without the back-and-forth', d: 'Requests, approvals and balances live on one team calendar everyone trusts.' },
    { icon: Calculator, t: 'Books that are always closed', d: 'Every payrun posts to the ledger automatically — reporting and compliance, ready.' },
  ];
  return (
    <section className="mx-auto max-w-6xl px-5 py-24">
      <Reveal className="text-center mb-12">
        <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">One flow, end to end.</h2>
      </Reveal>
      <div className="grid lg:grid-cols-2 gap-10">
        <div className="space-y-4">
          {steps.map((s, i) => (
            <Reveal key={s.t} delay={i * 0.05}>
              <div className="flex gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
                <span className="w-11 h-11 shrink-0 rounded-xl bg-blue-500/10 border border-blue-400/20 flex items-center justify-center text-blue-300"><s.icon className="w-5 h-5" /></span>
                <div><h3 className="font-semibold text-white">{s.t}</h3><p className="mt-1 text-[13px] text-slate-400 leading-relaxed">{s.d}</p></div>
              </div>
            </Reveal>
          ))}
        </div>
        <div className="lg:sticky lg:top-24 self-start">
          <Reveal>
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-blue-500/[0.08] to-purple-500/[0.05] p-6">
              <div className="rounded-xl bg-[#0c1322]/80 border border-white/10 p-5 font-mono text-[13px] space-y-2">
                <div className="text-slate-500"># pay run · June 2026</div>
                <div className="flex justify-between text-slate-300"><span>Gross</span><span className="text-blue-300">$312,400.00</span></div>
                <div className="flex justify-between text-slate-300"><span>Tax & deductions</span><span className="text-rose-300">−$27,490.00</span></div>
                <div className="flex justify-between text-white font-bold border-t border-white/10 pt-2"><span>Net disbursed</span><span className="text-emerald-300">$284,910.00</span></div>
                <div className="text-emerald-400/80 flex items-center gap-1.5 pt-1"><Check className="w-3.5 h-3.5" /> Posted to ledger · 1,204 payslips</div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function StatsSection() {
  const stats = [
    { to: 50000, suffix: '+', label: 'Payslips generated' },
    { to: 10000, suffix: '+', label: 'Employees managed' },
    { to: 99.9, suffix: '%', label: 'Payroll accuracy', decimals: 1 },
    { to: 500, suffix: '+', label: 'Businesses served' },
  ];
  return (
    <section className="border-y border-white/5 bg-white/[0.015] py-16">
      <div className="mx-auto max-w-5xl px-5 grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
        {stats.map((s) => (
          <Reveal key={s.label}>
            <div className="text-4xl sm:text-5xl font-bold font-mono bg-gradient-to-r from-blue-300 to-indigo-300 bg-clip-text text-transparent">
              <Counter to={s.to} suffix={s.suffix} decimals={s.decimals || 0} />
            </div>
            <div className="mt-2 text-[13px] text-slate-400">{s.label}</div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function WhySection() {
  const points = ['Save hours every pay cycle', 'Cut payroll errors to near-zero', 'Delight employees with self-service', 'Automate HR busywork', 'Stay compliant, automatically'];
  return (
    <section className="mx-auto max-w-5xl px-5 py-24">
      <Reveal className="text-center mb-12"><h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">Why teams switch to Meroll</h2></Reveal>
      <div className="grid sm:grid-cols-2 gap-4">
        {points.map((p, i) => (
          <Reveal key={p} delay={i * 0.05}>
            <div className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 transition-all hover:-translate-y-0.5 hover:border-blue-400/30">
              <span className="w-9 h-9 rounded-lg bg-blue-500/15 border border-blue-400/20 flex items-center justify-center text-blue-300"><Zap className="w-4 h-4" /></span>
              <span className="text-slate-200 font-medium">{p}</span>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function Testimonials() {
  const items = [
    { q: 'We cut payroll from two days to twenty minutes. The accuracy alone paid for it.', n: 'Aisha R.', r: 'Founder, Vertex Labs' },
    { q: 'Attendance, leave and payslips finally live in one place. My inbox is quiet.', n: 'Daniel M.', r: 'HR Manager, Lumen' },
    { q: 'Every payrun posts straight to the ledger. Month-end close is no longer a fire drill.', n: 'Priya S.', r: 'Finance Director, Orbit' },
  ];
  return (
    <section className="mx-auto max-w-6xl px-5 py-24">
      <Reveal className="text-center mb-12"><h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">Loved by founders, HR and finance.</h2></Reveal>
      <div className="grid md:grid-cols-3 gap-4">
        {items.map((t, i) => (
          <Reveal key={t.n} delay={i * 0.08}>
            <div className="h-full rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
              <div className="flex gap-0.5 text-amber-400 mb-3">{Array.from({ length: 5 }).map((_, k) => <Star key={k} className="w-4 h-4 fill-current" />)}</div>
              <p className="text-slate-200 leading-relaxed">“{t.q}”</p>
              <div className="mt-4 text-[13px]"><span className="text-white font-semibold">{t.n}</span><span className="text-slate-500"> · {t.r}</span></div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function Pricing() {
  const plans = [
    { name: 'Starter', price: '$4', unit: '/employee/mo', features: ['Payroll & payslips', 'Attendance & leave', 'Employee self-service'], highlight: false },
    { name: 'Growth', price: '$8', unit: '/employee/mo', features: ['Everything in Starter', 'Accounting & ledger', 'Biometric + GPS', 'Approval workflows', 'Priority support'], highlight: true },
    { name: 'Enterprise', price: 'Custom', unit: '', features: ['Everything in Growth', 'SSO & audit logs', 'Dedicated success manager', 'Custom compliance'], highlight: false },
  ];
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-5 py-24">
      <Reveal className="text-center mb-12">
        <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">Simple, scalable pricing</h2>
        <p className="mt-3 text-slate-400">Pay per employee. No setup fees. Cancel anytime.</p>
      </Reveal>
      <div className="grid md:grid-cols-3 gap-5 items-start">
        {plans.map((p, i) => (
          <Reveal key={p.name} delay={i * 0.08}>
            <div className={`relative h-full rounded-2xl border p-6 transition-all hover:-translate-y-1 ${p.highlight ? 'border-blue-400/40 bg-gradient-to-b from-blue-500/[0.10] to-transparent shadow-2xl shadow-blue-500/10' : 'border-white/[0.08] bg-white/[0.02]'}`}>
              {p.highlight && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">Most popular</span>}
              <h3 className="font-semibold text-white">{p.name}</h3>
              <div className="mt-3 flex items-end gap-1"><span className="text-4xl font-bold font-mono text-white">{p.price}</span><span className="text-slate-500 text-sm mb-1">{p.unit}</span></div>
              <ul className="mt-5 space-y-2">
                {p.features.map((f) => <li key={f} className="flex items-center gap-2 text-[13px] text-slate-300"><Check className="w-4 h-4 text-blue-400 shrink-0" /> {f}</li>)}
              </ul>
              <Link href="/signup" className={`mt-6 block text-center rounded-xl px-5 py-3 text-sm font-bold transition-colors ${p.highlight ? 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 text-white' : 'border border-white/15 hover:bg-white/[0.06] text-slate-200'}`}>
                {p.name === 'Enterprise' ? 'Contact sales' : 'Start free trial'}
              </Link>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function FAQ() {
  const qs = [
    { q: 'How long does setup take?', a: 'Most teams import employees and run their first payroll the same day. CSV import + guided setup.' },
    { q: 'Does it handle taxes and compliance?', a: 'Yes — tax calculations, deductions, and filing-ready reports are built in and kept current.' },
    { q: 'Can employees access their own payslips?', a: 'Employee self-service gives every employee payslips, leave requests and attendance history.' },
    { q: 'Does accounting come included?', a: 'Every payrun posts a balanced journal to a real double-entry ledger — invoicing, expenses and reports included.' },
    { q: 'Is there a free trial?', a: 'Yes, 14 days, no card required. Start with Starter or Growth and upgrade anytime.' },
  ];
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="mx-auto max-w-3xl px-5 py-24">
      <Reveal className="text-center mb-12"><h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">Questions, answered.</h2></Reveal>
      <div className="space-y-3">
        {qs.map((item, i) => (
          <Reveal key={item.q} delay={i * 0.04}>
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
              <button onClick={() => setOpen(open === i ? null : i)} className="w-full flex items-center justify-between px-5 py-4 text-left">
                <span className="font-semibold text-white text-sm">{item.q}</span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open === i ? 'rotate-180' : ''}`} />
              </button>
              <motion.div initial={false} animate={{ height: open === i ? 'auto' : 0, opacity: open === i ? 1 : 0 }} transition={{ duration: 0.3, ease: EASE }} className="overflow-hidden">
                <p className="px-5 pb-4 text-[13px] text-slate-400 leading-relaxed">{item.a}</p>
              </motion.div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section id="contact" className="relative mx-auto max-w-6xl px-5 py-24">
      <div className="relative rounded-3xl border border-white/10 overflow-hidden p-12 text-center">
        <motion.div
          className="pointer-events-none absolute inset-0 -z-10"
          animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
          style={{ backgroundImage: 'linear-gradient(120deg, rgba(59,130,246,0.18), rgba(139,92,246,0.18), rgba(59,130,246,0.18))', backgroundSize: '200% 200%' }} />
        <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">Ready to transform Payroll & HR?</h2>
        <p className="mt-3 text-slate-300 max-w-xl mx-auto">Run your first payroll today — accurate, compliant, and posted straight to your books.</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Magnetic href="/signup" className="inline-flex items-center gap-2 rounded-xl bg-white text-[#0b1020] text-sm font-bold px-6 py-3.5 shadow-xl">
            Get Started Today <ArrowRight className="w-4 h-4" />
          </Magnetic>
          <Magnetic href="/signup" className="inline-flex items-center gap-2 rounded-xl border border-white/25 hover:bg-white/[0.08] text-white text-sm font-semibold px-6 py-3.5">
            Book a Demo
          </Magnetic>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/5 py-8">
      <div className="mx-auto max-w-6xl px-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-[12px] text-slate-500">
        <div className="flex items-center gap-2 font-bold text-slate-300"><Wallet className="w-4 h-4 text-blue-300" /> Meroll</div>
        <div className="flex items-center gap-5">
          <a href="#features" className="hover:text-slate-200">Features</a>
          <a href="#pricing" className="hover:text-slate-200">Pricing</a>
          <Link href="/" className="hover:text-slate-200">Merkoll OS</Link>
          <a href="/auth/login" className="hover:text-slate-200">Sign in</a>
        </div>
        <span>© {new Date().getFullYear()} Meroll</span>
      </div>
    </footer>
  );
}
