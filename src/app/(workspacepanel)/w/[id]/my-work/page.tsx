'use client';

import { useCallback, useEffect, useMemo, useState, use as reactUse } from 'react';
import Link from 'next/link';
import {
  UserCheck, CalendarClock, CheckSquare, Sparkles, Clock,
  Mail, Phone, MapPin, Video, AlertTriangle, Globe2, Check, CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { OrganizationService } from '@/services/organization.service';
import { useAuthStore } from '@/store/authStore';

/**
 * My Work — personalized landing page.
 *
 * Top-level tabs: Leads | Tasks | Appointments. The Tasks tab gets a
 * second-level toggle for Open vs Completed since the user explicitly
 * asked to see what they've finished. The other two tabs don't get
 * Completed (a "completed" lead isn't really a thing in the same way,
 * and an appointment timeline lives on its own detail page).
 */

interface LeadLite {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  status: string;
}

interface AppointmentLite {
  id: number;
  title: string;
  starts_at: string;
  duration_minutes: number;
  status: string;
  meet_link: string | null;
  location: string;
  contact_email: string | null;
  lead: number | null;
  lead_name: string | null;
  client_time?: { time: string; date: string; timezone: string } | null;
  staff_time?: { time: string; date: string; timezone: string } | null;
}

interface TaskLite {
  id: number;
  title: string;
  description: string;
  kind: string;
  status: 'open' | 'in_progress' | 'done' | string;
  due_at: string | null;
  lead: number | null;
  lead_name?: string | null;
  completed_at?: string | null;
}

type Tab = 'leads' | 'tasks' | 'appointments';
type Scope = 'open' | 'completed';

// Leads: completed = won/lost (terminal states); open = everything else.
const isLeadDone = (l: { status: string }) => l.status === 'won' || l.status === 'lost';
// Appointments: completed = completed/cancelled/no_show; open = pending/confirmed.
const isApptDone = (a: { status: string }) =>
  a.status === 'completed' || a.status === 'cancelled' || a.status === 'no_show';

export default function MyWorkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  // No <PermissionGuard> here on purpose — every authenticated member
  // gets a "My Work" page scoped to their own assignments, regardless
  // of whether their role grants the view-all crm.leads_view code. The
  // backend list endpoints auto-scope by assignee for non-admins, so
  // unrelated leads / tasks / appointments never leak.
  return <Inner wsId={wsId} />;
}

