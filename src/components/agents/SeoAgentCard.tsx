'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, Wand2, Loader2, RefreshCw, AlertCircle, AlertTriangle, FileText, MessageSquare, MapPin, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { SeoService, type SeoAudit, type SeoIssue } from '@/services/seo.service';

/**
 * SEO Agent work surface — owns the Content & SEO module. Audits the storefront,
 * blog and products (5 scores + ranked fixes) and drafts SEO/AEO articles for
 * approval. Self-contained so it renders inside the per-agent AgentShell, in the
 * same light card language as every other agent card.
 */
export default function SeoAgentCard({ workspaceId, embed }: { workspaceId: string | number; embed?: boolean }) {
  const [audit, setAudit] = useState<SeoAudit | null>(null);
  const [auditing, setAuditing] = useState(false);
  const [goal, setGoal] = useState('');
  const [focus, setFocus] = useState('');
  const [drafting, setDrafting] = useState(false);

  const runAudit = async () => {
    if (auditing) return;
    setAuditing(true);
    try {
      const r = await SeoService.audit(workspaceId);
      if (r.success) setAudit(r.data);
      else toast.error(r.message || 'Could not run the audit.');
    } catch (e) {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Could not run the audit.');
    } finally { setAuditing(false); }
  };

  const draft = async () => {
    if (drafting) return;
    if (!goal.trim()) { toast.error('Describe the article topic first.'); return; }
    setDrafting(true);
    try {
      const r = await SeoService.draftBlog(workspaceId, goal.trim(), focus.trim() || undefined);
      if (r.success) { setGoal(''); setFocus(''); toast.success('Draft article created — review & publish it on Blog.'); }
      else toast.error(r.message || 'The agent could not draft this.');
    } catch (e) {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Could not draft (is MoreTech AI enabled?).');
    } finally { setDrafting(false); }
  };

  const link = (p: string) => `/w/${workspaceId}/seo${p}`;

  return (
    <div className={embed ? '' : 'mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5 shadow-sm'}>
      <p className={embed ? 'text-sm text-slate-500' : 'mt-1 text-sm text-slate-500'}>
        Audits your storefront, blog &amp; products for Google and AI search, then <strong>drafts</strong> the
        fixes and articles — you review &amp; publish. It never publishes on its own.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={runAudit} disabled={auditing}
          className="inline-flex items-center gap-2 rounded-full bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-teal-700 disabled:opacity-50">
          {auditing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {auditing ? 'Auditing…' : audit ? 'Re-audit' : 'Audit SEO & AEO'}
        </button>
        <Link href={link('/business-profile')} className="inline-flex items-center gap-2 rounded-full border border-teal-300 px-4 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-50"><MapPin className="h-4 w-4" /> Business profile</Link>
        <Link href={link('/reviews')} className="inline-flex items-center gap-2 rounded-full border border-teal-300 px-4 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-50"><MessageSquare className="h-4 w-4" /> Reviews</Link>
        <Link href={`/w/${workspaceId}/blog`} className="text-sm font-semibold text-slate-500 hover:text-teal-700">Open Blog</Link>
      </div>

      {/* scores */}
      {audit && (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <ScoreTile label="Overall" value={audit.scores.overall} primary />
          <ScoreTile label="Technical" value={audit.scores.technical_seo} />
          <ScoreTile label="Content" value={audit.scores.content} />
          <ScoreTile label="Local" value={audit.scores.local_seo} />
          <ScoreTile label="AI Answer" value={audit.scores.aeo} />
        </div>
      )}

      {/* article composer */}
      <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-200"><Wand2 className="h-3.5 w-3.5 text-teal-500" /> Write an SEO + AEO article</p>
        <textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={2}
          placeholder="e.g. A guide to choosing the right protein powder for beginners"
          className="mt-2 w-full rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm outline-none focus:border-teal-400" />
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="Target keyword (optional)"
            className="flex-1 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm outline-none focus:border-teal-400" />
          <button type="button" onClick={draft} disabled={drafting}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
            {drafting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} Draft article
          </button>
        </div>
      </div>

      {/* findings */}
      {audit && (
        audit.issues.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-5 text-center text-sm text-emerald-600">Nothing to fix — your content is in great shape. 🎉</p>
        ) : (
          <div className="mt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{audit.summary.fails} to fix · {audit.summary.warns} to improve</p>
            <ul className="mt-1.5 space-y-2">
              {audit.issues.slice(0, 8).map((i, idx) => <FindingRow key={idx} issue={i} workspaceId={workspaceId} />)}
            </ul>
          </div>
        )
      )}
    </div>
  );
}

function ScoreTile({ label, value, primary }: { label: string; value: number; primary?: boolean }) {
  const tone = value >= 80 ? 'text-emerald-600' : value >= 50 ? 'text-amber-500' : 'text-rose-500';
  const bar = value >= 80 ? 'bg-emerald-500/150' : value >= 50 ? 'bg-amber-400' : 'bg-rose-400';
  return (
    <div className={`rounded-xl border p-3 ${primary ? 'border-teal-200 bg-teal-50/50' : 'border-white/10 bg-white'}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-0.5 text-xl font-bold ${tone}`}>{value}</p>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.06]"><div className={`h-full ${bar}`} style={{ width: `${value}%` }} /></div>
    </div>
  );
}

function FindingRow({ issue, workspaceId }: { issue: SeoIssue; workspaceId: string | number }) {
  const href = issue.target_type === 'business_profile' ? `/w/${workspaceId}/seo/business-profile`
    : issue.target_type === 'reviews' ? `/w/${workspaceId}/seo/reviews`
    : `/w/${workspaceId}/blog`;
  return (
    <li className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
      {issue.severity === 'fail' ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />}
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-white">{issue.message}</p>
        <p className="text-xs text-slate-400">{issue.fix}{issue.target_label ? ` · ${issue.target_label}` : ''}</p>
      </div>
      <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-teal-700 hover:underline">Fix <ArrowRight className="h-3 w-3" /></Link>
    </li>
  );
}
