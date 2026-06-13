'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Banknote, Wand2, Loader2, AlertTriangle, TrendingUp, ArrowRight, Lightbulb, Mail, Check, Send, Repeat } from 'lucide-react';
import { toast } from 'sonner';
import { FinanceAgent, BillingAgent, type FinanceKpis, type OverdueInvoice, type BillingSchedule } from '@/services/agents.service';
import { AccountingService } from '@/services/accounting.service';

/**
 * Finance Agent work surface — reads the books and gives a money summary +
 * practical advice. Read-only (advisor); never posts. Self-contained so it
 * renders inside the per-agent AgentShell.
 */
export default function FinanceAgentCard({ workspaceId, embed }: { workspaceId: string | number; embed?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [kpis, setKpis] = useState<FinanceKpis | null>(null);
  const [insights, setInsights] = useState('');
  const [chasing, setChasing] = useState(false);
  const [overdue, setOverdue] = useState<OverdueInvoice[] | null>(null);
  const [remindingId, setRemindingId] = useState<number | null>(null);
  const [reminded, setReminded] = useState<Set<number>>(new Set());
  const [schedules, setSchedules] = useState<BillingSchedule[] | null>(null);
  const [loadingSchedules, setLoadingSchedules] = useState(false);

  const loadSchedules = async () => {
    if (loadingSchedules) return;
    setLoadingSchedules(true);
    try {
      const r = await BillingAgent.list(workspaceId);
      if (r.success) setSchedules(r.data?.schedules || []);
      else toast.error(r.message || 'Could not load recurring billing.');
    } catch { toast.error('Could not load recurring billing.'); }
    finally { setLoadingSchedules(false); }
  };

  const chase = async () => {
    if (chasing) return;
    setChasing(true);
    try {
      const r = await FinanceAgent.overdue(workspaceId);
      if (r.success) setOverdue(r.data?.invoices || []);
      else toast.error(r.message || 'Could not load overdue invoices.');
    } catch { toast.error('Could not load overdue invoices.'); }
    finally { setChasing(false); }
  };

  const remind = async (inv: OverdueInvoice) => {
    if (remindingId || !inv.email) return;
    setRemindingId(inv.id);
    try {
      const r = await AccountingService.remindInvoice(workspaceId, inv.id);
      if (r.success) { setReminded((s) => new Set(s).add(inv.id)); toast.success(`Reminder emailed for ${inv.invoice_no}.`); }
      else toast.error(r.message || 'Could not send the reminder.');
    } catch (e) { toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Could not send the reminder.'); }
    finally { setRemindingId(null); }
  };

  const money = (v: string, cur: string) => {
    const n = parseFloat(v) || 0;
    return `${cur} ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };

  const analyse = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const r = await FinanceAgent.summary(workspaceId);
      if (r.success && r.data) { setKpis(r.data.kpis); setInsights(r.data.insights || ''); }
      else toast.error(r.message || 'Could not read your finances.');
    } catch (e) {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Could not read your finances right now.');
    } finally {
      setLoading(false);
    }
  };

  const bullets = insights.split('\n').map((l) => l.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);

  return (
    <div className={embed ? '' : 'mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm'}>
      <p className={embed ? 'text-sm text-slate-500' : 'mt-1 text-sm text-slate-500'}>
        Reads your invoices and payments, then tells you where the money is — what&apos;s outstanding,
        what&apos;s overdue, and the next action. <strong>Read-only</strong> — it never changes your books.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={analyse} disabled={loading}
          className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-amber-600 disabled:opacity-50">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          {loading ? 'Reading the books…' : 'Analyse my finances'}
        </button>
        <button type="button" onClick={chase} disabled={chasing}
          className="inline-flex items-center gap-2 rounded-full border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50">
          {chasing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Chase overdue
        </button>
        <button type="button" onClick={loadSchedules} disabled={loadingSchedules}
          className="inline-flex items-center gap-2 rounded-full border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50">
          {loadingSchedules ? <Loader2 className="h-4 w-4 animate-spin" /> : <Repeat className="h-4 w-4" />} Recurring billing
        </button>
        <Link href={`/w/${workspaceId}/accounting/invoices`} className="text-sm font-semibold text-slate-500 hover:text-amber-700">Open Finance</Link>
      </div>

      {/* Recurring schedules — set them up from chat ("bill jane@acme.com $50 a month"); they auto-generate. */}
      {schedules && (
        schedules.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-5 text-center text-sm text-slate-500">
            No recurring billing yet. Tell the agent: <span className="font-semibold text-slate-700">&ldquo;bill jane@acme.com $50 a month&rdquo;</span>.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {schedules.map((s) => (
              <li key={s.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${s.is_active ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-400'}`}><Repeat className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <span className="truncate">{s.who || s.description}</span>
                    {!s.is_active && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">paused</span>}
                  </div>
                  <div className="text-xs text-slate-400">
                    {s.currency} {(parseFloat(s.amount) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} every {s.frequency_label}
                    {s.is_active && s.next_run_date ? ` · next ${s.next_run_date}` : ''}
                    {s.generated_count ? ` · ${s.generated_count} issued` : ''}
                  </div>
                </div>
                <Link href={`/w/${workspaceId}/accounting/invoices`} className="shrink-0 text-xs font-semibold text-amber-700 hover:underline">View</Link>
              </li>
            ))}
          </ul>
        )
      )}

      {/* Overdue list — chase each via the existing reminder (dunning) */}
      {overdue && (
        overdue.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-5 text-center text-sm text-emerald-600">Nothing overdue — you&apos;re all caught up. 🎉</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {overdue.map((inv) => {
              const done = reminded.has(inv.id);
              return (
                <li key={inv.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <span className="truncate">{inv.customer}</span>
                      <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-600">{inv.days_overdue}d overdue</span>
                    </div>
                    <div className="text-xs text-slate-400">{inv.invoice_no} · {inv.currency} {(parseFloat(inv.amount_due) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} due{inv.email ? '' : ' · no email on file'}</div>
                  </div>
                  {done ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><Check className="h-3.5 w-3.5" /> Reminded</span>
                  ) : (
                    <button type="button" onClick={() => remind(inv)} disabled={remindingId === inv.id || !inv.email} title={inv.email ? '' : 'This customer has no email'}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50">
                      {remindingId === inv.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Send reminder
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )
      )}

      {kpis && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Kpi label="Outstanding" value={money(kpis.outstanding, kpis.currency)} sub={`${kpis.open_count} open`} />
            <Kpi label="Overdue" value={money(kpis.overdue, kpis.currency)} sub={`${kpis.overdue_count} invoice${kpis.overdue_count === 1 ? '' : 's'}`} tone={Number(kpis.overdue) > 0 ? 'rose' : 'slate'} />
            <Kpi label="Collected this month" value={money(kpis.paid_this_month, kpis.currency)} tone="emerald" />
          </div>

          {kpis.top_overdue.length > 0 && (
            <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-700"><AlertTriangle className="h-3.5 w-3.5" /> Biggest overdue</p>
              <ul className="mt-1.5 space-y-1">
                {kpis.top_overdue.map((t, i) => (
                  <li key={i} className="flex items-center justify-between text-[13px] text-slate-700">
                    <span className="truncate">{t.customer}</span>
                    <span className="font-semibold">{money(t.amount, kpis.currency)}</span>
                  </li>
                ))}
              </ul>
              <Link href={`/w/${workspaceId}/accounting/invoices`} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-rose-700 hover:underline">
                Chase these <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          )}

          {bullets.length > 0 && (
            <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-700"><Lightbulb className="h-3.5 w-3.5" /> What I&apos;d do</p>
              <ul className="mt-1.5 space-y-1">
                {bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[13px] text-slate-700"><TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" /> {b}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, sub, tone = 'slate' }: { label: string; value: string; sub?: string; tone?: 'slate' | 'rose' | 'emerald' }) {
  const cls = tone === 'rose' ? 'text-rose-700' : tone === 'emerald' ? 'text-emerald-700' : 'text-slate-900';
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-0.5 text-lg font-bold ${cls}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
    </div>
  );
}