function Inner({ wsId }: { wsId: string }) {
  const user = useAuthStore((s) => s.user);

  const [tab, setTab] = useState<Tab>('leads');
  // Each tab keeps its own Open/Completed pivot so switching tabs doesn't
  // reset the user's filter on another tab.
  const [leadScope, setLeadScope] = useState<Scope>('open');
  const [taskScope, setTaskScope] = useState<Scope>('open');
  const [apptScope, setApptScope] = useState<Scope>('open');

  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<LeadLite[]>([]);
  const [appts, setAppts] = useState<AppointmentLite[]>([]);
  const [tasks, setTasks] = useState<TaskLite[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    // ``allSettled`` so a 403 on one resource (e.g. a brand-new member
    // without ``tasks.view``) doesn't blank out the entire page —
    // failed slices just stay empty.
    const [leadsRes, apptRes, taskRes] = await Promise.allSettled([
      OrganizationService.listLeads({ workspace: Number(wsId), assigned: 'mine' }),
      OrganizationService.listAppointments({ scope: 'all', assigned: 'mine' }),
      OrganizationService.listTasks({ scope: 'mine' }),
    ]);
    if (leadsRes.status === 'fulfilled' && leadsRes.value?.success) {
      setLeads(leadsRes.value.data || []);
    }
    if (apptRes.status === 'fulfilled' && apptRes.value?.success) {
      setAppts(apptRes.value.data?.appointments || []);
    }
    if (taskRes.status === 'fulfilled' && taskRes.value?.success) {
      setTasks(taskRes.value.data || []);
    }
    setLoading(false);
  }, [wsId]);

  useEffect(() => { load(); }, [load]);

  // Local mark-complete so the UI updates without a full refetch.
  const toggleTaskComplete = async (t: TaskLite) => {
    const isDone = t.status === 'done';
    try {
      const res = isDone
        ? await OrganizationService.updateTask(t.id, { status: 'open', completed_at: null })
        : await OrganizationService.completeTask(t.id);
      if (res?.success) {
        const next = res.data as TaskLite;
        setTasks((cur) => cur.map((x) => (x.id === t.id ? { ...x, ...next } : x)));
        toast.success(isDone ? 'Reopened' : 'Completed');
      } else {
        toast.error(res?.message || 'Could not update task');
      }
    } catch {
      toast.error('Network error');
    }
  };

  // Leads: "completed" means won (you can mark lost from the lead detail
  // page if needed). Toggling a completed lead back puts it in 'new'.
  const toggleLeadComplete = async (l: LeadLite) => {
    const done = isLeadDone(l);
    const nextStatus = done ? 'new' : 'won';
    try {
      const res = await OrganizationService.updateLead(l.id, { status: nextStatus });
      if (res?.success) {
        setLeads((cur) => cur.map((x) => (x.id === l.id ? { ...x, status: nextStatus } : x)));
        toast.success(done ? 'Reopened' : 'Marked won');
      } else {
        toast.error(res?.message || 'Could not update lead');
      }
    } catch {
      toast.error('Network error');
    }
  };

  // Appointments: "completed" maps to the appointment status. Toggling
  // back puts it in 'confirmed'.
  const toggleApptComplete = async (a: AppointmentLite) => {
    const done = isApptDone(a);
    const nextStatus = done ? 'confirmed' : 'completed';
    try {
      const res = await OrganizationService.updateAppointment(a.id, { status: nextStatus });
      if (res?.success) {
        setAppts((cur) => cur.map((x) => (x.id === a.id ? { ...x, status: nextStatus } : x)));
        toast.success(done ? 'Reopened' : 'Marked completed');
      } else {
        toast.error(res?.message || 'Could not update appointment');
      }
    } catch {
      toast.error('Network error');
    }
  };

  const openTasks = useMemo(
    () => tasks.filter((t) => t.status === 'open' || t.status === 'in_progress'),
    [tasks],
  );
  const completedTasks = useMemo(
    () => tasks.filter((t) => t.status === 'done'),
    [tasks],
  );
  const openLeads = useMemo(() => leads.filter((l) => !isLeadDone(l)), [leads]);
  const completedLeads = useMemo(() => leads.filter(isLeadDone), [leads]);
  const openAppts = useMemo(() => appts.filter((a) => !isApptDone(a)), [appts]);
  const completedAppts = useMemo(() => appts.filter(isApptDone), [appts]);

  if (loading) return <PageSkeleton kind="list" />;

  const greetingName = (() => {
    const e = user?.email || '';
    return e.split('@')[0].split('.')[0].replace(/^./, (c) => c.toUpperCase()) || 'there';
  })();

  const tabs: { key: Tab; label: string; icon: React.ReactNode; count: number }[] = [
    { key: 'leads',        label: 'Leads',        icon: <Sparkles className="w-4 h-4" />,      count: openLeads.length },
    { key: 'tasks',        label: 'Tasks',        icon: <CheckSquare className="w-4 h-4" />,   count: openTasks.length },
    { key: 'appointments', label: 'Appointments', icon: <CalendarClock className="w-4 h-4" />, count: openAppts.length },
  ];

  // Shared sub-toggle config — same Open/Completed pair for every tab.
  type ScopeChoice = { scope: Scope; current: Scope; setter: (s: Scope) => void; openN: number; doneN: number };
  const scopeChoice: ScopeChoice | null =
    tab === 'leads'        ? { scope: leadScope, current: leadScope, setter: setLeadScope, openN: openLeads.length, doneN: completedLeads.length }
    : tab === 'tasks'      ? { scope: taskScope, current: taskScope, setter: setTaskScope, openN: openTasks.length, doneN: completedTasks.length }
    : tab === 'appointments' ? { scope: apptScope, current: apptScope, setter: setApptScope, openN: openAppts.length, doneN: completedAppts.length }
    : null;

  return (
    <div>
      {/* Hero */}
      <div className="mb-6 rounded-2xl border border-white/5 bg-gradient-to-br from-emerald-500/[0.06] via-cyan-500/[0.04] to-transparent p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center justify-center shrink-0">
            <UserCheck className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">Hi, {greetingName}.</h1>
            <p className="text-sm text-slate-400 mt-1">
              Everything assigned to you — flip between tabs to see leads, tasks, and meetings.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex flex-wrap gap-1.5 border-b border-white/5">
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`relative inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors -mb-px border-b-2 ${
                active
                  ? 'border-emerald-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              {t.icon}
              {t.label}
              {t.count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  active ? 'bg-emerald-500/20 text-emerald-200' : 'bg-white/[0.06] text-slate-400'
                }`}>{t.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Shared sub-toggle — same Open / Completed pair on every tab. */}
      {scopeChoice && (
        <div className="mb-4 inline-flex gap-1.5 p-1 rounded-xl bg-white/[0.02] border border-white/5">
          <button
            onClick={() => scopeChoice.setter('open')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              scopeChoice.current === 'open' ? 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/30' : 'text-slate-400 hover:text-white'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            Open
            <span className="text-[10px] text-slate-500">{scopeChoice.openN}</span>
          </button>
          <button
            onClick={() => scopeChoice.setter('completed')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              scopeChoice.current === 'completed' ? 'bg-cyan-500/15 text-cyan-200 border border-cyan-500/30' : 'text-slate-400 hover:text-white'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Completed
            <span className="text-[10px] text-slate-500">{scopeChoice.doneN}</span>
          </button>
        </div>
      )}

      {/* Tab content */}
      {tab === 'leads' && (
        <LeadsPanel
          wsId={wsId}
          leads={leadScope === 'open' ? openLeads : completedLeads}
          scope={leadScope}
          onToggle={toggleLeadComplete}
        />
      )}
      {tab === 'tasks' && (
        <TasksPanel
          wsId={wsId}
          tasks={taskScope === 'open' ? openTasks : completedTasks}
          scope={taskScope}
          onToggle={toggleTaskComplete}
        />
      )}
      {tab === 'appointments' && (
        <AppointmentsPanel
          wsId={wsId}
          appts={apptScope === 'open' ? openAppts : completedAppts}
          scope={apptScope}
          onToggle={toggleApptComplete}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
//  Panels
// ──────────────────────────────────────────────────────────────────────

// Client-side pagination — every panel shows ``PAGE_SIZE`` rows at a
// time with a "Load more" button. Server returns the full list (~3k
// rows) but rendering them all at once janks the browser; chunking
// keeps the DOM small. Reset to the first page whenever the source
// array reference changes (scope switch, refetch).
const PAGE_SIZE = 25;

function usePagedSlice<T>(items: T[]): { visible: T[]; hasMore: number; loadMore: () => void } {
  const [count, setCount] = useState(PAGE_SIZE);
  useEffect(() => { setCount(PAGE_SIZE); }, [items]);
  const visible = useMemo(() => items.slice(0, count), [items, count]);
  return {
    visible,
    hasMore: Math.max(0, items.length - visible.length),
    loadMore: () => setCount((c) => c + PAGE_SIZE),
  };
}

function LoadMoreButton({ remaining, onClick }: { remaining: number; onClick: () => void }) {
  return (
    <li className="list-none">
      <button
        type="button"
        onClick={onClick}
        className="w-full mt-2 px-4 py-2.5 rounded-xl border border-dashed border-white/10 hover:border-emerald-500/30 hover:bg-emerald-500/[0.04] text-xs font-semibold text-slate-400 hover:text-emerald-300 transition-colors"
      >
        Load {Math.min(PAGE_SIZE, remaining)} more
        <span className="ml-1.5 text-slate-600">({remaining} left)</span>
      </button>
    </li>
  );
}

function LeadsPanel({
  wsId, leads, scope, onToggle,
}: { wsId: string; leads: LeadLite[]; scope: Scope; onToggle: (l: LeadLite) => void }) {
  const { visible, hasMore, loadMore } = usePagedSlice(leads);
  if (leads.length === 0) {
    return <Empty text={scope === 'completed'
      ? 'No closed leads yet. Mark a lead as won (or lost) to move it here.'
      : 'Nothing assigned to you yet. Leads show up here as they get routed your way.'} />;
  }
  return (
    <ul className="space-y-2">
      {visible.map((l) => {
        const done = isLeadDone(l);
        const chip = l.status === 'won'   ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200'
                    : l.status === 'lost' ? 'border-red-500/40 bg-red-500/10 text-red-200'
                    :                       'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
        return (
          <li key={l.id} className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] p-3">
            <button
              onClick={() => onToggle(l)}
              aria-label={done ? 'Reopen lead' : 'Mark lead as won'}
              className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                done
                  ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-200'
                  : 'border-slate-600 hover:border-emerald-500/60 hover:bg-emerald-500/10'
              }`}
            >
              {done && <Check className="w-3.5 h-3.5" />}
            </button>
            <Link href={`/w/${wsId}/leads/${l.id}`} className="flex-1 min-w-0 block">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className={`text-sm font-semibold truncate ${done ? 'text-slate-500 line-through' : 'text-white'}`}>
                    {`${l.first_name || ''} ${l.last_name || ''}`.trim() || l.email || `Lead #${l.id}`}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                    {l.email && <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" />{l.email}</span>}
                    {l.phone && <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{l.phone}</span>}
                  </div>
                </div>
                <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${chip}`}>
                  {l.status || 'new'}
                </span>
              </div>
            </Link>
          </li>
        );
      })}
      {hasMore > 0 && <LoadMoreButton remaining={hasMore} onClick={loadMore} />}
    </ul>
  );
}

function TasksPanel({
  wsId, tasks, scope, onToggle,
}: { wsId: string; tasks: TaskLite[]; scope: Scope; onToggle: (t: TaskLite) => void }) {
  const { visible, hasMore, loadMore } = usePagedSlice(tasks);
  if (tasks.length === 0) {
    return <Empty text={scope === 'completed'
      ? 'Nothing finished yet. Tick the checkbox on an open task to move it here.'
      : 'No open tasks. Inbox zero feeling 🎉'} />;
  }
  return (
    <ul className="space-y-2">
      {visible.map((t) => {
        const due = t.due_at ? new Date(t.due_at) : null;
        const overdue = due ? due.getTime() < Date.now() && t.status !== 'done' : false;
        const done = t.status === 'done';
        return (
          <li key={t.id} className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3">
            <button
              onClick={() => onToggle(t)}
              aria-label={done ? 'Reopen task' : 'Complete task'}
              className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                done
                  ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-200'
                  : 'border-slate-600 hover:border-emerald-500/60 hover:bg-emerald-500/10'
              }`}
            >
              {done && <Check className="w-3.5 h-3.5" />}
            </button>
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-semibold truncate ${done ? 'text-slate-500 line-through' : 'text-white'}`}>
                {t.title}
              </div>
              {t.description && (
                <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{t.description}</div>
              )}
              <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                {due && !done && (
                  <span className={`inline-flex items-center gap-1 ${overdue ? 'text-red-300' : ''}`}>
                    <Clock className="w-3 h-3" />
                    {overdue ? 'Overdue · ' : ''}{due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} {due.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </span>
                )}
                {done && t.completed_at && (
                  <span className="inline-flex items-center gap-1 text-cyan-300/80">
                    <CheckCircle2 className="w-3 h-3" />
                    Completed {new Date(t.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
                {t.lead && t.lead_name && (
                  <Link href={`/w/${wsId}/leads/${t.lead}`} className="text-emerald-300 hover:underline">
                    · {t.lead_name}
                  </Link>
                )}
              </div>
            </div>
          </li>
        );
      })}
      {hasMore > 0 && <LoadMoreButton remaining={hasMore} onClick={loadMore} />}
    </ul>
  );
}

function AppointmentsPanel({
  wsId, appts, scope, onToggle,
}: { wsId: string; appts: AppointmentLite[]; scope: Scope; onToggle: (a: AppointmentLite) => void }) {
  const { visible, hasMore, loadMore } = usePagedSlice(appts);
  if (appts.length === 0) {
    return <Empty text={scope === 'completed'
      ? 'No completed meetings yet. Tick a meeting after it happens to move it here.'
      : 'No upcoming meetings on your calendar.'} />;
  }
  return (
    <ul className="space-y-2">
      {visible.map((a) => {
        const start = new Date(a.starts_at);
        const done = isApptDone(a);
        const chip = a.status === 'completed' ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200'
                    : a.status === 'cancelled' ? 'border-red-500/40 bg-red-500/10 text-red-200'
                    : a.status === 'no_show'   ? 'border-violet-500/40 bg-violet-500/10 text-violet-200'
                    : a.status === 'confirmed' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                    :                            'border-amber-500/30 bg-amber-500/10 text-amber-200';
        return (
          <li key={a.id} className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] p-3">
            <button
              onClick={() => onToggle(a)}
              aria-label={done ? 'Reopen appointment' : 'Mark appointment completed'}
              className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                done
                  ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-200'
                  : 'border-slate-600 hover:border-emerald-500/60 hover:bg-emerald-500/10'
              }`}
            >
              {done && <Check className="w-3.5 h-3.5" />}
            </button>
            <Link href={`/w/${wsId}/appointments/${a.id}`} className="flex-1 min-w-0 block">
              <div className="flex items-center gap-3">
                <div className="text-center shrink-0 w-12">
                  <div className="text-[9px] uppercase tracking-wider text-slate-500">{start.toLocaleString('en-US', { month: 'short' })}</div>
                  <div className="text-xl font-bold text-white tabular-nums leading-none">{start.getDate()}</div>
                  <div className="text-[9px] text-slate-500">{start.toLocaleString('en-US', { weekday: 'short' })}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className={`text-sm font-semibold truncate ${done ? 'text-slate-500 line-through' : 'text-white'}`}>{a.title}</div>
                    <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${chip}`}>{a.status}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} · {a.duration_minutes}m</span>
                    {a.meet_link && <span className="inline-flex items-center gap-1 text-emerald-300"><Video className="w-3 h-3" />Meet</span>}
                    {!a.meet_link && a.location && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{a.location}</span>}
                  </div>
                  {a.client_time && a.staff_time && a.client_time.timezone !== a.staff_time.timezone && (
                    <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-cyan-300/80">
                      <Globe2 className="w-2.5 h-2.5" />
                      client {a.client_time.time} ({a.client_time.timezone})
                    </div>
                  )}
                </div>
              </div>
            </Link>
          </li>
        );
      })}
      {hasMore > 0 && <LoadMoreButton remaining={hasMore} onClick={loadMore} />}
    </ul>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}
