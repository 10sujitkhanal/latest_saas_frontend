'use client';

import { useCallback, useEffect, useState, use as reactUse } from 'react';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { SeoService, type Review, type PendingReply, type Connection } from '@/services/seo.service';
import { Star, Wand2, RefreshCw, CheckCircle2, XCircle, Plus, MessageSquare, Link2, Unlink } from 'lucide-react';

const PROVIDER_LABEL: Record<string, string> = { google_business: 'Google Business Profile', meta: 'Meta (Facebook/Instagram)' };
const STATUS_STYLE: Record<string, string> = {
  connected: 'bg-emerald-500/15 text-emerald-300', pending: 'bg-amber-500/15 text-amber-300',
  error: 'bg-rose-500/15 text-rose-300', disconnected: 'bg-white/[0.06] text-slate-500',
};

export default function ReviewsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard service="content" required="seo.audit.run" workspaceId={wsId} skeleton="list">
      <Inner wsId={wsId} />
    </PermissionGuard>
  );
}

function Stars({ n }: { n: number }) {
  return <span className="inline-flex">{[1, 2, 3, 4, 5].map((i) => <Star key={i} className={`h-3.5 w-3.5 ${i <= n ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />)}</span>;
}

function Inner({ wsId }: { wsId: string }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [pending, setPending] = useState<PendingReply[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [gbpEnabled, setGbpEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);
  const [draftEdits, setDraftEdits] = useState<Record<number, string>>({});

  // add-review form
  const [adding, setAdding] = useState(false);
  const [author, setAuthor] = useState('');
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');

  const flash = (ok: boolean, msg: string) => { setToast({ ok, msg }); setTimeout(() => setToast(null), 3500); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, c] = await Promise.all([SeoService.reviews.list(wsId), SeoService.connections.list(wsId)]);
      if (r.success) { setReviews(r.data.reviews); setPending(r.data.pending_replies); }
      if (c.success) { setConnections(c.data.connections); setGbpEnabled(c.data.gbp_enabled); }
    } finally { setLoading(false); }
  }, [wsId]);
  useEffect(() => { load(); }, [load]);

  const pendingFor = (reviewId: number) => pending.find((p) => p.review_id === reviewId);

  const addReview = async () => {
    if (!text.trim()) { flash(false, 'Enter the review text.'); return; }
    setBusy('add');
    try {
      const r = await SeoService.reviews.add(wsId, { author_name: author.trim(), rating, text: text.trim() });
      if (r.success) { setAdding(false); setAuthor(''); setRating(5); setText(''); flash(true, 'Review added.'); load(); }
      else flash(false, r.message || 'Could not add.');
    } finally { setBusy(null); }
  };

  const draftReply = async (review: Review) => {
    setBusy(`draft-${review.id}`);
    try {
      const r = await SeoService.reviews.draftReply(wsId, review.id);
      if (r.success) { flash(true, 'Reply drafted — review it below.'); load(); }
      else flash(false, r.message || 'Could not draft.');
    } catch (e: unknown) {
      const m = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      flash(false, m || 'Could not draft (is MoreTech AI enabled?).');
    } finally { setBusy(null); }
  };

  const approveReply = async (p: PendingReply) => {
    setBusy(`approve-${p.task_id}`);
    try {
      const r = await SeoService.reviews.approveReply(wsId, p.task_id, draftEdits[p.task_id]);
      if (r.success) { flash(true, 'Reply approved.'); load(); }
      else flash(false, r.message || 'Could not approve.');
    } finally { setBusy(null); }
  };

  const rejectReply = async (p: PendingReply) => {
    setBusy(`reject-${p.task_id}`);
    try { await SeoService.reviews.rejectReply(wsId, p.task_id); load(); } finally { setBusy(null); }
  };

  const connect = async (provider: string) => {
    setBusy(`conn-${provider}`);
    try {
      const r = await SeoService.connections.connect(wsId, provider);
      if (r.success && r.data.authorize_url) { window.location.href = r.data.authorize_url; return; }
      flash(true, r.message || 'Connection requested.'); load();
    } finally { setBusy(null); }
  };

  const disconnect = async (provider: string) => {
    setBusy(`conn-${provider}`);
    try { await SeoService.connections.disconnect(wsId, provider); load(); } finally { setBusy(null); }
  };

  if (loading) return <PageSkeleton kind="list" />;

  const gbp = connections.find((c) => c.provider === 'google_business');

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-white"><MessageSquare className="h-5 w-5 text-teal-500" /> Reviews</h1>
          <p className="text-sm text-slate-500">Reply to every review — the agent drafts each reply in your brand voice for your approval.</p>
        </div>
        <button onClick={() => setAdding((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-white/[0.03]"><Plus className="h-4 w-4" /> Add review</button>
      </div>

      {toast && <div className={`rounded-lg px-4 py-2.5 text-sm font-medium ${toast.ok ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}>{toast.msg}</div>}

      {/* connection card */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-white">{PROVIDER_LABEL.google_business}</p>
            <p className="text-xs text-slate-500">{gbpEnabled ? 'Connect to auto-sync your profile + reviews.' : 'Sync activates once Google API access is approved. Until then, add reviews manually.'}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[gbp?.status ?? 'disconnected']}`}>{gbp?.status ?? 'disconnected'}</span>
            {gbp && gbp.status !== 'disconnected' ? (
              <button onClick={() => disconnect('google_business')} disabled={busy === 'conn-google_business'} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:bg-white/[0.03] disabled:opacity-50"><Unlink className="h-3.5 w-3.5" /> Disconnect</button>
            ) : (
              <button onClick={() => connect('google_business')} disabled={busy === 'conn-google_business'} className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-teal-500 disabled:opacity-50"><Link2 className="h-3.5 w-3.5" /> Connect</button>
            )}
          </div>
        </div>
      </div>

      {adding && (
        <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <div className="flex items-center gap-3">
            <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Reviewer name" className="flex-1 rounded-lg border border-white/10 px-3 py-2 text-sm outline-none focus:border-teal-400" />
            <select value={rating} onChange={(e) => setRating(Number(e.target.value))} className="rounded-lg border border-white/10 px-3 py-2 text-sm">
              {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} ★</option>)}
            </select>
          </div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="What the customer wrote…" className="w-full rounded-lg border border-white/10 px-3 py-2 text-sm outline-none focus:border-teal-400" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setAdding(false)} className="rounded-lg border border-white/10 px-3 py-1.5 text-sm font-semibold text-slate-300 hover:bg-white/[0.03]">Cancel</button>
            <button onClick={addReview} disabled={busy === 'add'} className="rounded-lg bg-teal-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50">Add</button>
          </div>
        </div>
      )}

      {reviews.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-slate-400"><MessageSquare className="mx-auto mb-2 h-6 w-6 text-slate-300" />No reviews yet. Add one manually, or connect Google to sync them.</p>
      ) : (
        <div className="space-y-3">
          {reviews.map((rv) => {
            const p = pendingFor(rv.id);
            return (
              <div key={rv.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2"><span className="font-semibold text-white">{rv.author_name || 'Anonymous'}</span><Stars n={rv.rating} /><span className="text-[11px] uppercase text-slate-400">{rv.platform}</span></div>
                    <p className="mt-1 text-sm text-slate-200">{rv.text}</p>
                  </div>
                  {rv.reply_status === 'none' && !p && (
                    <button onClick={() => draftReply(rv)} disabled={busy === `draft-${rv.id}`} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700 hover:bg-teal-100 disabled:opacity-50">
                      {busy === `draft-${rv.id}` ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />} Draft reply
                    </button>
                  )}
                </div>

                {/* approved/saved reply */}
                {rv.reply_text && !p && (
                  <div className="mt-3 rounded-lg bg-white/[0.03] p-3">
                    <p className="mb-1 text-[11px] font-semibold uppercase text-slate-400">Your reply {rv.reply_status === 'drafted' && '· ready to post'}</p>
                    <p className="text-sm text-slate-200">{rv.reply_text}</p>
                  </div>
                )}

                {/* pending agent draft awaiting approval */}
                {p && (
                  <div className="mt-3 rounded-lg border border-teal-200 bg-teal-50/40 p-3">
                    <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase text-teal-500"><Wand2 className="h-3 w-3" /> Agent draft — edit &amp; approve</p>
                    <textarea defaultValue={p.reply_text} onChange={(e) => setDraftEdits((d) => ({ ...d, [p.task_id]: e.target.value }))} rows={3} className="w-full rounded-lg border border-teal-200 bg-white/[0.02] px-3 py-2 text-sm outline-none focus:border-teal-400" />
                    <div className="mt-2 flex justify-end gap-2">
                      <button onClick={() => rejectReply(p)} disabled={busy === `reject-${p.task_id}`} className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-1.5 text-sm font-semibold text-slate-300 hover:bg-white/[0.03] disabled:opacity-50"><XCircle className="h-4 w-4" /> Discard</button>
                      <button onClick={() => approveReply(p)} disabled={busy === `approve-${p.task_id}`} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"><CheckCircle2 className="h-4 w-4" /> Approve</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
