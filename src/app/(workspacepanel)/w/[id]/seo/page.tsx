'use client';

import { useCallback, useEffect, useState, use as reactUse } from 'react';
import Link from 'next/link';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { SeoService, type SeoAudit, type SeoIssue, type AgentTaskRow, type ManagerSummary } from '@/services/seo.service';
import { Sparkles, RefreshCw, CheckCircle2, XCircle, AlertTriangle, AlertCircle, Wand2, FileText, MapPin, Share2, Bot, ArrowRight, MessageSquare } from 'lucide-react';

const PLATFORMS: { v: string; label: string }[] = [
  { v: 'instagram', label: 'Instagram' }, { v: 'facebook', label: 'Facebook' },
  { v: 'google_post', label: 'Google post' }, { v: 'linkedin', label: 'LinkedIn' }, { v: 'x', label: 'X' },
];

const SCORE_LABELS: Record<string, string> = {
  technical_seo: 'Technical SEO', content: 'Content', local_seo: 'Local SEO', aeo: 'AI Answer (AEO)',
};
const AEO_CHECKS = new Set(['missing_short_answer', 'missing_faq']);

function scoreColor(n: number) {
  if (n >= 80) return 'text-emerald-600';
  if (n >= 50) return 'text-amber-500';
  return 'text-red-500';
}
function barColor(n: number) {
  if (n >= 80) return 'bg-emerald-500';
  if (n >= 50) return 'bg-amber-400';
  return 'bg-red-400';
}

export default function SeoCockpitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard service="content" required="seo.audit.run" workspaceId={wsId} skeleton="list">
      <Inner wsId={wsId} />
    </PermissionGuard>
  );
}

