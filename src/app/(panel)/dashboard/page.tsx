'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import Topbar from '@/components/Topbar';
import { PageSpinner } from '@/components/StateViews';
import { useAuthStore } from '@/store/authStore';
import { OrganizationService } from '@/services/organization.service';
import {
  TrendingUp, TrendingDown, Wallet, DollarSign, AlertTriangle, FileWarning,
  Package, FileText, ArrowUpRight, Plus, Check, X, StickyNote, ListTodo,
  CircleDot, Activity, ChevronRight, Building2,
} from 'lucide-react';

interface WsRow {
  id: number; name: string; industry: string; revenue: number; prev_revenue: number;
  change_pct: number; expenses: number; profit: number; outstanding: number;
  overdue_amount: number; overdue_count: number; low_stock: number; alerts: number; health: string;
}
interface Overview {
  period: { key: string; start: string; end: string };
  totals: {
    revenue: number; prev_revenue: number; revenue_change_pct: number; expenses: number;
    profit: number; margin_pct: number; outstanding: number; overdue_amount: number;
    overdue_count: number; workspaces: number;
  };
  trend: { date: string; revenue: number }[];
  workspaces: WsRow[];
  alerts: { type: string; severity: string; title: string; detail: string; count?: number; amount?: number }[];
  pulse: { type: string; text: string; workspace: string; at: string | null }[];
}
interface Item {
  id: number; kind: 'task' | 'note'; title: string; content: string;
  done: boolean; pinned: boolean; color: string; due_date: string | null; created_at: string;
}

const PERIODS = [
  { k: 'today', label: 'Today' }, { k: '7d', label: '7D' },
  { k: '30d', label: '30D' }, { k: 'qtd', label: 'QTD' }, { k: 'ytd', label: 'YTD' },
];

const money = (n: number) =>
  n >= 10000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const money2 = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const HEALTH: Record<string, { dot: string; label: string }> = {
  growing: { dot: 'bg-emerald-400', label: 'Growing' },
  steady: { dot: 'bg-sky-400', label: 'Steady' },
  declining: { dot: 'bg-rose-400', label: 'Declining' },
  attention: { dot: 'bg-amber-400', label: 'Needs attention' },
};

