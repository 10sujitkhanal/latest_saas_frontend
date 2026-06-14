'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Wand2, Loader2, Lightbulb, TrendingUp, Check, X, CalendarOff } from 'lucide-react';
import { toast } from 'sonner';
import { StaffAgent, type StaffSummaryData, type PendingLeave } from '@/services/agents.service';

/**
 * Staff/HR Agent work surface — reads the team (people, attendance, leave) and
 * tells the owner who's in, who's off, and what's awaiting approval. Read-only,
 * plus a one-click leave Approve/Reject (reuses the HR leave-decision endpoint).
 */
export default function StaffAgentCard({ workspaceId, embed }: { workspaceId: string | number; embed?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<StaffSummaryData | null>(null);
  const [pending, setPending] = useState<PendingLeave[]>([]);
  const [actingId, setActingId] = useState<number | null>(null);

  const analyse = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const r = await StaffAgent.summary(workspaceId);
      if (r.success && r.data) { setData(r.data); setPending(r.data.pending_leave || []); }
      else toast.error(r.message || 'Could not read your team.');
    } catch (e) {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Could not read your team right now.');
    } finally {
      setLoading(false);
    }
  };

  const decide = async (lr: PendingLeave, decision: 'approved' | 'rejected') => {
    if (actingId !== null) return;
    setActingId(lr.id);
    try {
      const r = await StaffAgent.decideLeave(workspaceId, lr.id, decision);
      if (r.success) {
        toast.success(`${lr.employee}'s leave ${decision}.`);
        setPending((p) => p.filter((x) => x.id !== lr.id));
      } else toast.error(r.message || 'Could not update the request.');
    } catch (e) {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Could not update the request.');
    } finally { setActingId(null); }
  };

  const bullets = (data?.insights || '').split('\n').map((l) => l.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);

  return (
    <div className={embed ? '' : 'mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5 shadow-sm'}>
      <p className={embed ? 'text-sm text-slate-500' : 'mt-1 text-sm text-slate-500'}>
        Reads your team — who&apos;s in, who&apos;s off, today&apos;s attendance, and leave awaiting
        approval. <strong>Read-only</strong>, except you can approve leave in one click here.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={analyse} disabled={loading}
          className="inline-flex items-center gap-2 rounded-full bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-600 disabled:opacity-50">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          {loading ? 'Reading the team…' : 'Analyse my team'}
        </button>
        <Link href={`/w/${workspaceId}/hr/employees`} className="text-sm font-semibold text-slate-500 hover:text-indigo-700">Open Staff</Link>
      </div>

      {data && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Kpi label="Active staff" value={String(data.kpis.active)} sub={data.kpis.on_leave ? `${data.kpis.on_leave} on leave` : undefined} />
            <Kpi label="Present today" value={String(data.kpis.present_today)} tone="emerald" />
            <Kpi label="Absent / late" value={`${data.kpis.absent_today} / ${data.kpis.late_today}`} tone={data.kpis.absent_today > 0 ? 'rose' : 'slate'} />
            <Kpi label="Leave to approve" value={String(data.kpis.pending_leave)} tone={data.kpis.pending_leave > 0 ? 'amber' : 'slate'} />
          </div>

          {pending.length > 0 && (
            <div className="rounded-xl border border-amber-100 bg-amber-500/15/40 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-300"><CalendarOff className="h-3.5 w-3.5" /> Leave awaiting your approval</p>
              <ul className="mt-2 space-y-2">
                {pending.map((lr) => (
                  <li key={lr.id} className="flex items-center gap-3 rounded-lg border border-amber-100 bg-white/[0.02] p-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold text-white">{lr.employee} <span className="font-normal text-slate-400">· {lr.type}</span></div>
                      <div className="text-[11px] text-slate-400">{lr.start_date}{lr.end_date && lr.end_date !== lr.start_date ? ` → ${lr.end_date}` : ''} · {lr.days} day{lr.days === '1' || lr.days === '1.0' ? '' : 's'}{lr.reason ? ` · ${lr.reason}` : ''}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button type="button" onClick={() => decide(lr, 'approved')} disabled={actingId === lr.id}
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                        {actingId === lr.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Approve
                      </button>
                      <button type="button" onClick={() => decide(lr, 'rejected')} disabled={actingId === lr.id}
                        className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-xs font-semibold text-slate-500 hover:bg-rose-500/15 hover:text-rose-600 disabled:opacity-50">
                        <X className="h-3.5 w-3.5" /> Reject
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {bullets.length > 0 && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700"><Lightbulb className="h-3.5 w-3.5" /> What I&apos;d do</p>
              <ul className="mt-1.5 space-y-1">
                {bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[13px] text-slate-200"><TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500" /> {b}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, sub, tone = 'slate' }: { label: string; value: string; sub?: string; tone?: 'slate' | 'rose' | 'emerald' | 'amber' }) {
  const cls = tone === 'rose' ? 'text-rose-300' : tone === 'emerald' ? 'text-emerald-300' : tone === 'amber' ? 'text-amber-300' : 'text-white';
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-0.5 text-lg font-bold ${cls}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
    </div>
  );
}
