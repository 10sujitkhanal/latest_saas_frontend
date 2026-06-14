'use client';

import { useState, useRef, useEffect } from 'react';
import { Bot, Send, Loader2, Mail, Check, UserPlus, CalendarCheck, Repeat, Banknote, ShieldCheck } from 'lucide-react';
import { AgentsService, CrmAgent, BookingsAgent, BillingAgent, type OverdueInvoice, type FoundBusiness, type BookingDraft, type BillingDraft, type FollowupDraft, type InvoiceDraft, type ExpenseDraft, type AuditFixDraft, type BulkStatusDraft } from '@/services/agents.service';
import { AccountingService } from '@/services/accounting.service';
import { agentModule } from '@/lib/agents/modules';

type Msg = { role: 'user' | 'agent'; text: string; agent?: string | null; overdue?: OverdueInvoice[]; businesses?: FoundBusiness[]; booking?: BookingDraft; billing?: BillingDraft; followup?: FollowupDraft; invoice?: InvoiceDraft; expense?: ExpenseDraft; auditFix?: AuditFixDraft; auditFixable?: number; bulkStatus?: BulkStatusDraft; actionDone?: boolean };

/** Pull the backend's helpful message out of an axios error (e.g. the booking
 *  conflict reason), falling back to a generic line. */
const serverMessage = (e: unknown, fallback: string) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

const EXAMPLES = ["Who's overdue?", 'Draft a post for the weekend', 'Analyse my finances', "How's my loyalty?"];

/**
 * Ask-your-AI-staff chatroom. A plain-language request is routed (backend) to ONE
 * agent's action and run; the reply names the agent that handled it. Read-only /
 * draft / propose only — sends + money changes stay one-click on the agent cards.
 *
 * When `agentType` is set the chat is scoped to that ONE agent (its commands only) —
 * this is the per-agent chat embedded in each agent card.
 */
