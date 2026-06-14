'use client';

import { useCallback, useEffect, useState, use as reactUse } from 'react';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import RichTextEditor from '@/components/blog/RichTextEditor';
import { BlogService, type BlogPostRow, type BlogCategoryRow } from '@/services/blog.service';
import { Plus, ArrowLeft, Trash2, Loader2, ChevronDown, Search, Sparkles } from 'lucide-react';

const EMPTY: Partial<BlogPostRow> = {
  title: '', excerpt: '', body: '', status: 'draft', category: null, tags: [],
  seo_title: '', meta_description: '', canonical_url: '', og_title: '', og_description: '',
  twitter_card: 'summary_large_image', robots: 'index,follow', focus_keyword: '', secondary_keywords: [],
  short_answer: '', faqs: [], key_entities: [], tldr: [],
};

export default function BlogAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard service="content" required="blog.view" workspaceId={wsId} skeleton="list">
      <Inner wsId={wsId} />
    </PermissionGuard>
  );
}

function Counter({ n, min, max }: { n: number; min: number; max: number }) {
  const ok = n >= min && n <= max;
  return <span className={`text-[11px] ${ok ? 'text-emerald-600' : n === 0 ? 'text-slate-400' : 'text-amber-600'}`}>{n} / {max}</span>;
}

function Section({ title, children, open }: { title: string; children: React.ReactNode; open?: boolean }) {
  const [o, setO] = useState(!!open);
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <button type="button" onClick={() => setO(!o)} className="flex w-full items-center justify-between px-4 py-3 text-left font-semibold text-slate-900">
        {title} <ChevronDown className={`h-4 w-4 transition-transform ${o ? 'rotate-180' : ''}`} />
      </button>
      {o && <div className="space-y-3 border-t border-slate-100 px-4 py-3">{children}</div>}
    </div>
  );
}

const inputCls = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400';
const labelCls = 'mb-1 block text-xs font-medium text-slate-500';

