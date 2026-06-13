'use client';

/**
 * Inline "AI for Sales" — Phase 2 of the agent access model.
 *
 * A Sales rep doesn't get the AI Staff cockpit (that's gated on `agents.manage`
 * for owners/managers). Instead they get AI help right where they work: on the
 * lead they have open. This card gives a one-tap read on the lead (score +
 * temperature + next best move, which also fills the lead's AI summary card) and
 * a ready-to-send drafted message they can copy. It reuses the SAME advisor +
 * draft endpoints the cockpit uses — no parallel path.
 */

import { useState } from 'react';
import { Bot, Sparkles, MessageSquare, Loader2, Copy, Check, CalendarClock } from 'lucide-react';
import { toast } from 'sonner';
import { CrmAgent, type LeadAnalysis } from '@/services/agents.service';
import { OrganizationService } from '@/services/organization.service';

const TEMP_CLS: Record<string, string> = {
  hot: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  warm: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  cold: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
};

export default function LeadAiAssist({
  workspaceId, leadId, canContact, onUpdated,
}: {
  workspaceId: string | number;
  leadId: number;
  canContact: boolean;
  onUpdated?: () => void;
}) {
  const [advising, setAdvising] = useState(false);
  const [analysis, setAnalysis] = useState<LeadAnalysis | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [draft, setDraft] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [scheduled, setScheduled] = useState(false);

  const scheduleFollowUp = async (nextAction: string) => {
    if (scheduling) return;
    setScheduling(true);
    try {
      const due = new Date(); due.setDate(due.getDate() + 3);
      const r = await OrganizationService.createLeadFollowUp(leadId, {
        status: 'pending',
        kind: 'task',
        title: `Follow up: ${nextAction}`.slice(0, 200),
        due_at: due.toISOString(),
      });
      if (r.success) { setScheduled(true); toast.success('Follow-up scheduled for 3 days from now.'); onUpdated?.(); }
      else toast.error(r.message || 'Could not schedule the follow-up.');
    } catch (e) {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Could not schedule the follow-up.');
    } finally { setScheduling(false); }
  };

  const advise = async () => {
    if (advising) return;
    setAdvising(true);
    try {
      const r = await CrmAgent.adviseLead(workspaceId, leadId);
      if (r.success && r.data?.analysis) {
        setAnalysis(r.data.analysis);
        toast.success('AI read this lead for you.');
        onUpdated?.();   // refresh the page so the AI summary card + badge update
      } else {
        toast.error(r.message || 'The agent could not read this lead right now.');
      }
    } catch (e) {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Could not reach the agent.');
    } finally {
      setAdvising(false);
    }
  };

  const drafted = async () => {
    if (drafting) return;
    if (!canContact) { toast.error('Add an email or phone to this lead first.'); return; }
    setDrafting(true);
    setCopied(false);
    try {
      const r = await CrmAgent.draftOutreach(workspaceId, leadId);
      const body = r.success ? (r.data?.draft?.body || '') : '';
      if (body) {
        setDraft(body);
      } else {
        toast.error(r.message || 'Could not draft a message right now.');
      }
    } catch (e) {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Could not reach the agent.');
    } finally {
      setDrafting(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked — user can select manually */ }
  };

  return (
    <section className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.06] via-cyan-500/[0.04] to-transparent p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white inline-flex items-center gap-2">
            <Bot className="w-4 h-4 text-emerald-300" /> AI assistant
          </h3>
          <p className="text-[12px] text-slate-400 mt-0.5">Get a read on this lead and a ready-to-send message.</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button" onClick={advise} disabled={advising}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {advising ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Get AI guidance
        </button>
        <button
          type="button" onClick={drafted} disabled={drafting}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 text-sm font-semibold text-slate-200 disabled:opacity-50"
        >
          {drafting ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />} Draft a message
        </button>
      </div>

      {/* Inline advice result (the page's AI summary card also updates via onUpdated). */}
      {analysis && (
        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-1.5">
          <div className="flex items-center gap-2">
            {analysis.temperature && (
              <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border font-bold ${TEMP_CLS[analysis.temperature] || TEMP_CLS.cold}`}>
                {analysis.temperature} · {analysis.score ?? 0}
              </span>
            )}
            {analysis.reason && <span className="text-[12px] text-slate-300">{analysis.reason}</span>}
          </div>
          {analysis.next_action && (
            <>
              <p className="text-[13px] text-slate-200">
                <strong className="text-emerald-200">Next move:</strong> {analysis.next_action}
              </p>
              <button
                type="button" onClick={() => scheduleFollowUp(analysis.next_action)} disabled={scheduling || scheduled}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 px-2.5 py-1 text-[11px] font-semibold text-slate-200 disabled:opacity-50">
                {scheduling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : scheduled ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <CalendarClock className="w-3.5 h-3.5" />}
                {scheduled ? 'Follow-up scheduled' : 'Schedule follow-up (3 days)'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Drafted message — copy into the reply/compose box. */}
      {draft && (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Suggested message</span>
            <button type="button" onClick={copy} className="inline-flex items-center gap-1 text-[11px] text-emerald-300 hover:text-emerald-200">
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <textarea
            value={draft} onChange={(e) => setDraft(e.target.value)} rows={5}
            className="w-full rounded-lg bg-slate-900 border border-white/10 px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500/40"
          />
        </div>
      )}
    </section>
  );
}
