'use client';

import { useEffect, useMemo, useState, use as reactUse } from 'react';
import { Sparkles, Loader2, ExternalLink, Send, RefreshCw, Trash2, Check } from 'lucide-react';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageHeader, AddButton, PrimaryButton, Card, Field, TextInput } from '@/components/accounting/kit';
import { CampaignsService, type Campaign } from '@/services/campaigns.service';

const INPUT = 'w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-400/50';
const GHOST = 'inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/[0.06] disabled:opacity-50';

export default function CampaignsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard service="crm" required="crm.leads_view" workspaceId={wsId} skeleton="list">
      <Campaigns wsId={wsId} />
    </PermissionGuard>
  );
}

function Campaigns({ wsId }: { wsId: string }) {
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
    <div className="space-y-5">
      <PageHeader
        title="Campaign Funnels"
        subtitle="AI builds the landing page; leads flow straight into your CRM."
        action={<AddButton onClick={() => { setSel(null); setCreating(true); }} label="New campaign" />}
      />

      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        {/* list */}
        <div className="space-y-2">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : list.length === 0 ? (
            <Card className="text-center text-sm text-slate-500">No campaigns yet. Create one →</Card>
          ) : list.map((cp) => (
            <button key={cp.id} onClick={() => { setSel(cp); setCreating(false); }}
              className={`w-full rounded-2xl border p-3 text-left transition ${sel?.id === cp.id ? 'border-emerald-500/40 bg-emerald-500/[0.06]' : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.04]'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold text-white">{cp.name}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${cp.status === 'published' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-slate-400'}`}>{cp.status}</span>
              </div>
              <div className="mt-1 text-[11px] text-slate-500">{cp.visit_count} visits · {cp.lead_count} leads</div>
            </button>
          ))}
        </div>

        {/* editor / preview */}
        <Card>
          {creating ? (
            <div className="max-w-xl space-y-3">
              <h2 className="text-base font-bold text-white">New campaign</h2>
              <Field label="Campaign name"><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Spring Facials Promo" /></Field>
              <Field label="Brief"><textarea value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="What's the offer, who's it for? e.g. '30% off facials, local women 25–45, book this month'" className={`${INPUT} min-h-[120px]`} /></Field>
              <div className="flex items-center gap-2">
                <PrimaryButton onClick={create} disabled={busy || !name.trim()}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Generate with AI</PrimaryButton>
                <button onClick={() => setCreating(false)} className={GHOST}>Cancel</button>
              </div>
            </div>
          ) : !sel ? (
            <div className="py-16 text-center text-sm text-slate-500">Select a campaign, or create a new one.</div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-white">{sel.name}</h2>
                  <p className="text-[11px] text-slate-500">{sel.status} · {sel.visit_count} visits · {sel.lead_count} leads</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={regen} disabled={busy} className={GHOST}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Regenerate</button>
                  {sel.status !== 'published'
                    ? <PrimaryButton onClick={publish} disabled={busy}><Send className="h-3.5 w-3.5" /> Publish</PrimaryButton>
                    : <button onClick={copyLink} className={GHOST}>{copied ? <Check className="h-3.5 w-3.5" /> : <ExternalLink className="h-3.5 w-3.5" />} {copied ? 'Copied' : 'Copy link'}</button>}
                  <button onClick={() => del(sel)} className="rounded-lg border border-white/10 p-1.5 text-slate-400 hover:text-rose-400"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>

              {sel.status === 'published' && publicUrl && (
                <a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:underline"><ExternalLink className="h-3.5 w-3.5" /> {publicUrl}</a>
              )}

              <Field label="Brief">
                <textarea value={sel.brief} onChange={(e) => setSel({ ...sel, brief: e.target.value })} onBlur={() => CampaignsService.update(wsId, sel.id, { brief: sel.brief })} className={`${INPUT} min-h-[60px]`} />
              </Field>

              <div className="overflow-hidden rounded-xl border border-white/5">
                <div className="border-b border-white/5 bg-white/[0.03] px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Landing page preview</div>
                <div className="p-5">
                  <h3 className="text-xl font-black text-white">{c?.headline || '—'}</h3>
                  {c?.subhead && <p className="mt-1.5 text-sm text-slate-300">{c.subhead}</p>}
                  {c?.offer && <p className="mt-3 inline-block rounded-lg bg-emerald-500/15 px-3 py-1.5 text-sm font-semibold text-emerald-300">{c.offer}</p>}
                  {!!c?.benefits?.length && (
                    <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                      {c.benefits.map((b, i) => (
                        <li key={i} className="rounded-lg bg-white/[0.03] p-2.5">
                          <p className="text-sm font-semibold text-white">{b.title}</p>
                          {b.desc && <p className="text-[12px] text-slate-400">{b.desc}</p>}
                        </li>
                      ))}
                    </ul>
                  )}
                  {!!c?.form_fields?.length && (
                    <div className="mt-4 rounded-lg border border-white/10 p-3">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Lead form</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">{c.form_fields.map((f) => <span key={f} className="rounded bg-white/5 px-2 py-0.5 text-[11px] text-slate-300">{f}</span>)}</div>
                      <button className="mt-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">{c?.cta_label || 'Submit'}</button>
                    </div>
                  )}
                  {!!c?.faq?.length && (
                    <div className="mt-4 space-y-1.5">
                      {c.faq.map((f, i) => <details key={i} className="rounded-lg bg-white/[0.03] p-2.5"><summary className="cursor-pointer text-sm font-semibold text-slate-200">{f.q}</summary><p className="mt-1 text-[12px] text-slate-400">{f.a}</p></details>)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
