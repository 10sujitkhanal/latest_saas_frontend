'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Wand2, Loader2, Lightbulb, TrendingUp, AlertTriangle, ListChecks, Plus, Check } from 'lucide-react';
import { toast } from 'sonner';
import { ProjectsAgent, type TasksSummaryData } from '@/services/agents.service';

/**
 * Projects Agent work surface — reads the team's tasks (open / overdue / due
 * soon) and advises; and breaks a goal into a set of tasks you approve + create.
 */
export default function ProjectsAgentCard({ workspaceId, embed }: { workspaceId: string | number; embed?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<TasksSummaryData | null>(null);

  const [goal, setGoal] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [titles, setTitles] = useState<string[] | null>(null);
  const [creating, setCreating] = useState(false);

  const analyse = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const r = await ProjectsAgent.summary(workspaceId);
      if (r.success && r.data) setData(r.data);
      else toast.error(r.message || 'Could not read your tasks.');
    } catch (e) {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Could not read your tasks right now.');
    } finally { setLoading(false); }
  };

  const breakdown = async () => {
    if (drafting || !goal.trim()) return;
    setDrafting(true); setTitles(null);
    try {
      const r = await ProjectsAgent.breakdown(workspaceId, goal.trim());
      if (r.success) setTitles(r.data?.titles || []);
      else toast.error(r.message || 'Could not break that down.');
    } catch (e) {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Could not break that down right now.');
    } finally { setDrafting(false); }
  };

  const createAll = async () => {
    if (creating || !titles || !titles.length) return;
    setCreating(true);
    try {
      const r = await ProjectsAgent.createTasks(workspaceId, titles);
      if (r.success) {
        toast.success(`Created ${r.data?.created ?? 0} task${(r.data?.created ?? 0) === 1 ? '' : 's'}.`);
        setTitles(null); setGoal('');
        analyse();
      } else toast.error(r.message || 'Could not create the tasks.');
    } catch (e) {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Could not create the tasks.');
    } finally { setCreating(false); }
  };

  const bullets = (data?.insights || '').split('\n').map((l) => l.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);

  return (
    <div className={embed ? '' : 'mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5 shadow-sm'}>
      <p className={embed ? 'text-sm text-slate-500' : 'mt-1 text-sm text-slate-500'}>
        Reads your tasks — what&apos;s open, overdue, and due next — and can break a goal into a
        set of tasks you approve. <strong>Read-only</strong>, except creating tasks you confirm.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={analyse} disabled={loading}
          className="inline-flex items-center gap-2 rounded-full bg-slate-700 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800 disabled:opacity-50">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          {loading ? 'Reading tasks…' : 'Review my work'}
        </button>
        <Link href={`/w/${workspaceId}/tasks?scope=all`} className="text-sm font-semibold text-slate-500 hover:text-white">Open Tasks</Link>
      </div>

      {data && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Kpi label="Open" value={String(data.kpis.open)} />
            <Kpi label="In progress" value={String(data.kpis.in_progress)} />
            <Kpi label="Overdue" value={String(data.kpis.overdue)} tone={data.kpis.overdue > 0 ? 'rose' : 'slate'} />
            <Kpi label="Due this week" value={String(data.kpis.due_soon)} tone={data.kpis.due_soon > 0 ? 'amber' : 'slate'} />
          </div>

          {data.overdue.length > 0 && (
            <div className="rounded-xl border border-rose-100 bg-rose-500/50 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-300"><AlertTriangle className="h-3.5 w-3.5" /> Overdue</p>
              <ul className="mt-1.5 space-y-1">
                {data.overdue.slice(0, 6).map((t, i) => (
                  <li key={i} className="flex items-center justify-between text-[13px] text-slate-200">
                    <span className="truncate">{t.title}</span>
                    <span className="shrink-0 text-slate-500">{t.due}{t.assignee ? ` · ${t.assignee}` : ''}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {bullets.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-300"><Lightbulb className="h-3.5 w-3.5" /> What I&apos;d focus on</p>
              <ul className="mt-1.5 space-y-1">
                {bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[13px] text-slate-200"><TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" /> {b}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Break a goal into tasks */}
      <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-300"><ListChecks className="h-3.5 w-3.5" /> Break a goal into tasks</p>
        <div className="mt-2 flex items-center gap-2">
          <input value={goal} onChange={(e) => setGoal(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') breakdown(); }}
            placeholder="e.g. Launch the summer wellness campaign"
            className="min-w-0 flex-1 rounded-lg border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-slate-400" />
          <button type="button" onClick={breakdown} disabled={drafting || !goal.trim()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
            {drafting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} Break down
          </button>
        </div>

        {titles && (
          titles.length === 0 ? (
            <p className="mt-2 text-xs text-slate-400">Couldn&apos;t draft tasks for that — try a clearer goal.</p>
          ) : (
            <div className="mt-2">
              <ul className="space-y-1">
                {titles.map((t, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[13px] text-slate-200"><Plus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" /> {t}</li>
                ))}
              </ul>
              <button type="button" onClick={createAll} disabled={creating}
                className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Create {titles.length} task{titles.length === 1 ? '' : 's'}
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, tone = 'slate' }: { label: string; value: string; tone?: 'slate' | 'rose' | 'amber' }) {
  const cls = tone === 'rose' ? 'text-rose-300' : tone === 'amber' ? 'text-amber-300' : 'text-white';
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-0.5 text-lg font-bold ${cls}`}>{value}</p>
    </div>
  );
}
