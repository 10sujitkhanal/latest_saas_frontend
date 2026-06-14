'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CalendarCheck, Wand2, Loader2, Clock, Lightbulb, TrendingUp, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { BookingsAgent, type BookingsSummaryData } from '@/services/agents.service';

/**
 * Bookings Agent work surface — reads upcoming bookings and tells the owner
 * what's today, what needs confirming, and the week ahead. Read-only advisor.
 */
export default function BookingsAgentCard({ workspaceId, embed }: { workspaceId: string | number; embed?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<BookingsSummaryData | null>(null);

  const analyse = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const r = await BookingsAgent.summary(workspaceId);
      if (r.success && r.data) setData(r.data);
      else toast.error(r.message || 'Could not read bookings.');
    } catch (e) {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Could not read bookings right now.');
    } finally {
      setLoading(false);
    }
  };

  const bullets = (data?.insights || '').split('\n').map((l) => l.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);

  return (
    <div className={embed ? '' : 'mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5 shadow-sm'}>
      <p className={embed ? 'text-sm text-slate-500' : 'mt-1 text-sm text-slate-500'}>
        Reads your upcoming bookings and tells you what&apos;s on today, what still needs confirming,
        and the week ahead. <strong>Read-only</strong> — manage the bookings on the Bookings page.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={analyse} disabled={loading}
          className="inline-flex items-center gap-2 rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-cyan-600 disabled:opacity-50">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          {loading ? 'Checking the calendar…' : 'Check upcoming bookings'}
        </button>
        <Link href={`/w/${workspaceId}/marketplace/bookings`} className="text-sm font-semibold text-slate-500 hover:text-cyan-700">Open Bookings</Link>
      </div>

      {data && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Kpi label="Today" value={String(data.kpis.today)} />
            <Kpi label="Pending" value={String(data.kpis.pending)} tone={data.kpis.pending > 0 ? 'amber' : 'slate'} />
            <Kpi label="Next 7 days" value={String(data.kpis.this_week)} />
            <Kpi label="Upcoming" value={String(data.kpis.upcoming)} />
          </div>

          {data.upcoming.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-300"><Clock className="h-3.5 w-3.5 text-cyan-600" /> Next up</p>
              <ul className="mt-1.5 space-y-1">
                {data.upcoming.slice(0, 6).map((b, i) => (
                  <li key={i} className="flex items-center justify-between text-[13px] text-slate-200">
                    <span className="truncate">{b.customer} · {b.service}</span>
                    <span className="shrink-0 text-slate-500">{b.date}{b.time ? ` ${b.time}` : ''}{b.status === 'pending' ? ' · pending' : ''}</span>
                  </li>
                ))}
              </ul>
              <Link href={`/w/${workspaceId}/marketplace/bookings`} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-cyan-700 hover:underline">
                Manage bookings <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          )}

          {bullets.length > 0 && (
            <div className="rounded-xl border border-cyan-100 bg-cyan-50/40 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-cyan-700"><Lightbulb className="h-3.5 w-3.5" /> What I&apos;d do</p>
              <ul className="mt-1.5 space-y-1">
                {bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[13px] text-slate-200"><TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-500" /> {b}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, tone = 'slate' }: { label: string; value: string; tone?: 'slate' | 'amber' }) {
  const cls = tone === 'amber' ? 'text-amber-300' : 'text-white';
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-0.5 text-lg font-bold ${cls}`}>{value}</p>
    </div>
  );
}
