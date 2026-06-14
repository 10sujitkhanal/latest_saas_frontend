'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Users, Wand2, Loader2, Flame, Sun, Snowflake, ArrowRight, Lightbulb,
  Send, Check, X, Mail, MessageSquare, Phone, AlertTriangle, Reply, Search, MapPin, Plus, Globe,
} from 'lucide-react';
import { toast } from 'sonner';
import { CrmAgent, type LeadAnalysis, type OutreachChannel, type FoundBusiness } from '@/services/agents.service';

const FIND_CATEGORIES = [
  'gym', 'restaurant', 'cafe', 'hotel', 'salon', 'spa', 'pharmacy', 'clinic',
  'dentist', 'veterinary', 'supermarket', 'grocery', 'bakery', 'beauty',
  'florist', 'butcher', 'hardware', 'car_repair', 'hairdresser',
];

/**
 * CRM Agent — Advisor + Co-pilot.
 *   Advisor: score newest leads + next-best-action (writes safe signals).
 *   Co-pilot: draft a first-touch message → you approve → it sends over the
 *   channel you connected (email/SMS/WhatsApp) → the lead moves to Contacted.
 * Never sends without your approval. B2B-first; every message has an opt-out.
 */

const TEMP: Record<string, { cls: string; Icon: typeof Flame; label: string }> = {
  hot: { cls: 'bg-rose-500/15 text-rose-300', Icon: Flame, label: 'Hot' },
  warm: { cls: 'bg-amber-500/15 text-amber-300', Icon: Sun, label: 'Warm' },
  cold: { cls: 'bg-emerald-500/15 text-emerald-300', Icon: Snowflake, label: 'Cold' },
};
const CHANNEL: Record<string, { label: string; Icon: typeof Mail }> = {
  email: { label: 'Email', Icon: Mail },
  sms: { label: 'SMS', Icon: Phone },
  whatsapp: { label: 'WhatsApp', Icon: MessageSquare },
};
const INTEREST: Record<string, { label: string; cls: string }> = {
  interested: { label: 'Interested', cls: 'bg-emerald-500/15 text-emerald-300' },
  objection: { label: 'Objection', cls: 'bg-amber-500/15 text-amber-300' },
  not_interested: { label: 'Not interested', cls: 'bg-white/[0.06] text-slate-500' },
  neutral: { label: 'Neutral', cls: 'bg-white/[0.06] text-slate-500' },
};

type ReplyAnalysis = { intent: string; interest: string; sentiment: string; summary: string };

type Compose = { leadId: number; body: string; channels: OutreachChannel[]; channelId: number | null; channelKind: string };