export default function AgentChat({ workspaceId, onActed, agentType, title, placeholder, examples }: {
  workspaceId: string | number; onActed?: () => void;
  agentType?: string; title?: string; placeholder?: string; examples?: string[];
}) {
  const scoped = !!agentType;
  const exampleChips = examples ?? EXAMPLES;
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [actingIdx, setActingIdx] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Scroll ONLY the chat list to its bottom — never the page (that caused the
  // whole view to jump down on each send).
  useEffect(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight; }, [msgs, busy]);
  // Auto-grow the textarea up to a cap (so Shift+Enter newlines show nicely).
  useEffect(() => { const el = inputRef.current; if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 128) + 'px'; } }, [input]);

  // Approval-in-chat: send a reminder to every overdue invoice that has an email,
  // reusing the same dunning path the Finance card uses.
  const remindAll = async (idx: number, invoices: OverdueInvoice[]) => {
    const targets = invoices.filter((i) => i.email);
    if (!targets.length || actingIdx !== null) return;
    if (!confirm(`Email a payment reminder to ${targets.length} customer${targets.length === 1 ? '' : 's'}?`)) return;
    setActingIdx(idx);
    let sent = 0;
    for (const inv of targets) {
      try { const r = await AccountingService.remindInvoice(workspaceId, inv.id); if (r.success) sent++; } catch { /* skip */ }
    }
    setMsgs((x) => x.map((m, i) => (i === idx ? { ...m, actionDone: true } : m)));
    setMsgs((x) => [...x, { role: 'agent', text: `Sent ${sent} reminder${sent === 1 ? '' : 's'}.${targets.length < invoices.length ? ` (${invoices.length - targets.length} had no email.)` : ''}`, agent: 'finance' }]);
    setActingIdx(null);
    onActed?.();
  };

  // Approval-in-chat: add the found businesses to the pipeline (reuses CRM import).
  const addLeads = async (idx: number, businesses: FoundBusiness[]) => {
    if (!businesses.length || actingIdx !== null) return;
    if (!confirm(`Add ${businesses.length} businesses to your pipeline as leads?`)) return;
    setActingIdx(idx);
    try {
      const r = await CrmAgent.importLeads(workspaceId, businesses);
      setMsgs((x) => x.map((mm, i) => (i === idx ? { ...mm, actionDone: true } : mm)));
      const created = r.success ? (r.data?.created ?? 0) : 0;
      const skipped = r.success ? (r.data?.skipped ?? 0) : 0;
      setMsgs((x) => [...x, { role: 'agent', text: r.success ? `Added ${created} lead${created === 1 ? '' : 's'} to your pipeline${skipped ? ` (${skipped} already there).` : '.'}` : (r.message || 'Could not add them.'), agent: 'crm' }]);
    } catch {
      setMsgs((x) => [...x, { role: 'agent', text: 'Could not add them to the pipeline.', agent: 'crm' }]);
    }
    setActingIdx(null);
    onActed?.();
  };

  // Approval-in-chat: actually create the booking + email the customer.
  const confirmBooking = async (idx: number, draft: BookingDraft) => {
    if (actingIdx !== null) return;
    const notifyTxt = draft.notify && draft.notify.length ? ` and notify ${draft.notify.join(', ')}` : '';
    if (!confirm(`Book a meeting with ${draft.email} on ${draft.pretty || draft.date} and email them it's being arranged${notifyTxt}?`)) return;
    setActingIdx(idx);
    try {
      const r = await BookingsAgent.create(workspaceId, draft);
      setMsgs((x) => x.map((mm, i) => (i === idx ? { ...mm, actionDone: true } : mm)));
      if (r.success && r.data) {
        const d = r.data;
        const note = d.notified ? ` Notified ${d.notified} ${d.notified === 1 ? 'person' : 'people'} ✓` : '';
        const sent = d.email_sent ? `Email${d.has_invite ? ' + calendar invite' : ''} sent ✓` : "Couldn't send the email — check your email settings.";
        setMsgs((x) => [...x, { role: 'agent', agent: 'bookings', text: `Booked ${d.booking_no} for ${d.email} on ${draft.pretty || d.date}. ${sent}${note}` }]);
      } else {
        setMsgs((x) => [...x, { role: 'agent', agent: 'bookings', text: r.message || 'Could not create the booking.' }]);
      }
    } catch (e) {
      setMsgs((x) => [...x, { role: 'agent', agent: 'bookings', text: serverMessage(e, 'Could not create the booking right now.') }]);
    }
    setActingIdx(null);
    onActed?.();
  };

  // Approval-in-chat: set up the recurring schedule (reuses RecurringSchedule).
  const confirmBilling = async (idx: number, draft: BillingDraft) => {
    if (actingIdx !== null) return;
    const label = draft.frequency_label || draft.frequency;
    if (!confirm(`Set up recurring billing: ${draft.currency || ''} ${draft.amount} to ${draft.email} every ${label}?`)) return;
    setActingIdx(idx);
    try {
      const r = await BillingAgent.create(workspaceId, draft);
      setMsgs((x) => x.map((mm, i) => (i === idx ? { ...mm, actionDone: true } : mm)));
      if (r.success && r.data) {
        const d = r.data;
        setMsgs((x) => [...x, { role: 'agent', agent: 'finance', text: `Recurring billing set up — ${d.currency} ${d.amount} to ${d.email} every ${d.frequency_label}. First invoice drafts on ${d.next_run_date}; you review and send each one.` }]);
      } else {
        setMsgs((x) => [...x, { role: 'agent', agent: 'finance', text: r.message || 'Could not set up recurring billing.' }]);
      }
    } catch (e) {
      setMsgs((x) => [...x, { role: 'agent', agent: 'finance', text: serverMessage(e, 'Could not set up recurring billing right now.') }]);
    }
    setActingIdx(null);
    onActed?.();
  };

  // Approval-in-chat: actually send the follow-up email (literal subject/body).
  const confirmFollowup = async (idx: number, draft: FollowupDraft) => {
    if (actingIdx !== null) return;
    if (!confirm(`Send "${draft.subject}" to ${draft.count} recipient(s)? This emails them now.`)) return;
    setActingIdx(idx);
    try {
      const r = await AgentsService.sendFollowup(workspaceId, { recipients: draft.recipients, subject: draft.subject, body: draft.body });
      setMsgs((x) => x.map((m, i) => (i === idx ? { ...m, actionDone: true } : m)));
      const d = r.success ? r.data : null;
      setMsgs((x) => [...x, { role: 'agent', agent: 'crm', text: r.success && d
        ? `Sent to ${d.sent} recipient(s).${d.failed ? ` ${d.failed} failed.` : ''}`
        : (r.message || 'Could not send the follow-up.') }]);
    } catch (e) {
      setMsgs((x) => [...x, { role: 'agent', agent: 'crm', text: serverMessage(e, 'Could not send the follow-up right now.') }]);
    }
    setActingIdx(null);
    onActed?.();
  };

  // Approval-in-chat: create + post the invoice (real GL posting).
  const confirmInvoice = async (idx: number, draft: InvoiceDraft) => {
    if (actingIdx !== null) return;
    if (!confirm(`Create + post an invoice for ${draft.customer} (${draft.currency} ${draft.amount})? It posts to your books.`)) return;
    setActingIdx(idx);
    try {
      const r = await AgentsService.createInvoice(workspaceId, { customer: draft.customer, amount: draft.amount, description: draft.description });
      setMsgs((x) => x.map((m, i) => (i === idx ? { ...m, actionDone: true } : m)));
      setMsgs((x) => [...x, { role: 'agent', agent: 'finance', text: r.success ? (r.message || 'Invoice created.') : (r.message || 'Could not create the invoice.') }]);
    } catch (e) {
      setMsgs((x) => [...x, { role: 'agent', agent: 'finance', text: serverMessage(e, 'Could not create the invoice right now.') }]);
    }
    setActingIdx(null);
    onActed?.();
  };

  // Approval-in-chat: record + post the expense (real GL posting).
  const confirmExpense = async (idx: number, draft: ExpenseDraft) => {
    if (actingIdx !== null) return;
    if (!confirm(`Record + post this expense (${draft.currency} ${draft.amount}${draft.title ? ` — ${draft.title}` : ''})? It posts to your books.`)) return;
    setActingIdx(idx);
    try {
      const r = await AgentsService.recordExpense(workspaceId, { amount: draft.amount, title: draft.title });
      setMsgs((x) => x.map((m, i) => (i === idx ? { ...m, actionDone: true } : m)));
      setMsgs((x) => [...x, { role: 'agent', agent: 'finance', text: r.success ? (r.message || 'Expense recorded.') : (r.message || 'Could not record the expense.') }]);
    } catch (e) {
      setMsgs((x) => [...x, { role: 'agent', agent: 'finance', text: serverMessage(e, 'Could not record the expense right now.') }]);
    }
    setActingIdx(null);
    onActed?.();
  };

  // Approval-in-chat: move many leads to a status at once.
  const confirmBulkStatus = async (idx: number, draft: BulkStatusDraft) => {
    if (actingIdx !== null) return;
    if (!confirm(`Move ${draft.count} lead(s) to "${draft.to_status}"?`)) return;
    setActingIdx(idx);
    try {
      const r = await AgentsService.bulkSetStatus(workspaceId, { to_status: draft.to_status, from_status: draft.from_status });
      setMsgs((x) => x.map((m, i) => (i === idx ? { ...m, actionDone: true } : m)));
      setMsgs((x) => [...x, { role: 'agent', agent: 'crm', text: r.success ? (r.message || 'Leads updated.') : (r.message || 'Could not update the leads.') }]);
    } catch (e) {
      setMsgs((x) => [...x, { role: 'agent', agent: 'crm', text: serverMessage(e, 'Could not update the leads right now.') }]);
    }
    setActingIdx(null);
    onActed?.();
  };

  // Approval-in-chat: apply the audit engine's fixes (safe repairs + ledger re-posts).
  const confirmAuditFix = async (idx: number, draft: AuditFixDraft) => {
    if (actingIdx !== null) return;
    if (!confirm(`Apply ${draft.total} audit fix(es)? ${draft.approval} will re-post missing ledger entries.`)) return;
    setActingIdx(idx);
    try {
      const r = await AgentsService.auditFix(workspaceId, { scope: 'all' });
      setMsgs((x) => x.map((m, i) => (i === idx ? { ...m, actionDone: true } : m)));
      setMsgs((x) => [...x, { role: 'agent', agent: 'manager', text: r.success ? (r.message || 'Fixes applied.') : (r.message || 'Could not apply the fixes.') }]);
    } catch (e) {
      setMsgs((x) => [...x, { role: 'agent', agent: 'manager', text: serverMessage(e, 'Could not apply the fixes right now.') }]);
    }
    setActingIdx(null);
    onActed?.();
  };

  const send = async (text?: string) => {
    const m = (text ?? input).trim();
    if (!m || busy) return;
    setInput('');
    setMsgs((x) => [...x, { role: 'user', text: m }]);
    setBusy(true);
    try {
      const r = await AgentsService.chat(workspaceId, m, agentType);
      if (r.success && r.data) {
        const d = r.data;
        const overdue = d.command === 'finance_overdue'
          ? ((d.data as { invoices?: OverdueInvoice[] } | undefined)?.invoices || []).filter((i) => i.email)
          : undefined;
        const businesses = d.command === 'crm_find'
          ? ((d.data as { businesses?: FoundBusiness[] } | undefined)?.businesses || [])
          : undefined;
        const booking = d.command === 'bookings_create'
          ? (d.data as { draft?: BookingDraft } | undefined)?.draft
          : undefined;
        const billing = d.command === 'billing_create'
          ? (d.data as { billing?: BillingDraft } | undefined)?.billing
          : undefined;
        const followup = d.command === 'crm_send_followup'
          ? (d.data as { followup?: FollowupDraft } | undefined)?.followup
          : undefined;
        const invoice = d.command === 'finance_create_invoice'
          ? (d.data as { invoice?: InvoiceDraft } | undefined)?.invoice
          : undefined;
        const expense = d.command === 'finance_record_expense'
          ? (d.data as { expense?: ExpenseDraft } | undefined)?.expense
          : undefined;
        const auditFix = d.command === 'audit_fix'
          ? (d.data as { audit_fix?: AuditFixDraft } | undefined)?.audit_fix
          : undefined;
        const bulkStatus = d.command === 'crm_bulk_set_status'
          ? (d.data as { bulk_status?: BulkStatusDraft } | undefined)?.bulk_status
          : undefined;
        const audit = d.command === 'audit_run'
          ? (d.data as { audit?: { fixable_safe: number; fixable_approval: number } } | undefined)?.audit
          : undefined;
        const auditFixable = audit ? (audit.fixable_safe + audit.fixable_approval) : 0;
        setMsgs((x) => [...x, {
          role: 'agent', text: d.reply, agent: d.agent,
          overdue: overdue && overdue.length ? overdue : undefined,
          businesses: businesses && businesses.length ? businesses : undefined,
          booking: booking && booking.email ? booking : undefined,
          billing: billing && billing.email && billing.amount ? billing : undefined,
          followup: followup && followup.count ? followup : undefined,
          invoice: invoice && invoice.customer && invoice.amount ? invoice : undefined,
          expense: expense && expense.amount ? expense : undefined,
          auditFix: auditFix && auditFix.total ? auditFix : undefined,
          auditFixable: auditFixable || undefined,
          bulkStatus: bulkStatus && bulkStatus.count ? bulkStatus : undefined,
        }]);
        onActed?.();
      } else {
        setMsgs((x) => [...x, { role: 'agent', text: r.message || 'Something went wrong.' }]);
      }
    } catch {
      setMsgs((x) => [...x, { role: 'agent', text: 'Could not reach your AI staff right now.' }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-emerald-200 bg-gradient-to-b from-emerald-50/50 to-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Bot className="h-4 w-4 text-emerald-600" />
        <h2 className="text-sm font-semibold text-slate-900">{title || 'Ask your AI staff'}</h2>
        <span className="ml-auto hidden text-[11px] text-slate-400 sm:block">
          {scoped ? 'Talk to this agent directly' : 'Type a task — it routes to the right agent'}
        </span>
      </div>

      {msgs.length > 0 && (
        <div ref={listRef} className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
          {msgs.map((m, i) => m.role === 'user' ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-emerald-600 px-3 py-2 text-sm text-white">{m.text}</div>
            </div>
          ) : (
            <div key={i} className="flex items-start gap-2">
              {(() => {
                const meta = m.agent ? agentModule(m.agent) : null;
                return (
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg ${meta?.chip || 'bg-slate-100 text-slate-500'}`}>
                    {meta ? <meta.Icon className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                  </span>
                );
              })()}
              <div className="max-w-[85%]">
                <div className="whitespace-pre-line rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200">{m.text}</div>
                {m.overdue && m.overdue.length > 0 && (
                  m.actionDone ? (
                    <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><Check className="h-3.5 w-3.5" /> Reminders sent</span>
                  ) : (
                    <button type="button" onClick={() => remindAll(i, m.overdue!)} disabled={actingIdx === i}
                      className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50">
                      {actingIdx === i ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                      {actingIdx === i ? 'Sending…' : `Send reminders to all (${m.overdue.length})`}
                    </button>
                  )
                )}
                {m.businesses && m.businesses.length > 0 && (
                  m.actionDone ? (
                    <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><Check className="h-3.5 w-3.5" /> Added to pipeline</span>
                  ) : (
                    <button type="button" onClick={() => addLeads(i, m.businesses!)} disabled={actingIdx === i}
                      className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                      {actingIdx === i ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                      {actingIdx === i ? 'Adding…' : `Add ${m.businesses.length} to pipeline`}
                    </button>
                  )
                )}
                {m.booking && (
                  m.actionDone ? (
                    <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><Check className="h-3.5 w-3.5" /> Booked & emailed</span>
                  ) : (
                    <button type="button" onClick={() => confirmBooking(i, m.booking!)} disabled={actingIdx === i}
                      className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                      {actingIdx === i ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarCheck className="h-3.5 w-3.5" />}
                      {actingIdx === i ? 'Booking…' : 'Confirm booking & email'}
                    </button>
                  )
                )}
                {m.billing && (
                  m.actionDone ? (
                    <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><Check className="h-3.5 w-3.5" /> Recurring billing set up</span>
                  ) : (
                    <button type="button" onClick={() => confirmBilling(i, m.billing!)} disabled={actingIdx === i}
                      className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50">
                      {actingIdx === i ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Repeat className="h-3.5 w-3.5" />}
                      {actingIdx === i ? 'Setting up…' : 'Set up recurring billing'}
                    </button>
                  )
                )}
                {m.followup && (
                  m.actionDone ? (
                    <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><Check className="h-3.5 w-3.5" /> Follow-up sent</span>
                  ) : (
                    <button type="button" onClick={() => confirmFollowup(i, m.followup!)} disabled={actingIdx === i}
                      className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                      {actingIdx === i ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                      {actingIdx === i ? 'Sending…' : `Confirm & send (${m.followup.count})`}
                    </button>
                  )
                )}
                {m.invoice && (
                  m.actionDone ? (
                    <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><Check className="h-3.5 w-3.5" /> Invoice created &amp; posted</span>
                  ) : (
                    <button type="button" onClick={() => confirmInvoice(i, m.invoice!)} disabled={actingIdx === i}
                      className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50">
                      {actingIdx === i ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Banknote className="h-3.5 w-3.5" />}
                      {actingIdx === i ? 'Creating…' : `Confirm & create invoice (${m.invoice.currency} ${m.invoice.amount})`}
                    </button>
                  )
                )}
                {m.expense && (
                  m.actionDone ? (
                    <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><Check className="h-3.5 w-3.5" /> Expense recorded &amp; posted</span>
                  ) : (
                    <button type="button" onClick={() => confirmExpense(i, m.expense!)} disabled={actingIdx === i}
                      className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50">
                      {actingIdx === i ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Banknote className="h-3.5 w-3.5" />}
                      {actingIdx === i ? 'Recording…' : `Confirm & record expense (${m.expense.currency} ${m.expense.amount})`}
                    </button>
                  )
                )}
                {m.bulkStatus && (
                  m.actionDone ? (
                    <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><Check className="h-3.5 w-3.5" /> Leads updated</span>
                  ) : (
                    <button type="button" onClick={() => confirmBulkStatus(i, m.bulkStatus!)} disabled={actingIdx === i}
                      className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                      {actingIdx === i ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      {actingIdx === i ? 'Updating…' : `Confirm & move ${m.bulkStatus.count} to ${m.bulkStatus.to_status}`}
                    </button>
                  )
                )}
                {m.auditFixable && !m.auditFix && (
                  <button type="button" onClick={() => send('fix the issues')} disabled={busy}
                    className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                    <ShieldCheck className="h-3.5 w-3.5" /> Fix the issues ({m.auditFixable}) →
                  </button>
                )}
                {m.auditFix && (
                  m.actionDone ? (
                    <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><Check className="h-3.5 w-3.5" /> Fixes applied</span>
                  ) : (
                    <button type="button" onClick={() => confirmAuditFix(i, m.auditFix!)} disabled={actingIdx === i}
                      className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                      {actingIdx === i ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                      {actingIdx === i ? 'Fixing…' : `Confirm & fix (${m.auditFix.total})`}
                    </button>
                  )
                )}
              </div>
            </div>
          ))}
          {busy && <div className="flex items-center gap-2 pl-8 text-xs text-slate-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Working…</div>}
        </div>
      )}

      {msgs.length === 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {exampleChips.map((e) => (
            <button key={e} type="button" onClick={() => send(e)} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600 hover:border-emerald-300 hover:text-emerald-700">{e}</button>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-end gap-2">
        <textarea ref={inputRef} value={input} rows={1} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={placeholder || "e.g. who's overdue? · draft a post · analyse my finances    (Enter to send · Shift+Enter for a new line)"}
          className="min-h-[40px] max-h-32 min-w-0 flex-1 resize-none overflow-y-auto rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-300" />
        <button type="button" onClick={() => send()} disabled={busy || !input.trim()}
          className="inline-flex h-[40px] shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send
        </button>
      </div>
    </div>
  );
}
