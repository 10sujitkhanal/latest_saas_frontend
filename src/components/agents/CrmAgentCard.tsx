'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Users, Wand2, Loader2, Flame, Sun, Snowflake, ArrowRight, Lightbulb } from 'lucide-react';
import { toast } from 'sonner';
import { CrmAgent, type LeadAnalysis } from '@/services/agents.service';

/**
 * CRM Agent (Advisor) — scores your newest leads, classifies hot/warm/cold,
 * and suggests the single next best move. It only writes safe signals
 * (score + a timeline note) — it never contacts anyone. Advisor → Co-pilot
 * → Autopilot as trust is earned.
 */

const TEMP: Record<string, { cls: string; Icon: typeof Flame; label: string }> = {
  hot: { cls: 'bg-rose-50 text-rose-700', Icon: Flame, label: 'Hot' },
  warm: { cls: 'bg-amber-50 text-amber-700', Icon: Sun, label: 'Warm' },
  cold: { cls: 'bg-sky-50 text-sky-700', Icon: Snowflake, label: 'Cold' },
};

export default function CrmAgentCard({ workspaceId }: { workspaceId: string | number }) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<LeadAnalysis[] | null>(null);
  const [empty, setEmpty] = useState(false);

  const analyze = async () => {
    if (loading) return;
    setLoading(true);
    setEmpty(false);
    try {
      const res = await CrmAgent.analyzeRecent(workspaceId, 5);
      if (res.success) {
        setResults(res.data?.results || []);
        setEmpty(!!res.data?.empty);
      } else {
        toast.error(res.message || 'Could not analyse leads.');
      }
    } catch (e) {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Could not analyse leads right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-emerald-600" />
        <h2 className="text-base font-semibold text-slate-900">CRM Agent</h2>
        <span className="ml-auto rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
          advisor · prepares your next move
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Scores your newest leads, flags the hottest, and tells you the next best move — and writes it
        to each lead&apos;s timeline. It only advises; it never messages anyone.
      </p>

      <div className="mt-4 flex items-center gap-2">
        <button type="button" onClick={analyze} disabled={loading}
          className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-50">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          {loading ? 'Analysing…' : 'Analyse my newest leads'}
        </button>
        <Link href={`/w/${workspaceId}/leads`} className="text-sm font-semibold text-slate-500 hover:text-emerald-700">
          Open CRM
        </Link>
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
