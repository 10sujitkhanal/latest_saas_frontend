'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Megaphone, Sparkles, Loader2, Plus, ExternalLink, Send, RefreshCw, Trash2, Check, Eye } from 'lucide-react';
import { CampaignsService, type Campaign } from '@/services/campaigns.service';

export default function CampaignsPage() {
  const params = useParams();
  const wsId = String(params.id);
  const [list, setList] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<Campaign | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [brief, setBrief] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const r = await CampaignsService.list(wsId); if (r.success) setList(r.data.campaigns); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [wsId]);

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const r = await CampaignsService.create(wsId, { name: name.trim(), brief: brief.trim() });
      if (r.success) { setSel(r.data.campaign); setName(''); setBrief(''); setCreating(false); load(); }
    } finally { setBusy(false); }
  };

  const regen = async () => {
    if (!sel) return;
    setBusy(true);
    try { const r = await CampaignsService.generate(wsId, sel.id, sel.brief); if (r.success) setSel(r.data.campaign); }
    finally { setBusy(false); }
  };

  const publish = async () => {
    if (!sel) return;
    setBusy(true);
    try { const r = await CampaignsService.publish(wsId, sel.id); if (r.success) { setSel(r.data.campaign); load(); } }
    finally { setBusy(false); }
  };

  const del = async (c: Campaign) => {
    if (!confirm(`Delete campaign "${c.name}"?`)) return;
    await CampaignsService.remove(wsId, c.id);
    if (sel?.id === c.id) setSel(null);
    load();
  };

  const publicUrl = useMemo(() => {
    if (!sel?.slug || typeof window === 'undefined') return '';
    return `${window.location.protocol}//${window.location.host}/c/${sel.slug}`;
  }, [sel?.slug]);

  const copyLink = () => {
    if (!publicUrl) return;
    navigator.clipboard?.writeText(publicUrl);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };

  const c = sel?.content;

  return (
    <div className="p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-50 border border-indigo-100"><Megaphone className="h-5 w-5 text-indigo-600" /></span>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Campaign Funnels</h1>
            <p className="text-xs text-slate-500">AI builds the landing page; leads flow straight into your CRM.</p>
          </div>
        </div>
        <button onClick={() => { setSel(null); setCreating(true); }} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"><Plus className="h-4 w-4" /> New campaign</button>
      </div>

      <div className="mt-5 grid lg:grid-cols-[320px_1fr] gap-5">
        {/* list */}
        <div className="space-y-2">
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-sm flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : list.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">No campaigns yet. Create one →</div>
          ) : list.map((cp) => (
            <button key={cp.id} onClick={() => { setSel(cp); setCreating(false); }}
              className={`w-full text-left rounded-xl border p-3 transition ${sel?.id === cp.id ? 'border-indigo-300 bg-indigo-50/40' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-800 truncate">{cp.name}</span>
                <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${cp.status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{cp.status}</span>
              </div>
              <div className="mt-1 text-[11px] text-slate-400">{cp.visit_count} visits · {cp.lead_count} leads</div>
            </button>
          ))}
        </div>

        {/* editor / preview */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          {creating ? (
            <div className="space-y-3 max-w-xl">
              <h2 className="text-base font-bold text-slate-900">New campaign</h2>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Campaign name (e.g. Spring Facials Promo)" className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" />
              <textarea value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="Brief — what's the offer, who's it for? e.g. '30% off facials, local women 25–45, book this month'" className="min-h-[120px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              <div className="flex items-center gap-2">
                <button onClick={create} disabled={busy || !name.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Generate with AI</button>
                <button onClick={() => setCreating(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button>
              </div>
            </div>
          ) : !sel ? (
            <div className="py-16 text-center text-slate-400 text-sm">Select a campaign, or create a new one.</div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">{sel.name}</h2>
                  <p className="text-[11px] text-slate-400">{sel.status} · {sel.visit_count} visits · {sel.lead_count} leads</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={regen} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Regenerate</button>
                  {sel.status !== 'published'
                    ? <button onClick={publish} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"><Send className="h-3.5 w-3.5" /> Publish</button>
                    : <button onClick={copyLink} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">{copied ? <Check className="h-3.5 w-3.5" /> : <ExternalLink className="h-3.5 w-3.5" />} {copied ? 'Copied' : 'Copy link'}</button>}
                  <button onClick={() => del(sel)} className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-rose-500"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>

              {sel.status === 'published' && publicUrl && (
                <a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:underline"><Eye className="h-3.5 w-3.5" /> {publicUrl}</a>
              )}

              {/* editable brief */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Brief</label>
                <textarea value={sel.brief} onChange={(e) => setSel({ ...sel, brief: e.target.value })} onBlur={() => CampaignsService.update(wsId, sel.id, { brief: sel.brief })}
                  className="mt-1 min-h-[60px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </div>

              {/* AI landing-page preview */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-1.5 bg-slate-50 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">Landing page preview</div>
                <div className="p-5" style={{ borderTop: `3px solid ${c?.theme?.accent || '#10b981'}` }}>
                  <h3 className="text-xl font-black text-slate-900">{c?.headline || '—'}</h3>
                  {c?.subhead && <p className="mt-1.5 text-sm text-slate-600">{c.subhead}</p>}
                  {c?.offer && <p className="mt-3 inline-block rounded-lg bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-700">{c.offer}</p>}
                  {!!c?.benefits?.length && (
                    <ul className="mt-4 grid sm:grid-cols-2 gap-2">
                      {c.benefits.map((b, i) => (
                        <li key={i} className="rounded-lg bg-slate-50 p-2.5">
                          <p className="text-sm font-semibold text-slate-800">{b.title}</p>
                          {b.desc && <p className="text-[12px] text-slate-500">{b.desc}</p>}
                        </li>
                      ))}
                    </ul>
                  )}
                  {!!c?.form_fields?.length && (
                    <div className="mt-4 rounded-lg border border-slate-200 p-3">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Lead form</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {c.form_fields.map((f) => <span key={f} className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{f}</span>)}
                      </div>
                      <button className="mt-2 rounded-lg px-3 py-1.5 text-xs font-semibold text-white" style={{ background: c?.theme?.accent || '#10b981' }}>{c?.cta_label || 'Submit'}</button>
                    </div>
                  )}
                  {!!c?.faq?.length && (
                    <div className="mt-4 space-y-1.5">
                      {c.faq.map((f, i) => <details key={i} className="rounded-lg bg-slate-50 p-2.5"><summary className="text-sm font-semibold text-slate-700 cursor-pointer">{f.q}</summary><p className="mt-1 text-[12px] text-slate-500">{f.a}</p></details>)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