function Inner({ wsId }: { wsId: string }) {
  const [audit, setAudit] = useState<SeoAudit | null>(null);
  const [tasks, setTasks] = useState<AgentTaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [auditing, setAuditing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  const [manager, setManager] = useState<ManagerSummary | null>(null);

  // composer
  const [mode, setMode] = useState<'article' | 'social'>('article');
  const [goal, setGoal] = useState('');
  const [focus, setFocus] = useState('');
  const [platform, setPlatform] = useState('instagram');
  const [drafting, setDrafting] = useState(false);

  const flash = (ok: boolean, msg: string) => { setToast({ ok, msg }); setTimeout(() => setToast(null), 3500); };

  const loadTasks = useCallback(async () => {
    const r = await SeoService.tasks(wsId, 'proposed');
    if (r.success) setTasks(r.data);
  }, [wsId]);

  const loadManager = useCallback(async () => {
    try { const r = await SeoService.manager(wsId); if (r.success) setManager(r.data); } catch { /* not permitted — hide */ }
  }, [wsId]);

  const runAudit = useCallback(async () => {
    setAuditing(true);
    try { const r = await SeoService.audit(wsId); if (r.success) setAudit(r.data); }
    finally { setAuditing(false); }
  }, [wsId]);

  useEffect(() => {
    (async () => { setLoading(true); await Promise.all([runAudit(), loadTasks(), loadManager()]); setLoading(false); })();
  }, [runAudit, loadTasks, loadManager]);

  const draft = async () => {
    if (!goal.trim()) { flash(false, mode === 'article' ? 'Describe the article topic first.' : 'Describe the post first.'); return; }
    setDrafting(true);
    try {
      const r = mode === 'article'
        ? await SeoService.draftBlog(wsId, goal.trim(), focus.trim() || undefined)
        : await SeoService.draftSocial(wsId, goal.trim(), platform);
      if (r.success) { setGoal(''); setFocus(''); flash(true, 'Draft proposed — review it below.'); loadTasks(); }
      else flash(false, r.message || 'The agent could not draft this.');
    } catch (e: unknown) {
      const m = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      flash(false, m || 'The agent could not draft this (is MoreTech AI enabled?).');
    } finally { setDrafting(false); }
  };

  const enrich = async (issue: SeoIssue) => {
    if (!issue.target_id) return;
    setBusy(`aeo-${issue.target_id}`);
    try {
      const r = await SeoService.enrichAeo(wsId, issue.target_id);
      if (r.success) { flash(true, 'AEO draft proposed — approve it below.'); loadTasks(); }
      else flash(false, r.message || 'Could not enrich.');
    } catch (e: unknown) {
      const m = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      flash(false, m || 'Could not enrich (is MoreTech AI enabled?).');
    } finally { setBusy(null); }
  };

  const decide = async (task: AgentTaskRow, ok: boolean) => {
    setBusy(`task-${task.id}`);
    try {
      const r = ok ? await SeoService.approve(wsId, task.id) : await SeoService.reject(wsId, task.id);
      if (r.success) { flash(true, r.message || (ok ? 'Approved.' : 'Rejected.')); loadTasks(); loadManager(); if (ok) runAudit(); }
      else flash(false, r.message || 'Action failed.');
    } finally { setBusy(null); }
  };

  if (loading) return <PageSkeleton kind="list" />;

  const scores = audit?.scores;
  const overall = scores?.overall ?? 0;

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900"><Sparkles className="h-5 w-5 text-violet-500" /> SEO &amp; AI Visibility</h1>
          <p className="text-sm text-slate-500">Your SEO agent audits the storefront, blog &amp; products — then drafts the fixes for your approval.</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link href={`/w/${wsId}/seo/reviews`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><MessageSquare className="h-4 w-4" /> Reviews</Link>
          <Link href={`/w/${wsId}/seo/business-profile`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><MapPin className="h-4 w-4" /> Business profile</Link>
          <button onClick={runAudit} disabled={auditing} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${auditing ? 'animate-spin' : ''}`} /> Re-audit
          </button>
        </div>
      </div>

      {toast && (
        <div className={`rounded-lg px-4 py-2.5 text-sm font-medium ${toast.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{toast.msg}</div>
      )}

      {/* scores */}
      {scores && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-xl border-2 border-violet-200 bg-violet-50 p-4">
            <p className="text-xs font-medium text-violet-600">Overall</p>
            <p className={`mt-1 text-3xl font-extrabold ${scoreColor(overall)}`}>{overall}</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-violet-200"><div className={`h-full ${barColor(overall)}`} style={{ width: `${overall}%` }} /></div>
          </div>
          {(['technical_seo', 'content', 'local_seo', 'aeo'] as const).map((k) => (
            <div key={k} className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium text-slate-500">{SCORE_LABELS[k]}</p>
              <p className={`mt-1 text-3xl font-extrabold ${scoreColor(scores[k])}`}>{scores[k]}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full ${barColor(scores[k])}`} style={{ width: `${scores[k]}%` }} /></div>
            </div>
          ))}
        </div>
      )}

      {/* manager digest */}
      {manager && (
        <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-violet-50/40 p-4">
          <p className="flex items-center gap-1.5 font-semibold text-slate-900"><Bot className="h-4 w-4 text-violet-500" /> Manager · {manager.headline}</p>
          {manager.next_actions.length > 0 && (
            <ul className="mt-2 space-y-1">
              {manager.next_actions.map((a, i) => (
                <li key={i}>
                  <Link href={`/w/${wsId}/${a.where}`} className="group flex items-center gap-2 text-sm text-slate-700 hover:text-violet-700">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${a.priority === 'high' ? 'bg-red-500' : a.priority === 'medium' ? 'bg-amber-400' : 'bg-slate-300'}`} />
                    <span className="flex-1">{a.label}</span>
                    <ArrowRight className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* composer */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <button onClick={() => setMode('article')} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold ${mode === 'article' ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}><Wand2 className="h-4 w-4" /> Article</button>
          <button onClick={() => setMode('social')} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold ${mode === 'social' ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}><Share2 className="h-4 w-4" /> Social post</button>
        </div>
        <p className="mb-3 text-sm text-slate-500">{mode === 'article' ? 'The SEO agent writes an SEO + AEO-ready draft grounded in your real products. You review & publish.' : 'The Social agent drafts a caption + hashtags grounded in your products. You review & post.'}</p>
        <textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={2} placeholder={mode === 'article' ? 'e.g. A guide to choosing the right protein powder for beginners' : 'e.g. Announce our new arrivals this week with a friendly tone'} className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400" />
        <div className="flex flex-col gap-2 sm:flex-row">
          {mode === 'article' ? (
            <input value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="Target keyword (optional)" className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400" />
          ) : (
            <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400">
              {PLATFORMS.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}
            </select>
          )}
          <button onClick={draft} disabled={drafting} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50">
            {drafting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {mode === 'article' ? 'Draft article' : 'Draft post'}
          </button>
        </div>
      </div>

      {/* pending proposals */}
      {tasks.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-700">Pending approval ({tasks.length})</p>
          {tasks.map((t) => (
            <div key={t.id} className="rounded-xl border border-violet-200 bg-violet-50/40 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 font-semibold text-slate-900"><FileText className="h-4 w-4 text-violet-500" /> {t.title}</p>
                  <p className="text-xs text-slate-500">{t.kind === 'aeo_enrich' ? 'AEO enrichment' : t.kind === 'blog_draft' ? 'New article draft' : t.kind === 'social_post' ? 'Social post draft' : t.kind}</p>
                  <TaskPreview task={t} />
                </div>
                <div className="flex shrink-0 gap-2">
                  <button onClick={() => decide(t, true)} disabled={busy === `task-${t.id}`} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"><CheckCircle2 className="h-4 w-4" /> Approve</button>
                  <button onClick={() => decide(t, false)} disabled={busy === `task-${t.id}`} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"><XCircle className="h-4 w-4" /> Reject</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* issues */}
      {audit && (
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="font-semibold text-slate-900">Findings</p>
            <p className="text-xs text-slate-500">{audit.summary.fails} to fix · {audit.summary.warns} to improve · {audit.summary.posts_audited} posts, {audit.summary.listings_audited} products</p>
          </div>
          {audit.issues.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-emerald-600"><CheckCircle2 className="mx-auto mb-2 h-6 w-6" />Nothing to fix — your content is in great shape.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {audit.issues.map((i, idx) => (
                <li key={idx} className="flex items-start gap-3 px-4 py-3">
                  {i.severity === 'fail' ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-800">{i.message}</p>
                    <p className="text-xs text-slate-500">{i.fix}{i.target_label ? ` · ${i.target_label}` : ''}</p>
                  </div>
                  {AEO_CHECKS.has(i.check) && i.target_id && (
                    <button onClick={() => enrich(i)} disabled={busy === `aeo-${i.target_id}`} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-50">
                      {busy === `aeo-${i.target_id}` ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />} Fix with AI
                    </button>
                  )}
                  {i.target_type === 'business_profile' && (
                    <Link href={`/w/${wsId}/seo/business-profile`} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"><MapPin className="h-3.5 w-3.5" /> Complete</Link>
                  )}
                  {i.target_type === 'reviews' && (
                    <Link href={`/w/${wsId}/seo/reviews`} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"><MessageSquare className="h-3.5 w-3.5" /> Reply</Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function TaskPreview({ task }: { task: AgentTaskRow }) {
  const p = task.proposal as Record<string, unknown>;
  if (task.kind === 'aeo_enrich') {
    const sa = String(p.short_answer || '');
    const faqs = (p.faqs as { question: string }[]) || [];
    return <p className="mt-1 line-clamp-2 text-xs text-slate-600">{sa} <span className="text-slate-400">· {faqs.length} FAQs</span></p>;
  }
  if (task.kind === 'social_post') {
    const cap = String(p.caption || '');
    const tags = (p.hashtags as string[]) || [];
    return <p className="mt-1 line-clamp-3 text-xs text-slate-600">{cap} {tags.length > 0 && <span className="text-violet-500">{tags.map((t) => `#${t}`).join(' ')}</span>}</p>;
  }
  const meta = String(p.meta_description || p.excerpt || '');
  return <p className="mt-1 line-clamp-2 text-xs text-slate-600">{meta}</p>;
}