function Sparkline({ data, color = '#34d399' }: { data: number[]; color?: string }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 120, h = 32;
  const pts = data.map((v, i) => `${(i / (data.length - 1 || 1)) * w},${h - ((v - min) / range) * h}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-8" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function Delta({ pct }: { pct: number }) {
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${up ? 'text-emerald-400' : 'text-rose-400'}`}>
      {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}{Math.abs(pct)}%
    </span>
  );
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const [period, setPeriod] = useState('30d');
  const [ov, setOv] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Item[]>([]);

  const loadOverview = useCallback(async (p: string) => {
    setLoading(true);
    try {
      const res = await OrganizationService.getOverview(p);
      if (res?.success) setOv(res.data);
    } finally { setLoading(false); }
  }, []);

  const loadItems = useCallback(async () => {
    const res = await OrganizationService.getDashboardItems();
    if (res?.success) setItems(res.data.items || []);
  }, []);

  useEffect(() => { loadOverview(period); }, [period, loadOverview]);
  useEffect(() => { loadItems(); }, [loadItems]);

  const greeting = user?.email?.split('@')[0] ?? 'there';
  const trendVals = useMemo(() => (ov?.trend || []).map((t) => t.revenue), [ov]);

  return (
    <>
      <Topbar
        title={`Welcome back, ${greeting}`}
        subtitle="Your businesses at a glance — performance, alerts and what to do next."
        actions={
          <div className="flex items-center gap-1 bg-white/[0.03] border border-white/10 rounded-lg p-0.5">
            {PERIODS.map((p) => (
              <button key={p.k} onClick={() => setPeriod(p.k)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${period === p.k ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                {p.label}
              </button>
            ))}
          </div>
        }
      />

      <main className="flex-1 px-6 lg:px-10 py-8 overflow-y-auto">
        {loading && !ov ? <PageSpinner /> : ov && (
          <div className="space-y-8">
            {/* ── Company Pulse ───────────────────────────────────── */}
            <section>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-5 xl:col-span-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Revenue</span>
                    <Wallet className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="mt-2 flex items-end justify-between gap-2">
                    <div>
                      <div className="text-2xl font-bold text-white">{money2(ov.totals.revenue)}</div>
                      <Delta pct={ov.totals.revenue_change_pct} />
                    </div>
                    <div className="w-28"><Sparkline data={trendVals} /></div>
                  </div>
                </div>
                <KpiCard label="Net profit" value={money2(ov.totals.profit)} sub={`${ov.totals.margin_pct}% margin`} Icon={DollarSign} accent="text-sky-400" />
                <KpiCard label="Outstanding" value={money2(ov.totals.outstanding)} sub="receivables" Icon={FileText} accent="text-violet-400" />
                <KpiCard label="Overdue" value={money2(ov.totals.overdue_amount)} sub={`${ov.totals.overdue_count} invoice(s)`} Icon={FileWarning} accent={ov.totals.overdue_count ? 'text-rose-400' : 'text-slate-400'} />
              </div>
            </section>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              {/* ── Business Leaderboard ──────────────────────────── */}
              <section className="xl:col-span-2">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-white flex items-center gap-2"><Building2 className="w-4 h-4 text-emerald-400" /> Businesses</h2>
                  <Link href="/workspaces" className="text-xs text-emerald-300 hover:text-emerald-200">Manage →</Link>
                </div>
                <div className="space-y-2">
                  {ov.workspaces.length === 0 && <EmptyCard text="No businesses yet." />}
                  {ov.workspaces.map((w) => {
                    const h = HEALTH[w.health] || HEALTH.steady;
                    return (
                      <Link key={w.id} href={`/w/${w.id}`}
                        className="group flex items-center gap-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-emerald-500/30 hover:bg-white/[0.04] p-4 transition-colors">
                        <span className={`w-2 h-2 rounded-full ${h.dot} shrink-0`} title={h.label} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white truncate">{w.name}</span>
                            {w.industry && <span className="text-[10px] uppercase tracking-wider text-slate-500">{w.industry}</span>}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Profit {money(w.profit)} · Outstanding {money(w.outstanding)}
                            {w.overdue_count ? <span className="text-rose-400"> · {w.overdue_count} overdue</span> : null}
                            {w.low_stock ? <span className="text-amber-400"> · {w.low_stock} low stock</span> : null}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-bold text-white">{money(w.revenue)}</div>
                          <Delta pct={w.change_pct} />
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-emerald-300 shrink-0" />
                      </Link>
                    );
                  })}
                </div>
              </section>

              {/* ── Needs Attention ───────────────────────────────── */}
              <section>
                <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-3"><AlertTriangle className="w-4 h-4 text-amber-400" /> Needs attention</h2>
                <div className="space-y-2">
                  {ov.alerts.length === 0 && <EmptyCard text="All clear — nothing needs you right now. 🎉" />}
                  {ov.alerts.map((a, i) => (
                    <div key={i} className="rounded-xl bg-white/[0.02] border border-white/5 p-3.5 flex items-start gap-3">
                      <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        a.severity === 'high' ? 'bg-rose-500/10 text-rose-400' : a.severity === 'medium' ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-500/10 text-slate-400'}`}>
                        {a.type === 'low_stock' ? <Package className="w-4 h-4" /> : a.type === 'draft_invoices' ? <FileText className="w-4 h-4" /> : <FileWarning className="w-4 h-4" />}
                      </span>
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-slate-200">{a.title}</div>
                        <div className="text-[11px] text-slate-500">{a.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              {/* ── Pinned Notes & Tasks ──────────────────────────── */}
              <section className="xl:col-span-2">
                <DeskPanel items={items} reload={loadItems} />
              </section>

              {/* ── Activity Pulse ────────────────────────────────── */}
              <section>
                <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-3"><Activity className="w-4 h-4 text-emerald-400" /> Activity</h2>
                <div className="rounded-2xl bg-white/[0.02] border border-white/5 divide-y divide-white/5">
                  {ov.pulse.length === 0 && <div className="p-6 text-center text-xs text-slate-500">No recent activity.</div>}
                  {ov.pulse.map((p, i) => (
                    <div key={i} className="flex items-start gap-3 p-3.5">
                      <CircleDot className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-[13px] text-slate-200">{p.text}</div>
                        <div className="text-[11px] text-slate-500">{p.workspace}{p.at ? ` · ${new Date(p.at).toLocaleDateString()}` : ''}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

function KpiCard({ label, value, sub, Icon, accent }: { label: string; value: string; sub: string; Icon: any; accent: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
        <Icon className={`w-4 h-4 ${accent}`} />
      </div>
      <div className="text-2xl font-bold text-white mt-2">{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{sub}</div>
    </div>
  );
}

function EmptyCard({ text }: { text: string }) {
  return <div className="rounded-xl bg-white/[0.02] border border-white/5 p-6 text-center text-xs text-slate-500">{text}</div>;
}

function DeskPanel({ items, reload }: { items: Item[]; reload: () => void }) {
  const [tab, setTab] = useState<'task' | 'note'>('task');
  const [draft, setDraft] = useState('');
  const tasks = items.filter((i) => i.kind === 'task');
  const notes = items.filter((i) => i.kind === 'note');

  const add = async () => {
    if (!draft.trim()) return;
    if (tab === 'task') await OrganizationService.createDashboardItem({ kind: 'task', title: draft.trim() });
    else await OrganizationService.createDashboardItem({ kind: 'note', content: draft.trim() });
    setDraft('');
    reload();
  };
  const toggle = async (i: Item) => { await OrganizationService.updateDashboardItem(i.id, { done: !i.done }); reload(); };
  const remove = async (i: Item) => { await OrganizationService.deleteDashboardItem(i.id); reload(); };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          {tab === 'task' ? <ListTodo className="w-4 h-4 text-emerald-400" /> : <StickyNote className="w-4 h-4 text-amber-400" />} My desk
        </h2>
        <div className="flex items-center gap-1 bg-white/[0.03] border border-white/10 rounded-lg p-0.5">
          <button onClick={() => setTab('task')} className={`px-2.5 py-1 rounded-md text-xs font-semibold ${tab === 'task' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}>Tasks</button>
          <button onClick={() => setTab('note')} className={`px-2.5 py-1 rounded-md text-xs font-semibold ${tab === 'note' ? 'bg-amber-600 text-white' : 'text-slate-400'}`}>Notes</button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder={tab === 'task' ? 'Add a task and press Enter…' : 'Jot a note and press Enter…'}
          className="flex-1 h-10 rounded-lg bg-white/[0.03] border border-white/10 px-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50" />
        <button onClick={add} className="h-10 w-10 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center"><Plus className="w-4 h-4" /></button>
      </div>

      {tab === 'task' ? (
        <div className="rounded-2xl bg-white/[0.02] border border-white/5 divide-y divide-white/5">
          {tasks.length === 0 && <div className="p-6 text-center text-xs text-slate-500">No tasks yet. Add what you need to do today.</div>}
          {tasks.map((t) => (
            <div key={t.id} className="flex items-center gap-3 p-3 group">
              <button onClick={() => toggle(t)} className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${t.done ? 'bg-emerald-600 border-emerald-600' : 'border-white/20 hover:border-emerald-400'}`}>
                {t.done && <Check className="w-3.5 h-3.5 text-white" />}
              </button>
              <span className={`flex-1 text-sm ${t.done ? 'line-through text-slate-600' : 'text-slate-200'}`}>{t.title}</span>
              <button onClick={() => remove(t)} className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-rose-400"><X className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {notes.length === 0 && <EmptyCard text="No notes pinned." />}
          {notes.map((n) => (
            <div key={n.id} className="group rounded-xl bg-amber-500/[0.06] border border-amber-500/15 p-3.5 relative">
              <button onClick={() => remove(n)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-amber-500/60 hover:text-rose-400"><X className="w-3.5 h-3.5" /></button>
              <div className="text-[13px] text-amber-100/90 whitespace-pre-wrap pr-4">{n.content}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
