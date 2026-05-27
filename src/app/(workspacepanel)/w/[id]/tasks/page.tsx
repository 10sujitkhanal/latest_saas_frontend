'use client';

import { useCallback, useEffect, useState, use as reactUse } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import {
  Plus, CheckCircle2, Clock, AlertTriangle, Users, CheckSquare,
  Calendar, Flame, Trash2, User as UserIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/StateViews';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import QuotaBadge from '@/components/QuotaBadge';
import { OrganizationService } from '@/services/organization.service';

/**
 * Tasks page — Mine / Team / Overdue / Today scopes, status filters, and
 * inline complete + delete.
 *
 * Visibility rules (server-enforced):
 *   - Users without ``tasks.assign`` only see tasks they own/created.
 *   - The "Team tasks" tab is hidden for those users.
 *
 * The page wraps in <PermissionGuard required="tasks.view"> so anyone who
 * lost the perm bounces to the friendly deny screen.
 */

type Scope = 'mine' | 'team' | 'overdue' | 'today' | 'all';

interface TaskRow {
  id: number;
  kind: 'task' | 'appointment' | 'lead';
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'done' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  due_at: string | null;
  completed_at: string | null;
  lead: number | null;
  lead_name: string | null;
  assigned_to: number | null;
  assigned_to_email: string | null;
  created_by_email: string | null;
  is_overdue: boolean;
  tags: string[];
}

interface Stats { mine_open: number; team_open: number; overdue: number; done_today: number; can_assign: boolean; }

const KIND_META: Record<string, { Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string; label: string }> = {
  task:        { Icon: CheckSquare, color: '#10b981', label: 'Task' },
  appointment: { Icon: Calendar,    color: '#3b82f6', label: 'Appointment' },
  lead:        { Icon: UserIcon,    color: '#a855f7', label: 'Lead work' },
};

const PRIORITY_META: Record<string, { color: string; label: string }> = {
  low:    { color: '#94a3b8', label: 'Low' },
  normal: { color: '#06b6d4', label: 'Normal' },
  high:   { color: '#f59e0b', label: 'High' },
  urgent: { color: '#ef4444', label: 'Urgent' },
};

export default function TasksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard required="tasks.view" workspaceId={wsId} skeleton="list">
      <TasksInner wsId={wsId} />
    </PermissionGuard>
  );
}

