'use client';

import { useState, useEffect, useCallback, use as reactUse } from 'react';
import Link from 'next/link';
import {
  Sparkles, Tag, Wand2, Check, X, ArrowRight, Loader2, Bot, Clock, CheckCircle2, XCircle, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { AgentsService, type OfferProposal, type AgentTask } from '@/services/agents.service';

/**
 * AI Staff — your AI team. Each agent drafts work; you approve it. Every
 * proposal + decision is recorded (the queue below) so agents behave like
 * real, auditable staff. Slice 1: the Offers Agent.
 */

const EXAMPLE_GOALS = [
  'A spring promo, 15% off our best sellers',
  'Free delivery this weekend to boost orders',
  'Welcome offer for first-time customers',
];

const STATUS_META: Record<AgentTask['status'], { label: string; cls: string; Icon: typeof Clock }> = {
  proposed: { label: 'Awaiting you', cls: 'bg-amber-50 text-amber-700', Icon: Clock },
  executed: { label: 'Created', cls: 'bg-emerald-50 text-emerald-700', Icon: CheckCircle2 },
  rejected: { label: 'Rejected', cls: 'bg-slate-100 text-slate-500', Icon: XCircle },
  failed: { label: 'Failed', cls: 'bg-rose-50 text-rose-700', Icon: AlertTriangle },
};

export default function AiStaffPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: workspaceId } = reactUse(params);

  const [goal, setGoal] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [activeTask, setActiveTask] = useState<AgentTask | null>(null);
  const [proposal, setProposal] = useState<OfferProposal | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [tasks, setTasks] = useState<AgentTask[]>([]);

  const loadTasks = useCallback(async () => {
    try {
      const res = await AgentsService.listTasks(workspaceId);
      if (res.success) setTasks(res.data || []);
    } catch { /* non-fatal */ }
  }, [workspaceId]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const review = (task: AgentTask) => {
    setActiveTask(task);
    setProposal({ ...task.proposal });
  };

  const draft = async (g?: string) => {
    const theGoal = (g ?? goal).trim();
    if (!theGoal || drafting) return;
    setGoal(theGoal);
    setDrafting(true);
    try {
      const res = await AgentsService.draftOffer(workspaceId, theGoal);
      if (res.success && res.data?.task) {
        review(res.data.task);
        setGoal('');
        loadTasks();
      } else {
        toast.error(res.message || 'The agent could not draft an offer.');
      }
    } catch (e) {
      toast.error(errMsg(e) || 'The agent could not draft an offer right now.');
    } finally {
      setDrafting(false);
    }
  };

  const patch = (k: keyof OfferProposal, v: OfferProposal[keyof OfferProposal]) =>
    setProposal((p) => (p ? { ...p, [k]: v } : p));

  const approve = async () => {
    if (!activeTask || !proposal || busyId) return;
    setBusyId(activeTask.id);
    try {
      const res = await AgentsService.approveTask(workspaceId, activeTask.id, proposal);
      if (res.success) {
        toast.success('Draft offer created — review and publish it on Deals.');
        setActiveTask(null);
        setProposal(null);
        loadTasks();
      } else {
        toast.error(res.message || 'Could not create the offer.');
      }
    } catch (e) {
      toast.error(errMsg(e) || 'Could not create the offer.');
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (task: AgentTask) => {
    if (busyId) return;
    setBusyId(task.id);
    try {
      await AgentsService.rejectTask(workspaceId, task.id);
      if (activeTask?.id === task.id) { setActiveTask(null); setProposal(null); }
      loadTasks();
    } catch (e) {
      toast.error(errMsg(e) || 'Could not reject.');
    } finally {
      setBusyId(null);
    }
  };

  const pendingCount = tasks.filter((t) => t.status === 'proposed').length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow">
          <Bot className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">AI Staff</h1>
          <p className="text-sm text-slate-500">Your AI team drafts the work — you approve it. Every decision is logged.</p>
        </div>
      </div>

      {/* Offers Agent */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Tag className="h-5 w-5 text-violet-600" />
          <h2 className="text-base font-semibold text-slate-900">Offers Agent</h2>
          <span className="ml-auto rounded-full bg-violet-50 px-2.5 py-0.5 text-[11px] font-semibold text-violet-700">
            drafts → you approve
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Describe a promotion in plain words. The agent drafts it from your products and brand voice;
          you review and approve. Approved offers are created as <strong>drafts</strong> you publish on Deals.
        </p>

        {/* Goal input */}
        <div className="mt-4">
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="e.g. A 20% spring offer on our protein snacks for two weeks"
            rows={2}
            className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-violet-300"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {EXAMPLE_GOALS.map((g) => (
              <button key={g} type="button" onClick={() => draft(g)} disabled={drafting}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:border-violet-300 hover:text-violet-700 disabled:opacity-50">
                {g}
              </button>
            ))}
            <button type="button" onClick={() => draft()} disabled={drafting || !goal.trim()}
              className="ml-auto inline-flex items-center gap-2 rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-violet-700 disabled:opacity-50">
              {drafting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {drafting ? 'Drafting…' : 'Draft offer'}
            </button>
          </div>
        </div>

        {/* Active proposal (editable) */}
        {proposal && activeTask && (
          <div className="mt-5 rounded-xl border border-violet-200 bg-violet-50/40 p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-violet-700">
              <Sparkles className="h-3.5 w-3.5" /> Proposed offer — edit anything, then approve
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Title" full>
                <input className={inputCls} value={proposal.title} onChange={(e) => patch('title', e.target.value)} />
              </Field>
              <Field label="Code">
                <input className={`${inputCls} font-mono uppercase`} value={proposal.code}
                  onChange={(e) => patch('code', e.target.value.toUpperCase())} />
              </Field>
              <Field label="Type">
                <select className={inputCls} value={proposal.type}
                  onChange={(e) => patch('type', e.target.value as OfferProposal['type'])}>
                  <option value="percent">% off</option>
                  <option value="flat">Amount off</option>
                  <option value="free_delivery">Free delivery</option>
                </select>
              </Field>
              <Field label={proposal.type === 'percent' ? 'Percent (%)' : `Amount (${proposal.currency})`}>
                <input type="number" min={0} className={inputCls} value={proposal.value}
                  disabled={proposal.type === 'free_delivery'} onChange={(e) => patch('value', Number(e.target.value))} />
              </Field>
              <Field label={`Min order (${proposal.currency})`}>
                <input type="number" min={0} className={inputCls} value={proposal.min_order_amount}
                  onChange={(e) => patch('min_order_amount', Number(e.target.value))} />
              </Field>
              <Field label="Runs for (days)">
                <input type="number" min={1} className={inputCls} value={proposal.duration_days}
                  onChange={(e) => patch('duration_days', Number(e.target.value))} />
              </Field>
              <Field label="Customer description" full>
                <input className={inputCls} value={proposal.description} onChange={(e) => patch('description', e.target.value)} />
              </Field>
              <Field label="Marketing copy (for your post)" full>
                <textarea rows={2} className={`${inputCls} resize-none`} value={proposal.marketing_copy}
                  onChange={(e) => patch('marketing_copy', e.target.value)} />
              </Field>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button type="button" onClick={() => reject(activeTask)} disabled={busyId === activeTask.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                <X className="h-4 w-4" /> Reject
              </button>
              <button type="button" onClick={approve} disabled={busyId === activeTask.id}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-50">
                {busyId === activeTask.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {busyId === activeTask.id ? 'Creating…' : 'Approve & create draft'}
              </button>
            </div>
            <p className="mt-1 text-right text-[11px] text-slate-400">Created paused — nothing goes live until you publish it.</p>
          </div>
        )}
      </div>

      {/* Task queue / audit trail */}
      <div className="mt-6">
        <div className="mb-2 flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-700">Activity</h3>
          {pendingCount > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
              {pendingCount} awaiting you
            </span>
          )}
        </div>
        {tasks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-center text-sm text-slate-400">
            No agent activity yet. Give the Offers Agent a goal above.
          </p>
        ) : (
          <ul className="space-y-2">
            {tasks.map((t) => {
              const m = STATUS_META[t.status];
              return (
                <li key={t.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <m.Icon className={`h-4 w-4 ${m.cls.split(' ')[1]}`} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-800">{t.title || t.goal || 'Offer'}</div>
                    <div className="truncate text-xs text-slate-400">
                      {t.goal}{t.result?.code ? ` · ${t.result.code}` : ''}
                    </div>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${m.cls}`}>{m.label}</span>
                  {t.status === 'proposed' && (
                    <button type="button" onClick={() => review(t)}
                      className="rounded-full border border-violet-200 px-3 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-50">
                      Review
                    </button>
                  )}
                  {t.status === 'executed' && (
                    <Link href={`/w/${workspaceId}/deals`} className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline">
                      Deals <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Coming-soon roster — the rest of the AI staff */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {['Booking agent', 'CRM agent', 'Data-entry agent', 'Storefront agent'].map((n) => (
          <div key={n} className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-3 py-3 text-center">
            <div className="text-sm font-semibold text-slate-500">{n}</div>
            <div className="text-[11px] text-slate-400">coming soon</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-violet-300';

function errMsg(e: unknown): string | undefined {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`block ${full ? 'col-span-2' : ''}`}>
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}
