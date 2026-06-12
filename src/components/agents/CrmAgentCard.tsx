'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Users, Wand2, Loader2, Flame, Sun, Snowflake, ArrowRight, Lightbulb,
  Send, Check, X, Mail, MessageSquare, Phone, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { CrmAgent, type LeadAnalysis, type OutreachChannel } from '@/services/agents.service';

/**
 * CRM Agent — Advisor + Co-pilot.
 *   Advisor: score newest leads + next-best-action (writes safe signals).
 *   Co-pilot: draft a first-touch message → you approve → it sends over the
 *   channel you connected (email/SMS/WhatsApp) → the lead moves to Contacted.
 * Never sends without your approval. B2B-first; every message has an opt-out.
 */

const TEMP: Record<string, { cls: string; Icon: typeof Flame; label: string }> = {
  hot: { cls: 'bg-rose-50 text-rose-700', Icon: Flame, label: 'Hot' },
  warm: { cls: 'bg-amber-50 text-amber-700', Icon: Sun, label: 'Warm' },
  cold: { cls: 'bg-sky-50 text-sky-700', Icon: Snowflake, label: 'Cold' },
};
const CHANNEL: Record<string, { label: string; Icon: typeof Mail }> = {
  email: { label: 'Email', Icon: Mail },
  sms: { label: 'SMS', Icon: Phone },
  whatsapp: { label: 'WhatsApp', Icon: MessageSquare },
};

type Compose = { leadId: number; body: string; channels: OutreachChannel[]; channelId: number | null; channelKind: string };

export default function CrmAgentCard({ workspaceId }: { workspaceId: string | number }) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<LeadAnalysis[] | null>(null);
  const [empty, setEmpty] = useState(false);
  const [draftingId, setDraftingId] = useState<number | null>(null);
  const [compose, setCompose] = useState<Compose | null>(null);
  const [sending, setSending] = useState(false);
  const [contacted, setContacted] = useState<Set<number>>(new Set());

  const analyze = async () => {
    if (loading) return;
    setLoading(true);
    setEmpty(false);
    setCompose(null);
    try {
      const res = await CrmAgent.analyzeRecent(workspaceId, 5);
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

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-emerald-600" />
        <h2 className="text-base font-semibold text-slate-900">CRM Agent</h2>
        <span className="ml-auto rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
          advisor + co-pilot
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-500">
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
        <Link href={`/w/${workspaceId}/leads`} className="text-sm font-semibold text-slate-500 hover:text-emerald-700">Open CRM</Link>
      </div>

      {empty && (
        <p className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-center text-sm text-slate-400">
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
                <li key={r.lead_id} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex items-center gap-2">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-900 text-xs font-bold text-white">
                      {r.score ?? '—'}
                    </span>
                    <span className="truncate text-sm font-semibold text-slate-800">{r.name}</span>
                    <span className={`ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${t.cls}`}>
                      <t.Icon className="h-3 w-3" /> {t.label}
                    </span>
                  </div>
                  {r.reason && <p className="mt-1.5 text-xs text-slate-500">{r.reason}</p>}
                  {r.next_action && (
                    <p className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-emerald-700">
                      <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {r.next_action}
                    </p>
                  )}
                  {r.profile && <p className="mt-1 text-[11px] text-slate-400">{r.profile}</p>}

                  {/* Co-pilot action */}
                  <div className="mt-2">
                    {isContacted ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                        <Check className="h-3.5 w-3.5" /> Contacted
                      </span>
                    ) : !composing ? (
                      <button type="button" onClick={() => openCompose(r.lead_id)} disabled={draftingId === r.lead_id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">
                        {draftingId === r.lead_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                        {draftingId === r.lead_id ? 'Drafting…' : 'Draft outreach'}
                      </button>
                    ) : null}
                  </div>

                  {/* Composer */}
                  {composing && compose && (
                    <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
                      {compose.channels.length === 0 ? (
                        <div className="flex items-start gap-2 text-xs text-amber-700">
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
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-sm text-slate-900 outline-none focus:border-emerald-300">
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
                        className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-300"
                      />
                      <div className="mt-2 flex items-center justify-end gap-2">
                        <button type="button" onClick={() => setCompose(null)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-white">
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
            <Link href={`/w/${workspaceId}/leads`} className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline">
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