function TasksInner({ wsId }: { wsId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const scopeFromUrl = (searchParams?.get('scope') || 'mine') as Scope;

  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [scope, setScope] = useState<Scope>(scopeFromUrl);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // URL ↔ state sync.
  useEffect(() => { setScope(scopeFromUrl); }, [scopeFromUrl]);
  const pickScope = (s: Scope) => {
    setScope(s);
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.set('scope', s);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, st] = await Promise.all([
        OrganizationService.listTasks({ scope: scope === 'all' ? undefined : scope, status: statusFilter || undefined }),
        OrganizationService.taskStats(),
      ]);
      if (list?.success) setTasks(list.data);
      if (st?.success) setStats(st.data);
    } finally { setLoading(false); }
  }, [scope, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const complete = async (id: number) => {
    const res = await OrganizationService.completeTask(id);
    if (res?.success) { toast.success('Task completed'); load(); }
  };
  const remove = async (id: number) => {
    if (!confirm('Delete this task?')) return;
    const res = await OrganizationService.deleteTask(id);
    if (res?.success) { toast.success('Deleted'); load(); }
    else toast.error(res?.message || 'Failed');
  };

  const tabs: { key: Scope; label: string; Icon: React.ComponentType<{ className?: string }>; count?: number; permGate?: boolean }[] = [
    { key: 'mine',    label: 'My tasks',  Icon: CheckCircle2, count: stats?.mine_open },
    { key: 'today',   label: 'Due today', Icon: Calendar },
    { key: 'overdue', label: 'Overdue',   Icon: AlertTriangle, count: stats?.overdue },
    { key: 'team',    label: 'Team',      Icon: Users, count: stats?.team_open, permGate: !stats?.can_assign },
    { key: 'all',     label: 'All',       Icon: CheckSquare },
  ];

  return (
    <div>
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white inline-flex items-center gap-3 flex-wrap">
            <CheckSquare className="w-6 h-6 text-emerald-300" /> Tasks
            <QuotaBadge quota="tasks" label="tasks" />
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Your todos, appointments, and lead work — all in one place.
          </p>
        </div>
        <PermissionGuard required="tasks.add">
          <button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold inline-flex items-center gap-2">
            <Plus className="w-4 h-4" /> New task
          </button>
        </PermissionGuard>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Tile Icon={CheckCircle2} label="My open" value={stats?.mine_open ?? 0} color="#10b981" />
        <Tile Icon={AlertTriangle} label="Overdue"  value={stats?.overdue ?? 0}  color="#ef4444" />
        <Tile Icon={Calendar} label="Done today" value={stats?.done_today ?? 0} color="#3b82f6" />
        {stats?.can_assign && (
          <Tile Icon={Users} label="Team open" value={stats?.team_open ?? 0} color="#a855f7" />
        )}
      </div>

      {/* Scope tabs */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {tabs.filter((t) => !t.permGate).map((t) => {
          const active = scope === t.key;
          return (
            <button
              key={t.key}
              onClick={() => pickScope(t.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                active ? 'bg-emerald-500/10 border-emerald-500/30 text-white' : 'bg-white/[0.02] border-white/5 text-slate-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <t.Icon className="w-3.5 h-3.5" />
              {t.label}
              {typeof t.count === 'number' && t.count > 0 && (
                <span className="text-[10px] text-slate-500">{t.count}</span>
              )}
            </button>
          );
        })}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="ml-auto px-3 py-1.5 rounded-lg bg-white/[0.02] border border-white/5 text-xs text-slate-300"
        >
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="done">Done</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* List */}
      {loading ? <PageSkeleton kind="list" /> : tasks.length === 0 ? (
        <EmptyState title="No tasks in this view" description="Create your first task, or switch tabs to see other queues." />
      ) : (
        <ul className="space-y-1.5">
          {tasks.map((t) => {
            const k = KIND_META[t.kind] ?? KIND_META.task;
            const KIcon = k.Icon;
            const prio = PRIORITY_META[t.priority] ?? PRIORITY_META.normal;
            return (
              <li
                key={t.id}
                className={`rounded-xl border p-3 flex items-start gap-3 transition-colors ${
                  t.status === 'done' ? 'border-white/5 bg-white/[0.02] opacity-60'
                  : t.is_overdue     ? 'border-red-500/30 bg-red-500/5'
                  : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.04]'
                }`}
              >
                <button
                  onClick={() => complete(t.id)}
                  disabled={t.status === 'done'}
                  title="Mark complete"
                  className={`mt-0.5 w-5 h-5 rounded-md border-2 transition-colors shrink-0 ${
                    t.status === 'done' ? 'bg-emerald-500 border-emerald-500' : 'border-slate-500 hover:border-emerald-400'
                  }`}
                >
                  {t.status === 'done' && <span className="block leading-none text-white text-[11px]">✓</span>}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <KIcon className="w-3.5 h-3.5 shrink-0" style={{ color: k.color }} />
                    <h3 className={`text-sm font-semibold ${t.status === 'done' ? 'line-through text-slate-500' : 'text-white'}`}>
                      {t.title}
                    </h3>
                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border"
                          style={{ color: prio.color, borderColor: `${prio.color}40`, backgroundColor: `${prio.color}1a` }}>
                      {prio.label}
                    </span>
                    {t.lead && t.lead_name && (
                      <Link href={`/w/${wsId}/leads/${t.lead}`} className="inline-flex items-center gap-1 text-[11px] text-emerald-300 hover:underline">
                        <Flame className="w-2.5 h-2.5" /> {t.lead_name}
                      </Link>
                    )}
                  </div>
                  {t.description && (
                    <p className="text-[12px] text-slate-400 mt-1 line-clamp-2">{t.description}</p>
                  )}
                  <div className="mt-1.5 flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
                    {t.due_at && (
                      <span className={t.is_overdue ? 'text-red-300 inline-flex items-center gap-1' : 'inline-flex items-center gap-1'}>
                        {t.is_overdue && <AlertTriangle className="w-3 h-3" />}
                        <Clock className="w-3 h-3" /> {new Date(t.due_at).toLocaleString()}
                      </span>
                    )}
                    {t.assigned_to_email && <span className="inline-flex items-center gap-1"><UserIcon className="w-3 h-3" /> {t.assigned_to_email}</span>}
                  </div>
                </div>
                <PermissionGuard required={['tasks.delete']}>
                  <button onClick={() => remove(t.id)} className="p-1 rounded text-slate-500 hover:text-red-300 hover:bg-red-500/10">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </PermissionGuard>
              </li>
            );
          })}
        </ul>
      )}

      {showCreate && (
        <CreateTaskModal canAssign={!!stats?.can_assign} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />
      )}
    </div>
  );
}

function Tile({ Icon, label, value, color }: {
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string; value: number; color: string;
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-slate-500">{label}</span>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}26`, color }}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <div className="mt-2 text-2xl font-bold text-white tabular-nums">{value}</div>
    </div>
  );
}

function CreateTaskModal({ canAssign, onClose, onCreated }: { canAssign: boolean; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ title: '', description: '', kind: 'task', priority: 'normal', due_at: '', assigned_to: '' });
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Title required'); return; }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = { ...form, due_at: form.due_at || null };
      if (!canAssign || !form.assigned_to) delete payload.assigned_to;
      else payload.assigned_to = Number(form.assigned_to);
      const res = await OrganizationService.createTask(payload);
      if (res?.success) { toast.success('Task created'); onCreated(); }
      else toast.error(res?.message || 'Failed');
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed');
    } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-[#0c1424] border border-white/10 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">New task</h2>
        <div className="space-y-3">
          <input className="w-full px-3 py-2 rounded-lg bg-[#080e1c] border border-white/10 text-sm text-white" placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <textarea rows={3} className="w-full px-3 py-2 rounded-lg bg-[#080e1c] border border-white/10 text-sm text-white" placeholder="Description (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <select className="px-3 py-2 rounded-lg bg-[#080e1c] border border-white/10 text-sm text-white" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              <option value="task">General task</option>
              <option value="appointment">Appointment</option>
              <option value="lead">Lead work</option>
            </select>
            <select className="px-3 py-2 rounded-lg bg-[#080e1c] border border-white/10 text-sm text-white" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <input type="datetime-local" className="w-full px-3 py-2 rounded-lg bg-[#080e1c] border border-white/10 text-sm text-white" value={form.due_at} onChange={(e) => setForm({ ...form, due_at: e.target.value })} />
          {canAssign && (
            <input type="number" placeholder="Assignee user id (optional)" className="w-full px-3 py-2 rounded-lg bg-[#080e1c] border border-white/10 text-sm text-white" value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })} />
          )}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-white/5">Cancel</button>
          <button type="submit" disabled={busy} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold disabled:opacity-50">{busy ? 'Creating…' : 'Create'}</button>
        </div>
      </form>
    </div>
  );
}