export default function CrmAgentCard({ workspaceId, embed, pipeline }: { workspaceId: string | number; embed?: boolean; pipeline?: number | null }) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<LeadAnalysis[] | null>(null);
  const [empty, setEmpty] = useState(false);
  const [draftingId, setDraftingId] = useState<number | null>(null);
  const [compose, setCompose] = useState<Compose | null>(null);
  const [sending, setSending] = useState(false);
  const [contacted, setContacted] = useState<Set<number>>(new Set());
  const [replyOpen, setReplyOpen] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [analyzingReply, setAnalyzingReply] = useState(false);
  const [replyAnalysis, setReplyAnalysis] = useState<{ leadId: number; a: ReplyAnalysis } | null>(null);
  // Lead finding (OpenStreetMap)
  const [findOpen, setFindOpen] = useState(false);
  const [findCat, setFindCat] = useState('gym');
  const [findCity, setFindCity] = useState('');
  const [findArea, setFindArea] = useState('');
  const [findCountry, setFindCountry] = useState('');
  const [finding, setFinding] = useState(false);
  const [found, setFound] = useState<FoundBusiness[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [enriching, setEnriching] = useState(false);

  const findLeads = async () => {
    if (finding || !findCity.trim()) return;
    setFinding(true);
    setFound(null);
    try {
      const res = await CrmAgent.findLeads(workspaceId, {
        category: findCat, city: findCity.trim(), area: findArea.trim(), country: findCountry.trim(),
      });
      if (res.success) setFound(res.data?.businesses || []);
      else toast.error(res.message || 'Could not search.');
    } catch (e) {
      toast.error(errMsg(e) || 'Lead search is busy — try again in a moment.');
    } finally {
      setFinding(false);
    }
  };

  const enrichFound = async () => {
    if (enriching || !found?.length) return;
    setEnriching(true);
    try {
      const res = await CrmAgent.enrichLeads(workspaceId, found);
      if (res.success) {
        setFound(res.data?.businesses || found);
        toast.success(res.message || 'Looked for more emails.');
      } else toast.error(res.message || 'Could not enrich.');
    } catch (e) {
      toast.error(errMsg(e) || 'Enrichment is busy — try again.');
    } finally {
      setEnriching(false);
    }
  };

  const importFound = async () => {
    if (importing || !found?.length) return;
    setImporting(true);
    try {
      const res = await CrmAgent.importLeads(workspaceId, found, pipeline);
      if (res.success) {
        toast.success(res.message || 'Added to pipeline.');
        setFound(null);
        setFindOpen(false);
      } else toast.error(res.message || 'Could not add.');
    } catch (e) {
      toast.error(errMsg(e) || 'Could not add to pipeline.');
    } finally {
      setImporting(false);
    }
  };

  const analyze = async () => {
    if (loading) return;
    setLoading(true);
    setEmpty(false);
    setCompose(null);
    try {
      const res = await CrmAgent.analyzeRecent(workspaceId, 5, pipeline);
      if (res.success) {
        setResults(res.data?.results || []);
        setEmpty(!!res.data?.empty);
      } else toast.error(res.message || 'Could not analyse leads.');
    } catch (e) {
      toast.error(errMsg(e) || 'Could not analyse leads right now.');
    } finally {
      setLoading(false);
    }
  };

  const openCompose = async (leadId: number) => {
    if (draftingId) return;
    setReplyAnalysis(null);
    setDraftingId(leadId);
    try {
      const res = await CrmAgent.draftOutreach(workspaceId, leadId);
      if (res.success && res.data) {
        const chs = res.data.available_channels || [];
        setCompose({
          leadId,
          body: res.data.draft?.body || '',
          channels: chs,
          channelId: chs[0]?.id ?? null,
          channelKind: chs[0]?.kind || res.data.draft?.channel_kind || 'email',
        });
      } else toast.error(res.message || 'Could not draft a message.');
    } catch (e) {
      toast.error(errMsg(e) || 'Could not draft a message.');
    } finally {
      setDraftingId(null);
    }
  };

  const send = async () => {
    if (!compose || !compose.channelId || !compose.body.trim() || sending) return;
    setSending(true);
    try {
      await CrmAgent.sendOutreach(compose.leadId, compose.channelId, compose.body);
      await CrmAgent.markContacted(workspaceId, compose.leadId, compose.channelKind);
      setContacted((s) => new Set(s).add(compose.leadId));
      setCompose(null);
      toast.success('Sent — lead moved to Contacted.');
    } catch (e) {
      toast.error(errMsg(e) || 'Could not send the message.');
    } finally {
      setSending(false);
    }
  };

  const analyzeReply = async (leadId: number) => {
    const text = replyText.trim();
    if (!text || analyzingReply) return;
    setAnalyzingReply(true);
    try {
      const res = await CrmAgent.handleReply(workspaceId, leadId, text);
      if (res.success && res.data) {
        const chs = res.data.available_channels || [];
        setReplyAnalysis({ leadId, a: res.data.analysis });
        setCompose({
          leadId,
          body: res.data.draft?.body || '',
          channels: chs,
          channelId: chs[0]?.id ?? null,
          channelKind: chs[0]?.kind || 'email',
        });
        setReplyOpen(null);
        setReplyText('');
      } else {
        toast.error(res.message || 'Could not analyse the reply.');
      }
    } catch (e) {
      toast.error(errMsg(e) || 'Could not analyse the reply.');
    } finally {
      setAnalyzingReply(false);
    }
  };

  return (
    <div className={embed ? '' : 'mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5 shadow-sm'}>
      {!embed && (
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-emerald-600" />
          <h2 className="text-base font-semibold text-white">CRM Agent</h2>
          <span className="ml-auto rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
            advisor + co-pilot
          </span>
        </div>
      )}
      <p className={embed ? 'text-sm text-slate-500' : 'mt-1 text-sm text-slate-500'}>
        Scores your newest leads and tells you the next move. For outreach it <strong>drafts</strong> the
        message — you approve, and it sends over your connected channel, then moves the lead to Contacted.
        It never messages anyone without your OK.
      </p>

      <div className="mt-4 flex items-center gap-2">
        <button type="button" onClick={analyze} disabled={loading}
          className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-50">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          {loading ? 'Analysing…' : 'Analyse my newest leads'}
        </button>
        <button type="button" onClick={() => setFindOpen((o) => !o)}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-emerald-500/40 hover:text-emerald-300">
          <Search className="h-4 w-4" /> Find new leads
        </button>
        <Link href={`/w/${workspaceId}/leads`} className="text-sm font-semibold text-slate-500 hover:text-emerald-300">Open CRM</Link>
      </div>

      {/* Find leads (OpenStreetMap) */}
      {findOpen && (
        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <p className="mb-2 text-xs text-slate-500">
            Find B2B businesses from open map data (no scraping). They go into your pipeline as new leads — no messages sent.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="block">
              <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Business type</span>
              <select value={findCat} onChange={(e) => setFindCat(e.target.value)}
                className="rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-2 text-sm capitalize text-white outline-none focus:border-emerald-500/40">
                {FIND_CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">City *</span>
              <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.02] px-2.5">
                <MapPin className="h-4 w-4 text-slate-400" />
                <input value={findCity} onChange={(e) => setFindCity(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); findLeads(); } }}
                  placeholder="Stockholm" className="w-28 bg-transparent py-2 text-sm text-white placeholder:text-slate-400 outline-none" />
              </div>
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Area (optional)</span>
              <input value={findArea} onChange={(e) => setFindArea(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); findLeads(); } }}
                placeholder="Södermalm" className="w-28 rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-2 text-sm text-white placeholder:text-slate-400 outline-none focus:border-emerald-500/40" />
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Country (optional)</span>
              <input value={findCountry} onChange={(e) => setFindCountry(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); findLeads(); } }}
                placeholder="Sweden" className="w-28 rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-2 text-sm text-white placeholder:text-slate-400 outline-none focus:border-emerald-500/40" />
            </label>
            <button type="button" onClick={findLeads} disabled={finding || !findCity.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
              {finding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {finding ? 'Searching…' : 'Find'}
            </button>
          </div>

          {found && found.length > 0 && (() => {
            const noEmail = found.filter((b) => !b.email).length;
            return (
              <div className="mt-3">
                <div className="mb-1.5 text-[11px] text-slate-500">
                  {found.length} found · {found.length - noEmail} with an email{noEmail > 0 ? ` · ${noEmail} need one` : ''}
                </div>
                <div className="max-h-60 space-y-1.5 overflow-y-auto">
                  {found.map((b, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-xs">
                      <span className="truncate font-semibold text-white">{b.name}</span>
                      <span className="ml-auto inline-flex items-center gap-2 text-slate-400">
                        {b.email && <span className="inline-flex items-center gap-1 text-emerald-600"><Mail className="h-3 w-3" />{b.email}</span>}
                        {!b.email && b.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{b.phone}</span>}
                        {!b.email && b.website && <Globe className="h-3 w-3" />}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {noEmail > 0 && (
                    <button type="button" onClick={enrichFound} disabled={enriching}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/[0.02] disabled:opacity-50">
                      {enriching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                      {enriching ? 'Finding emails…' : 'Find emails'}
                    </button>
                  )}
                  <button type="button" onClick={importFound} disabled={importing}
                    className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-50">
                    {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    {importing ? 'Adding…' : `Add ${found.length} to pipeline`}
                  </button>
                </div>
              </div>
            );
          })()}
          {found && found.length === 0 && (
            <p className="mt-3 text-xs text-slate-400">No businesses with contact details found there — try a bigger city or another category.</p>
          )}
        </div>
      )}

      {empty && (
        <p className="mt-4 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center text-sm text-slate-400">
          No leads yet — they&apos;ll appear here as customers come in (forms, the storefront assistant, imports).
        </p>
      )}

      {results && results.length > 0 && (
        <ul className="mt-4 space-y-2">
          {results
            .slice()
            .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
            .map((r) => {
              const t = TEMP[r.temperature] || TEMP.cold;
              const isContacted = contacted.has(r.lead_id);
              const composing = compose?.leadId === r.lead_id;
              return (
                <li key={r.lead_id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                  <div className="flex items-center gap-2">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-900 text-xs font-bold text-white">
                      {r.score ?? '—'}
                    </span>
                    <span className="truncate text-sm font-semibold text-white">{r.name}</span>
                    <span className={`ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${t.cls}`}>
                      <t.Icon className="h-3 w-3" /> {t.label}
                    </span>
                  </div>
                  {r.reason && <p className="mt-1.5 text-xs text-slate-500">{r.reason}</p>}
                  {r.next_action && (
                    <p className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-emerald-300">
                      <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {r.next_action}
                    </p>
                  )}
                  {r.profile && <p className="mt-1 text-[11px] text-slate-400">{r.profile}</p>}

                  {/* Co-pilot actions */}
                  {!composing && replyOpen !== r.lead_id && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {isContacted && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-300">
                          <Check className="h-3.5 w-3.5" /> Contacted
                        </span>
                      )}
                      {!isContacted && (
                        <button type="button" onClick={() => openCompose(r.lead_id)} disabled={draftingId === r.lead_id}
                          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 px-3 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/15 disabled:opacity-50">
                          {draftingId === r.lead_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                          {draftingId === r.lead_id ? 'Drafting…' : 'Draft outreach'}
                        </button>
                      )}
                      <button type="button" onClick={() => { setReplyOpen(r.lead_id); setReplyText(''); }}
                        className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-slate-300 hover:bg-white/[0.03]">
                        <Reply className="h-3.5 w-3.5" /> Reply came in
                      </button>
                    </div>
                  )}

                  {/* Paste-the-reply box */}
                  {replyOpen === r.lead_id && (
                    <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Paste the customer&apos;s reply</div>
                      <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={3}
                        placeholder="e.g. Sounds interesting — what's the price for 50 units?"
                        className="w-full resize-none rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/40" />
                      <div className="mt-2 flex items-center justify-end gap-2">
                        <button type="button" onClick={() => { setReplyOpen(null); setReplyText(''); }}
                          className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/[0.02]">Cancel</button>
                        <button type="button" onClick={() => analyzeReply(r.lead_id)} disabled={analyzingReply || !replyText.trim()}
                          className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
                          {analyzingReply ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                          {analyzingReply ? 'Reading…' : 'Analyse reply'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Composer */}
                  {composing && compose && (
                    <div className="mt-2 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-3">
                      {replyAnalysis?.leadId === r.lead_id && (
                        <div className="mb-2 rounded-lg bg-white/70 p-2 ring-1 ring-white/10">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Reply read</span>
                            {(() => { const m = INTEREST[replyAnalysis.a.interest] || INTEREST.neutral;
                              return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${m.cls}`}>{m.label}</span>; })()}
                            {replyAnalysis.a.intent && <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold text-slate-500">{replyAnalysis.a.intent.replace(/_/g, ' ')}</span>}
                          </div>
                          {replyAnalysis.a.summary && <p className="mt-1 text-[11px] text-slate-500">{replyAnalysis.a.summary}</p>}
                          <p className="mt-1 text-[10px] text-slate-400">Suggested reply below — edit + approve to send.</p>
                        </div>
                      )}
                      {compose.channels.length === 0 ? (
                        <div className="flex items-start gap-2 text-xs text-amber-300">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>
                            No channel connected yet. <Link href={`/w/${workspaceId}/leads/credentials`} className="font-semibold underline">Connect email, SMS or WhatsApp</Link> to let the agent send. (Draft below — you can copy it.)
                          </span>
                        </div>
                      ) : (
                        <div className="mb-2 flex items-center gap-2">
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Send via</span>
                          <select
                            value={compose.channelId ?? ''}
                            onChange={(e) => {
                              const id = Number(e.target.value);
                              const ch = compose.channels.find((c) => c.id === id);
                              setCompose({ ...compose, channelId: id, channelKind: ch?.kind || compose.channelKind });
                            }}
                            className="rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-1 text-sm text-white outline-none focus:border-emerald-500/40">
                            {compose.channels.map((c) => (
                              <option key={c.id} value={c.id}>{CHANNEL[c.kind]?.label || c.kind}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      <textarea
                        value={compose.body}
                        onChange={(e) => setCompose({ ...compose, body: e.target.value })}
                        rows={6}
                        className="w-full resize-none rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/40"
                      />
                      <div className="mt-2 flex items-center justify-end gap-2">
                        <button type="button" onClick={() => setCompose(null)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/[0.02]">
                          <X className="h-3.5 w-3.5" /> Cancel
                        </button>
                        <button type="button" onClick={send} disabled={sending || !compose.channelId || !compose.body.trim()}
                          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-50">
                          {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                          {sending ? 'Sending…' : 'Approve & send'}
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          <li className="pt-1 text-right">
            <Link href={`/w/${workspaceId}/leads`} className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-300 hover:underline">
              See full pipeline <ArrowRight className="h-3 w-3" />
            </Link>
          </li>
        </ul>
      )}
    </div>
  );
}

function errMsg(e: unknown): string | undefined {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
}
