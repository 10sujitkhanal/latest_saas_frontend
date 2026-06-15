'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Bot, Clock, ArrowRight, Sparkles, HelpCircle, AlertTriangle, ShieldCheck, CheckCircle2, Activity } from 'lucide-react';
import { AgentsService, type OrgManagerOverview } from '@/services/agents.service';

/**
 * Owner-dashboard "AI Staff" card — a calm command center, not a wall of logs.
 * Two lists only: what NEEDS the owner (approvals + risks + health + questions,
 * merged & prioritised) and a short RECENT ACTIVITY feed. Hides itself silently
 * when the user can't see agents.
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

type Need = {
  kind: 'approval' | 'risk' | 'health' | 'question';
  prio: number;
  Icon: typeof Clock; tone: string;
  title: string; meta: string; at: string; link: string;
};

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

  // Merge everything that wants the owner's attention into ONE prioritised list.
  const needs = useMemo<Need[]>(() => {
    if (!data) return [];
    const out: Need[] = [];
    for (const b of data.businesses || []) {
      if (b.pending > 0) {
        out.push({ kind: 'approval', prio: 0, Icon: Clock, tone: 'text-amber-300',
          title: `${b.pending} draft${b.pending === 1 ? '' : 's'} awaiting approval`,
          meta: b.name, at: '', link: `/w/${b.workspace_id}/ai-staff` });
      }
    }
    for (const r of data.risks || []) {
      out.push({ kind: 'risk', prio: 1, Icon: AlertTriangle, tone: 'text-rose-300',
        title: r.title, meta: `${r.agent}${r.business ? ' · ' + r.business : ''}`, at: r.at,
        link: `/w/${r.workspace_id}/ai-staff` });
    }
    if (data.health && data.health.total_issues > 0) {
      const h = data.health;
      const bits = [
        h.critical_high ? `${h.critical_high} high` : '',
        h.fixable_safe ? `${h.fixable_safe} safe-fix` : '',
        h.fixable_approval ? `${h.fixable_approval} need approval` : '',
      ].filter(Boolean).join(' · ');
      out.push({ kind: 'health', prio: 2, Icon: ShieldCheck, tone: 'text-amber-300',
        title: `${h.total_issues} book/data issue${h.total_issues === 1 ? '' : 's'} found`,
        meta: bits || 'across your businesses', at: '', link: '/ai-staff' });
    }
    for (const q of data.questions || []) {
      out.push({ kind: 'question', prio: 3, Icon: HelpCircle, tone: 'text-sky-300',
        title: q.title, meta: `${q.agent}${q.business ? ' · ' + q.business : ''}`, at: q.at,
        link: `/w/${q.workspace_id}/ai-staff` });
    }
    return out.sort((a, b) => a.prio - b.prio || (b.at || '').localeCompare(a.at || ''));
  }, [data]);

  if (hidden || !data) return null;

  const shownNeeds = needs.slice(0, 6);
  const feed = (data.feed || []).slice(0, 5);

  return (
    <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-4 sm:p-5">
      {/* header */}
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
        <Link href="/ai-staff" className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 shrink-0">
          Open <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* NEEDS YOU */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Needs you</p>
          {shownNeeds.length === 0 ? (
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-3 text-[13px] text-slate-300">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" /> All clear — nothing needs your approval. 🎉
            </div>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {shownNeeds.map((n, i) => (
                <li key={i}>
                  <Link href={n.link}
                    className="group flex items-center gap-2.5 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 hover:border-emerald-500/25 hover:bg-white/[0.04] transition-colors">
                    <n.Icon className={`h-4 w-4 shrink-0 ${n.tone}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-slate-200">{n.title}</span>
                      <span className="block truncate text-[11px] text-slate-500">{n.meta}</span>
                    </span>
                    {n.at && <span className="shrink-0 text-[11px] text-slate-600">{ago(n.at)}</span>}
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-600 group-hover:text-emerald-300" />
                  </Link>
                </li>
              ))}
              {needs.length > shownNeeds.length && (
                <li>
                  <Link href="/ai-staff" className="block px-3 py-1 text-[11px] font-semibold text-emerald-300 hover:text-emerald-200">
                    +{needs.length - shownNeeds.length} more →
                  </Link>
                </li>
              )}
            </ul>
          )}
        </div>

        {/* RECENT ACTIVITY */}
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <Activity className="h-3.5 w-3.5" /> Recent activity
          </p>
          {feed.length === 0 ? (
            <div className="mt-2 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-3 text-[13px] text-slate-500">Nothing yet today.</div>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {feed.map((f, i) => (
                <li key={i} className="flex items-center gap-2.5 px-1 text-[13px]">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[f.status] || 'bg-slate-500'}`} />
                  <span className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold text-slate-300">{f.agent}</span>
                  <span className="min-w-0 flex-1 truncate text-slate-300">{f.title}</span>
                  {f.business && <span className="hidden shrink-0 text-[11px] text-slate-500 sm:inline">{f.business}</span>}
                  <span className="shrink-0 text-[11px] text-slate-600">{ago(f.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
