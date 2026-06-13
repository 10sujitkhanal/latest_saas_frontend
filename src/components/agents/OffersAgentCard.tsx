'use client';

import { useState } from 'react';
import { Sparkles, Wand2, Check, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { AgentsService, type OfferProposal, type AgentTask } from '@/services/agents.service';

const EXAMPLE_GOALS = [
  'A spring promo, 15% off our best sellers',
  'Free delivery this weekend to boost orders',
  'Welcome offer for first-time customers',
];

/**
 * Offers Agent work surface. Describe a promotion → the agent drafts it from your
 * products + brand voice → you edit + approve → it's created as a draft coupon you
 * publish on Deals. Self-contained so it can render inside a per-agent card.
 * ``onChanged`` lets the parent refresh its shared Activity log.
 */
export default function OffersAgentCard({ workspaceId, embed, onChanged }: {
  workspaceId: string | number; embed?: boolean; onChanged?: () => void;
}) {
  const [goal, setGoal] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [activeTask, setActiveTask] = useState<AgentTask | null>(null);
  const [proposal, setProposal] = useState<OfferProposal | null>(null);
  const [busy, setBusy] = useState(false);

  const patch = (k: keyof OfferProposal, v: OfferProposal[keyof OfferProposal]) =>
    setProposal((p) => (p ? { ...p, [k]: v } : p));

  const draft = async (g?: string) => {
    const theGoal = (g ?? goal).trim();
    if (!theGoal || drafting) return;
    setGoal(theGoal);
    setDrafting(true);
    try {
      const res = await AgentsService.draftOffer(workspaceId, theGoal);
      if (res.success && res.data?.task) {
        setActiveTask(res.data.task);
        setProposal({ ...res.data.task.proposal });
        setGoal('');
        onChanged?.();
      } else toast.error(res.message || 'The agent could not draft an offer.');
    } catch (e) {
      toast.error(errMsg(e) || 'The agent could not draft an offer right now.');
    } finally {
      setDrafting(false);
    }
  };

  const approve = async () => {
    if (!activeTask || !proposal || busy) return;
    setBusy(true);
    try {
      const res = await AgentsService.approveTask(workspaceId, activeTask.id, proposal);
      if (res.success) {
        toast.success('Draft offer created — review and publish it on Deals.');
        setActiveTask(null); setProposal(null); onChanged?.();
      } else toast.error(res.message || 'Could not create the offer.');
    } catch (e) {
      toast.error(errMsg(e) || 'Could not create the offer.');
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (!activeTask || busy) return;
    setBusy(true);
    try {
      await AgentsService.rejectTask(workspaceId, activeTask.id);
      setActiveTask(null); setProposal(null); onChanged?.();
    } catch (e) {
      toast.error(errMsg(e) || 'Could not reject.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={embed ? '' : 'mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm'}>
      {!embed && (
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold text-slate-900">Offers Agent</span>
        </div>
      )}
      <p className={embed ? 'text-sm text-slate-500' : 'mt-1 text-sm text-slate-500'}>
        Describe a promotion in plain words. The agent drafts it from your products and brand voice;
        you review and approve. Approved offers are created as <strong>drafts</strong> you publish on Deals.
      </p>

      <div className="mt-4">
        <textarea value={goal} onChange={(e) => setGoal(e.target.value)}
          placeholder="e.g. A 20% spring offer on our protein snacks for two weeks" rows={2}
          className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-violet-300" />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {EXAMPLE_GOALS.map((g) => (
            <button key={g} type="button" onClick={() => draft(g)} disabled={drafting}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:border-violet-300 hover:text-violet-700 disabled:opacity-50">{g}</button>
          ))}
          <button type="button" onClick={() => draft()} disabled={drafting || !goal.trim()}
            className="ml-auto inline-flex items-center gap-2 rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-violet-700 disabled:opacity-50">
            {drafting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {drafting ? 'Drafting…' : 'Draft offer'}
          </button>
        </div>
      </div>

      {proposal && activeTask && (
        <div className="mt-5 rounded-xl border border-violet-200 bg-violet-50/40 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-violet-700">
            <Sparkles className="h-3.5 w-3.5" /> Proposed offer — edit anything, then approve
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Title" full><input className={inputCls} value={proposal.title} onChange={(e) => patch('title', e.target.value)} /></Field>
            <Field label="Code"><input className={`${inputCls} font-mono uppercase`} value={proposal.code} onChange={(e) => patch('code', e.target.value.toUpperCase())} /></Field>
            <Field label="Type">
              <select className={inputCls} value={proposal.type} onChange={(e) => patch('type', e.target.value as OfferProposal['type'])}>
                <option value="percent">% off</option><option value="flat">Amount off</option><option value="free_delivery">Free delivery</option>
              </select>
            </Field>
            <Field label={proposal.type === 'percent' ? 'Percent (%)' : `Amount (${proposal.currency})`}>
              <input type="number" min={0} className={inputCls} value={proposal.value} disabled={proposal.type === 'free_delivery'} onChange={(e) => patch('value', Number(e.target.value))} />
            </Field>
            <Field label={`Min order (${proposal.currency})`}><input type="number" min={0} className={inputCls} value={proposal.min_order_amount} onChange={(e) => patch('min_order_amount', Number(e.target.value))} /></Field>
            <Field label="Runs for (days)"><input type="number" min={1} className={inputCls} value={proposal.duration_days} onChange={(e) => patch('duration_days', Number(e.target.value))} /></Field>
            <Field label="Customer description" full><input className={inputCls} value={proposal.description} onChange={(e) => patch('description', e.target.value)} /></Field>
            <Field label="Marketing copy (for your post)" full><textarea rows={2} className={`${inputCls} resize-none`} value={proposal.marketing_copy} onChange={(e) => patch('marketing_copy', e.target.value)} /></Field>
          </div>
          <div className="mt-4 flex items-center justify-end gap-2">
            <button type="button" onClick={reject} disabled={busy} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"><X className="h-4 w-4" /> Reject</button>
            <button type="button" onClick={approve} disabled={busy} className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {busy ? 'Creating…' : 'Approve & create draft'}
            </button>
          </div>
          <p className="mt-1 text-right text-[11px] text-slate-400">Created paused — nothing goes live until you publish it.</p>
        </div>
      )}
    </div>
  );
}

const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-violet-300';

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
