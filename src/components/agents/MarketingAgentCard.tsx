'use client';

import { useState } from 'react';
import { Megaphone, Wand2, Loader2, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { MarketingAgent } from '@/services/agents.service';

const IDEAS = [
  'A weekend promo on our best sellers',
  'Welcome post for new followers',
  'Seasonal / holiday announcement',
];

/**
 * Marketing Agent work surface — drafts a ready-to-publish social/email post for
 * a goal, grounded in real products + brand voice. Draft only; the owner copies
 * or edits. Self-contained for the per-agent AgentShell.
 */
export default function MarketingAgentCard({ workspaceId, embed }: { workspaceId: string | number; embed?: boolean }) {
  const [goal, setGoal] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [post, setPost] = useState('');
  const [copied, setCopied] = useState(false);

  const draft = async (g?: string) => {
    const theGoal = (g ?? goal).trim();
    if (drafting) return;
    setGoal(theGoal);
    setDrafting(true);
    try {
      const r = await MarketingAgent.draft(workspaceId, theGoal);
      if (r.success && r.data?.text) setPost(r.data.text);
      else toast.error(r.message || 'Could not draft a post.');
    } catch (e) {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Could not draft a post right now.');
    } finally {
      setDrafting(false);
    }
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(post); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* no clipboard */ }
  };

  return (
    <div className={embed ? '' : 'mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5 shadow-sm'}>
      <p className={embed ? 'text-sm text-slate-500' : 'mt-1 text-sm text-slate-500'}>
        Describe an occasion and the agent <strong>drafts</strong> a ready-to-publish post from your real
        products + brand voice. You copy, tweak, and post — nothing goes out automatically.
      </p>

      <div className="mt-4">
        <textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={2}
          placeholder="e.g. Announce our new winter wellness bundles"
          className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-400 outline-none focus:border-rose-300" />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {IDEAS.map((g) => (
            <button key={g} type="button" onClick={() => draft(g)} disabled={drafting}
              className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300 hover:border-rose-300 hover:text-rose-300 disabled:opacity-50">{g}</button>
          ))}
          <button type="button" onClick={() => draft()} disabled={drafting}
            className="ml-auto inline-flex items-center gap-2 rounded-full bg-rose-500/150 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-rose-600 disabled:opacity-50">
            {drafting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {drafting ? 'Writing…' : 'Draft a post'}
          </button>
        </div>
      </div>

      {post && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-500/15/40 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-rose-300"><Megaphone className="h-3.5 w-3.5" /> Draft post</span>
            <button type="button" onClick={copy} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white/[0.02] px-2.5 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-500/15">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="whitespace-pre-line text-[13px] text-slate-200">{post}</p>
        </div>
      )}
    </div>
  );
}
