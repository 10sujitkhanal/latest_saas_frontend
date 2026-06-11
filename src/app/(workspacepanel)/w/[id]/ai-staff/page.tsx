'use client';

import { useState, use as reactUse } from 'react';
import Link from 'next/link';
import { Sparkles, Tag, Wand2, Check, X, ArrowRight, Loader2, Bot } from 'lucide-react';
import { toast } from 'sonner';
import { AgentsService, type OfferProposal } from '@/services/agents.service';

/**
 * AI Staff — your AI team. Each agent drafts work; you approve it.
 * Slice 1: the Offers Agent (drafts a storefront promotion, you approve →
 * it's created as a DRAFT coupon you publish on Deals).
 */

const EXAMPLE_GOALS = [
  'A spring promo, 15% off our best sellers',
  'Free delivery this weekend to boost orders',
  'Welcome offer for first-time customers',
];

const TYPE_LABEL: Record<OfferProposal['type'], string> = {
  percent: '% off',
  flat: 'amount off',
  free_delivery: 'Free delivery',
};

export default function AiStaffPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: workspaceId } = reactUse(params);

  const [goal, setGoal] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [proposal, setProposal] = useState<OfferProposal | null>(null);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ code: string } | null>(null);

  const draft = async (g?: string) => {
    const theGoal = (g ?? goal).trim();
    if (!theGoal || drafting) return;
    setGoal(theGoal);
    setDrafting(true);
    setProposal(null);
    setCreated(null);
    try {
      const res = await AgentsService.draftOffer(workspaceId, theGoal);
      if (res.success && res.data?.proposal) {
        setProposal(res.data.proposal);
      } else {
        toast.error(res.message || 'The agent could not draft an offer.');
      }
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'The agent could not draft an offer right now.');
    } finally {
      setDrafting(false);
    }
  };

  const patch = (k: keyof OfferProposal, v: OfferProposal[keyof OfferProposal]) =>
    setProposal((p) => (p ? { ...p, [k]: v } : p));

  const create = async () => {
    if (!proposal || creating) return;
    setCreating(true);
    try {
      const res = await AgentsService.createOffer(workspaceId, proposal);
      if (res.success) {
        setCreated({ code: proposal.code });
        setProposal(null);
        setGoal('');
        toast.success('Draft offer created — review and publish it on Deals.');
      } else {
        toast.error(res.message || 'Could not create the offer.');
      }
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Could not create the offer.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow">
          <Bot className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">AI Staff</h1>
          <p className="text-sm text-slate-500">Your AI team drafts the work — you approve it.</p>
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
              <button
                key={g}
                type="button"
                onClick={() => draft(g)}
                disabled={drafting}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:border-violet-300 hover:text-violet-700 disabled:opacity-50"
              >
                {g}
              </button>
            ))}
            <button
              type="button"
              onClick={() => draft()}
              disabled={drafting || !goal.trim()}
              className="ml-auto inline-flex items-center gap-2 rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-violet-700 disabled:opacity-50"
            >
              {drafting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {drafting ? 'Drafting…' : 'Draft offer'}
            </button>
          </div>
        </div>

        {/* Created confirmation */}
        {created && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <Check className="h-4 w-4" />
            <span>Draft offer <strong>{created.code}</strong> created.</span>
            <Link href={`/w/${workspaceId}/deals`} className="ml-auto inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline">
              Review &amp; publish on Deals <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

        {/* Proposal (editable) */}
        {proposal && (
          <div className="mt-5 rounded-xl border border-violet-200 bg-violet-50/40 p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-violet-700">
              <Sparkles className="h-3.5 w-3.5" /> Proposed offer — edit anything, then approve
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Title" full>
                <input className={inputCls} value={proposal.title}
                  onChange={(e) => patch('title', e.target.value)} />
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
                <input type="number" min={0} className={inputCls}
                  value={proposal.value}
                  disabled={proposal.type === 'free_delivery'}
                  onChange={(e) => patch('value', Number(e.target.value))} />
              </Field>
              <Field label={`Min order (${proposal.currency})`}>
                <input type="number" min={0} className={inputCls}
                  value={proposal.min_order_amount}
                  onChange={(e) => patch('min_order_amount', Number(e.target.value))} />
              </Field>
              <Field label="Runs for (days)">
                <input type="number" min={1} className={inputCls}
                  value={proposal.duration_days}
                  onChange={(e) => patch('duration_days', Number(e.target.value))} />
              </Field>
              <Field label="Customer description" full>
                <input className={inputCls} value={proposal.description}
                  onChange={(e) => patch('description', e.target.value)} />
              </Field>
              <Field label="Marketing copy (for your post)" full>
                <textarea rows={2} className={`${inputCls} resize-none`} value={proposal.marketing_copy}
                  onChange={(e) => patch('marketing_copy', e.target.value)} />
              </Field>
              {proposal.applicable_categories.length > 0 && (
                <Field label="Applies to" full>
                  <div className="flex flex-wrap gap-1.5">
                    {proposal.applicable_categories.map((c) => (
                      <span key={c} className="rounded-full bg-white px-2.5 py-0.5 text-xs text-slate-600 ring-1 ring-slate-200">{c}</span>
                    ))}
                  </div>
                </Field>
              )}
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setProposal(null)}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                <X className="h-4 w-4" /> Discard
              </button>
              <button type="button" onClick={create} disabled={creating}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-50">
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {creating ? 'Creating…' : 'Approve & create draft'}
              </button>
            </div>
            <p className="mt-1 text-right text-[11px] text-slate-400">
              {TYPE_LABEL[proposal.type]} · created paused — nothing goes live until you publish it.
            </p>
          </div>
        )}
      </div>

      {/* Coming-soon roster — signals the bigger AI-staff vision */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
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

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`block ${full ? 'col-span-2' : ''}`}>
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}
