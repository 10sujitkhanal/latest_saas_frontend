'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bot, Clock, ArrowRight, Sparkles, HelpCircle, AlertTriangle, ShieldCheck } from 'lucide-react';
import { AgentsService, type OrgManagerOverview } from '@/services/agents.service';

/**
 * Owner-dashboard "AI insights" — the Manager's report up to the owner: across
 * every business, what your AI staff has been doing, what's pending, and what
 * needs your approval. Dark card to match the owner dashboard. Hides itself
 * silently if the user can't see agents (no agents.manage).
 */
const STATUS_DOT: Record<string, string> = {
  done: 'bg-emerald-400', success: 'bg-emerald-400',
  pending: 'bg-amber-400', needs_approval: 'bg-amber-400', running: 'bg-sky-400',
  waiting_for_clarification: 'bg-sky-400', partial_success: 'bg-amber-400',
  failed: 'bg-rose-400', cancelled: 'bg-slate-500',
};

function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function OrgAiInsights() {
  const [data, setData] = useState<OrgManagerOverview | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let off = false;
    AgentsService.orgOverview()
      .then((r) => { if (!off) { if (r?.success) setData(r.data); else setHidden(true); } })
      .catch(() => { if (!off) setHidden(true); });
    return () => { off = true; };
  }, []);

  if (hidden || !data) return null;

  return (
    <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/15 border border-emerald-500/20">
            <Bot className="h-5 w-5 text-emerald-400" />
          </span>
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold text-white">AI Staff <Sparkles className="h-3.5 w-3.5 text-emerald-400" /></p>
            <p className="text-xs text-slate-400">{data.headline}</p>
          </div>
        </div>
        <Link href="/ai-staff" className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300">
          Open <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* drafts awaiting approval, per business */}
      {data.businesses.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Needs your approval</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {data.businesses.map((b) => (
              <Link key={b.workspace_id} href={`/w/${b.workspace_id}/ai-staff`}
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-500/20">
                <Clock className="h-3 w-3" /> {b.name} · {b.pending}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* health — cross-business audit rollup */}
      {data.health && data.health.total_issues > 0 && (
        <div className="mt-3">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5" /> Health
          </p>
          <p className="mt-1 text-[13px] text-slate-300">
            <span className={data.health.critical_high ? 'font-semibold text-rose-300' : 'text-slate-300'}>
              {data.health.total_issues} issue{data.health.total_issues === 1 ? '' : 's'}
            </span>
            {data.health.critical_high > 0 && <span className="text-rose-300"> · {data.health.critical_high} high/critical</span>}
            {data.health.fixable_safe > 0 && <span className="text-emerald-300"> · {data.health.fixable_safe} safe-fixable</span>}
            {data.health.fixable_approval > 0 && <span className="text-amber-300"> · {data.health.fixable_approval} need approval</span>}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {data.health.businesses.slice(0, 6).map((b) => (
              <Link key={b.workspace_id} href={`/w/${b.workspace_id}/ai-staff`}
                className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-200 hover:bg-rose-500/20">
                {b.name} · {b.total}{b.critical_high ? ` (${b.critical_high}!)` : ''}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* open questions — the AI paused for an owner answer */}
      {data.questions && data.questions.length > 0 && (
        <div className="mt-3">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <HelpCircle className="h-3.5 w-3.5" /> Open questions
          </p>
          <ul className="mt-1.5 space-y-1.5">
            {data.questions.slice(0, 4).map((q, i) => (
              <li key={i} className="flex items-center gap-2.5 text-[13px]">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
                <span className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold text-slate-300">{q.agent}</span>
                <span className="min-w-0 flex-1 truncate text-slate-300">{q.title}</span>
                {q.business && <span className="hidden shrink-0 text-[11px] text-slate-500 sm:inline">{q.business}</span>}
                <span className="shrink-0 text-[11px] text-slate-600">{ago(q.at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* risks — failed or partial actions */}
      {data.risks && data.risks.length > 0 && (
        <div className="mt-3">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <AlertTriangle className="h-3.5 w-3.5" /> Risks
          </p>
          <ul className="mt-1.5 space-y-1.5">
            {data.risks.slice(0, 4).map((r, i) => (
              <li key={i} className="flex items-center gap-2.5 text-[13px]">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />
                <span className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold text-slate-300">{r.agent}</span>
                <span className="min-w-0 flex-1 truncate text-slate-300">{r.title}</span>
                {r.business && <span className="hidden shrink-0 text-[11px] text-slate-500 sm:inline">{r.business}</span>}
                <span className="shrink-0 text-[11px] text-slate-600">{ago(r.at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* recent cross-business activity */}
      {data.feed.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Recent activity</p>
          <ul className="mt-1.5 space-y-1.5">
            {data.feed.slice(0, 6).map((f, i) => (
              <li key={i} className="flex items-center gap-2.5 text-[13px]">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[f.status] || 'bg-slate-500'}`} />
                <span className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold text-slate-300">{f.agent}</span>
                <span className="min-w-0 flex-1 truncate text-slate-300">{f.title}</span>
                {f.business && <span className="hidden shrink-0 text-[11px] text-slate-500 sm:inline">{f.business}</span>}
                <span className="shrink-0 text-[11px] text-slate-600">{ago(f.at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