function Inner({ wsId }: { wsId: string }) {
  const [posts, setPosts] = useState<BlogPostRow[]>([]);
  const [cats, setCats] = useState<BlogCategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<BlogPostRow>>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [pr, cr] = await Promise.all([BlogService.posts.list(wsId), BlogService.categories.list(wsId)]);
      setPosts(pr.success ? pr.data : []);
      setCats(cr.success ? cr.data : []);
    } finally { setLoading(false); }
  }, [wsId]);
  useEffect(() => { reload(); }, [reload]);

  const openNew = () => { setForm({ ...EMPTY }); setEditing(true); setErr(null); };
  const openEdit = (p: BlogPostRow) => { setForm({ ...p }); setEditing(true); setErr(null); };
  const close = () => setEditing(false);
  const set = (patch: Partial<BlogPostRow>) => setForm((f) => ({ ...f, ...patch }));

  const save = async (publish?: boolean) => {
    setSaving(true); setErr(null);
    try {
      const payload = { ...form, status: publish ? 'published' : (form.status || 'draft') };
      const isEdit = form.id != null;
      const res = isEdit ? await BlogService.posts.update(wsId, form.id!, payload) : await BlogService.posts.create(wsId, payload);
      if (!res.success) { setErr(res.message || 'Could not save.'); return; }
      await reload();
      setEditing(false);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not save.'); }
    finally { setSaving(false); }
  };

  const remove = async (p: BlogPostRow) => {
    if (!confirm(`Delete "${p.title}"?`)) return;
    await BlogService.posts.remove(wsId, p.id); reload();
  };

  if (loading) return <PageSkeleton kind="list" />;

  // ── Editor view ──
  if (editing) {
    const faqs = form.faqs || [];
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={close} className="flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-slate-900"><ArrowLeft className="h-4 w-4" /> Posts</button>
          <div className="flex gap-2">
            <button onClick={() => save(false)} disabled={saving} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{saving ? 'Saving…' : 'Save draft'}</button>
            <button onClick={() => save(true)} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Publish</button>
          </div>
        </div>
        {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Main */}
          <div className="space-y-3 lg:col-span-2">
            <input value={form.title || ''} onChange={(e) => set({ title: e.target.value })} placeholder="Post title" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-lg font-bold text-slate-900 outline-none focus:border-emerald-400" />
            <textarea value={form.excerpt || ''} onChange={(e) => set({ excerpt: e.target.value })} placeholder="Short excerpt (shown in cards + as meta fallback)" rows={2} className={inputCls} />
            <RichTextEditor value={form.body || ''} onChange={(html) => set({ body: html })} />
          </div>

          {/* Side panels */}
          <div className="space-y-4">
            <Section title="Publish" open>
              <div>
                <label className={labelCls}>Status</label>
                <select value={form.status} onChange={(e) => set({ status: e.target.value as BlogPostRow['status'] })} className={inputCls}>
                  <option value="draft">Draft</option><option value="scheduled">Scheduled</option>
                  <option value="published">Published</option><option value="archived">Archived</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Category</label>
                <select value={form.category ?? ''} onChange={(e) => set({ category: e.target.value ? Number(e.target.value) : null })} className={inputCls}>
                  <option value="">— none —</option>
                  {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </Section>

            <Section title="SEO" open>
              <div>
                <div className="flex items-center justify-between"><label className={labelCls}>SEO title</label><Counter n={(form.seo_title || '').length} min={30} max={60} /></div>
                <input value={form.seo_title || ''} onChange={(e) => set({ seo_title: e.target.value })} placeholder={form.title} className={inputCls} />
              </div>
              <div>
                <div className="flex items-center justify-between"><label className={labelCls}>Meta description</label><Counter n={(form.meta_description || '').length} min={70} max={160} /></div>
                <textarea value={form.meta_description || ''} onChange={(e) => set({ meta_description: e.target.value })} rows={2} className={inputCls} />
              </div>
              <div><label className={labelCls}>Focus keyword</label><input value={form.focus_keyword || ''} onChange={(e) => set({ focus_keyword: e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>Canonical URL</label><input value={form.canonical_url || ''} onChange={(e) => set({ canonical_url: e.target.value })} placeholder="(auto)" className={inputCls} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={labelCls}>Twitter card</label><select value={form.twitter_card} onChange={(e) => set({ twitter_card: e.target.value })} className={inputCls}><option value="summary_large_image">Large</option><option value="summary">Summary</option></select></div>
                <div><label className={labelCls}>Robots</label><select value={form.robots} onChange={(e) => set({ robots: e.target.value })} className={inputCls}><option value="index,follow">Index</option><option value="noindex,follow">No-index</option></select></div>
              </div>
            </Section>

            <Section title="AEO (AI search)">
              <div>
                <div className="flex items-center justify-between"><label className={labelCls}>Short answer</label><Counter n={(form.short_answer || '').length} min={40} max={320} /></div>
                <textarea value={form.short_answer || ''} onChange={(e) => set({ short_answer: e.target.value })} rows={2} placeholder="The concise answer AI search engines quote." className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>FAQs</label>
                {faqs.map((f, i) => (
                  <div key={i} className="mb-2 space-y-1 rounded-lg border border-slate-100 p-2">
                    <input value={f.q} onChange={(e) => { const n = [...faqs]; n[i] = { ...n[i], q: e.target.value }; set({ faqs: n }); }} placeholder="Question" className={inputCls} />
                    <textarea value={f.a} onChange={(e) => { const n = [...faqs]; n[i] = { ...n[i], a: e.target.value }; set({ faqs: n }); }} placeholder="Answer" rows={2} className={inputCls} />
                    <button onClick={() => set({ faqs: faqs.filter((_, j) => j !== i) })} className="text-[11px] text-red-500">Remove</button>
                  </div>
                ))}
                <button onClick={() => set({ faqs: [...faqs, { q: '', a: '' }] })} className="text-xs font-semibold text-emerald-600">+ Add FAQ</button>
              </div>
              <p className="flex items-center gap-1 text-[11px] text-slate-400"><Sparkles className="h-3 w-3" /> The SEO agent can fill these (Phase 0B).</p>
            </Section>
          </div>
        </div>
      </div>
    );
  }

  // ── List view ──
  const shown = posts.filter((p) => !q || p.title.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-slate-900">Blog</h1><p className="text-sm text-slate-500">Write SEO/AEO-ready posts for this workspace.</p></div>
        <button onClick={openNew} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"><Plus className="h-4 w-4" /> New post</button>
      </div>
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search posts…" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-400" />
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="px-4 py-2">Title</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Published</th><th className="px-4 py-2 text-right">Actions</th></tr></thead>
          <tbody>
            {shown.map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium text-slate-900">{p.title}</td>
                <td className="px-4 py-2"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${p.status === 'published' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{p.status}</span></td>
                <td className="px-4 py-2 text-slate-500">{p.published_at ? new Date(p.published_at).toLocaleDateString() : '—'}</td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <button onClick={() => openEdit(p)} className="text-xs font-semibold text-cyan-600 hover:text-cyan-700">Edit</button>
                  <button onClick={() => remove(p)} className="ml-3 text-red-400 hover:text-red-600"><Trash2 className="inline h-3.5 w-3.5" /></button>
                </td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-400">No posts yet — write your first.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
