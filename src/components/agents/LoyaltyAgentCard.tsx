'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Star, Wand2, Loader2, Clock, Crown, Lightbulb, TrendingUp, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { LoyaltyAgent, type LoyaltySummaryData } from '@/services/agents.service';

/**
 * Loyalty Agent work surface — reads memberships + points and flags who's about
 * to lapse, who the best members are, and how to keep them. Read-only advisor.
 */
export default function LoyaltyAgentCard({ workspaceId, embed }: { workspaceId: string | number; embed?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<LoyaltySummaryData | null>(null);

  const analyse = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const r = await LoyaltyAgent.summary(workspaceId);
      if (r.success && r.data) setData(r.data);
      else toast.error(r.message || 'Could not read loyalty.');
    } catch (e) {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Could not read loyalty right now.');
    } finally {
      setLoading(false);
    }
  };

  const bullets = (data?.insights || '').split('\n').map((l) => l.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);

  return (
    <div className={embed ? '' : 'mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5 shadow-sm'}>
      <p className={embed ? 'text-sm text-slate-500' : 'mt-1 text-sm text-slate-500'}>
        Reads your members and points, then flags who&apos;s about to lapse, who your best members are,
        and how to keep them. <strong>Read-only</strong> — it never changes anything.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={analyse} disabled={loading}
          className="inline-flex items-center gap-2 rounded-full bg-pink-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-pink-600 disabled:opacity-50">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          {loading ? 'Reading members…' : 'Analyse loyalty'}
        </button>
        <Link href={`/w/${workspaceId}/loyalty/memberships`} className="text-sm font-semibold text-slate-500 hover:text-pink-700">Open Loyalty</Link>
      </div>

      {data && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Kpi label="Active members" value={String(data.kpis.active_members)} />
            <Kpi label="Expiring ≤30d" value={String(data.kpis.expiring_soon)} tone={data.kpis.expiring_soon > 0 ? 'amber' : 'slate'} />
            <Kpi label="Lapsed" value={String(data.kpis.lapsed_members)} tone={data.kpis.lapsed_members > 0 ? 'rose' : 'slate'} />
            <Kpi label="Points out" value={data.kpis.total_points.toLocaleString()} />
          </div>

          {data.expiring.length > 0 && (
            <div className="rounded-xl border border-amber-100 bg-amber-500/40 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-300"><Clock className="h-3.5 w-3.5" /> Expiring soon — reach out</p>
              <ul className="mt-1.5 space-y-1">
                {data.expiring.slice(0, 6).map((m, i) => (
                  <li key={i} className="flex items-center justify-between text-[13px] text-slate-200">
                    <span className="truncate">{m.customer}{m.plan ? ` · ${m.plan}` : ''}</span>
                    <span className="font-semibold text-amber-300">{m.days_left != null ? `${m.days_left}d left` : ''}</span>
                  </li>
                ))}
              </ul>
              <Link href={`/w/${workspaceId}/loyalty/memberships`} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-300 hover:underline">
                Manage memberships <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          )}

          {data.top_members.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-300"><Crown className="h-3.5 w-3.5 text-amber-500" /> Your best members</p>
              <ul className="mt-1.5 space-y-1">
                {data.top_members.map((t, i) => (
                  <li key={i} className="flex items-center justify-between text-[13px] text-slate-200">
                    <span className="truncate">{t.customer}{t.tier ? ` · ${t.tier}` : ''}</span>
                    <span className="font-semibold">{t.points.toLocaleString()} pts</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {bullets.length > 0 && (
            <div className="rounded-xl border border-pink-100 bg-pink-50/40 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-pink-700"><Lightbulb className="h-3.5 w-3.5" /> What I&apos;d do</p>
              <ul className="mt-1.5 space-y-1">
                {bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[13px] text-slate-200"><TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-pink-500" /> {b}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, tone = 'slate' }: { label: string; value: string; tone?: 'slate' | 'amber' | 'rose' }) {
  const cls = tone === 'amber' ? 'text-amber-300' : tone === 'rose' ? 'text-rose-300' : 'text-white';
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-0.5 text-lg font-bold ${cls}`}>{value}</p>
    </div>
  );
}
