'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Plus, Pencil, Trash2, Search, X, Filter, UserCog, Building2, Banknote, CalendarCheck,
  Mail, Phone, BadgeCheck, Briefcase, ShieldCheck, ArrowRight, Users,
} from 'lucide-react';
import Topbar from '@/components/Topbar';
import { PageSpinner, PageError, EmptyState } from '@/components/StateViews';
import {
  OrganizationService,
  type StaffMember, type Workspace, type PayrollEntry, type AttendanceEntry,
  type StaffWorkspaceAssignment, type RoleDef,
} from '@/services/organization.service';
import { useAuthStore, hasPermission } from '@/store/authStore';

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  probation: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
  on_leave: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  terminated: 'bg-red-500/10 text-red-300 border-red-500/20',
};

const EMPLOYMENT_LABELS: Record<string, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  intern: 'Intern',
};

const LEGACY_WORKSPACE_ROLES = ['owner', 'admin', 'manager', 'sales', 'viewer'] as const;

type StaffForm = Partial<StaffMember> & { password?: string };

const emptyStaffForm: StaffForm = {
  email: '', first_name: '', last_name: '',
  employee_id: '', designation: '', department: '',
  employment_type: 'full_time', status: 'active',
  hire_date: '', salary: '0.00', salary_currency: 'USD', pay_frequency: 'monthly',
  phone: '', address: '',
  emergency_contact_name: '', emergency_contact_phone: '',
  notes: '', role: 'MEMBER',
};

export default function StaffPage() {
  const permissionCodes = useAuthStore((s) => s.permissionCodes);
  const can = (code: string) => hasPermission(permissionCodes, code);

  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [roles, setRoles] = useState<RoleDef[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [workspaceFilter, setWorkspaceFilter] = useState<number | ''>('');
  const [employmentFilter, setEmploymentFilter] = useState('');

  const [editing, setEditing] = useState<StaffForm | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const load = async () => {
    setError(null);
    try {
      const params: Record<string, unknown> = {};
      if (search.trim()) params.search = search.trim();
      if (statusFilter) params.status = statusFilter;
      if (employmentFilter) params.employment_type = employmentFilter;
      if (workspaceFilter) params.workspace = Number(workspaceFilter);
      const [s, w, r] = await Promise.all([
        OrganizationService.listStaff(params),
        OrganizationService.listWorkspaces(),
        OrganizationService.listRoles().catch(() => ({ success: false })),
      ]);
      if (!s.success) throw new Error(s.message || 'Failed to load staff.');
      setStaff(s.data ?? []);
      if (w.success) setWorkspaces(w.data ?? []);
      if (r.success) setRoles(r.data ?? []);
    } catch (err) {
      const v = err as { response?: { data?: { message?: string } }; message?: string };
      setError(v.response?.data?.message ?? v.message ?? 'Failed to load staff.');
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, employmentFilter, workspaceFilter]);

  const remove = async (s: StaffMember) => {
    if (!can('staff.delete')) return toast.error("You don't have permission to delete staff.");
    if (!confirm(`Delete ${s.full_name}? This removes their user account and all related records.`)) return;
    try {
      const res = await OrganizationService.deleteStaff(s.id);
      if (res.success) {
        toast.success('Staff deleted.');
        await load();
        if (selectedId === s.id) setSelectedId(null);
      } else toast.error(res.message || 'Failed to delete.');
    } catch (err) {
      const v = err as { response?: { data?: { message?: string } } };
      toast.error(v.response?.data?.message ?? 'Failed to delete.');
    }
  };

  return (
    <>
      <Topbar
        title="Staff"
        subtitle="Manage employees, workspace assignments, payroll, and attendance."
        actions={
          <button
            onClick={() => can('staff.add') && setEditing({ ...emptyStaffForm })}
            disabled={!can('staff.add')}
            title={can('staff.add') ? 'Create a new staff member' : "You don't have permission"}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-lg shadow-emerald-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            New staff
          </button>
        }
      />

      <main className="flex-1 px-6 lg:px-10 py-8 overflow-y-auto">
        {/* Filters */}
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 mb-4 flex flex-col md:flex-row md:items-center gap-3">
          <form
            onSubmit={(e) => { e.preventDefault(); load(); }}
            className="flex items-center gap-2 flex-1"
          >
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 border border-white/5 flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, email, designation…"
                className="bg-transparent flex-1 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none"
              />
              {search && (
                <button type="button" onClick={() => { setSearch(''); load(); }} className="text-slate-500 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </form>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <select value={workspaceFilter} onChange={(e) => setWorkspaceFilter(e.target.value ? Number(e.target.value) : '')}
              className="bg-slate-800 border border-white/5 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="">All workspaces</option>
              {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <select value={employmentFilter} onChange={(e) => setEmploymentFilter(e.target.value)}
              className="bg-slate-800 border border-white/5 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="">All types</option>
              {Object.entries(EMPLOYMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-800 border border-white/5 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="probation">Probation</option>
              <option value="on_leave">On leave</option>
              <option value="terminated">Terminated</option>
            </select>
          </div>
        </div>

        {staff === null && !error && <PageSpinner />}
        {error && <PageError message={error} onRetry={load} />}
        {staff && staff.length === 0 && !error && (
          <EmptyState
            title="No staff yet"
            description="Create your first staff member to track payroll, attendance, and workspace access."
            action={can('staff.add') && (
              <button onClick={() => setEditing({ ...emptyStaffForm })}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold">
                <Plus className="w-4 h-4" /> Create staff
              </button>
            )}
          />
        )}

        {staff && staff.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {staff.map((s) => (
              <StaffCard
                key={s.id}
                s={s}
                onOpen={() => setSelectedId(s.id)}
                onEdit={() => can('staff.edit') && setEditing(s)}
                onDelete={() => remove(s)}
                canEdit={can('staff.edit')}
                canDelete={can('staff.delete')}
              />
            ))}
          </div>
        )}
      </main>

      {editing && (
        <StaffModal
          form={editing}
          roles={roles}
          workspaces={workspaces}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await load(); }}
        />
      )}

      {selectedId && (
        <StaffDrawer
          staffId={selectedId}
          workspaces={workspaces}
          roles={roles}
          onClose={() => setSelectedId(null)}
          onChanged={load}
        />
      )}
    </>
  );
}

// ───────────────────────────── Card ─────────────────────────────

function StaffCard({
  s, onOpen, onEdit, onDelete, canEdit, canDelete,
}: {
  s: StaffMember; onOpen: () => void; onEdit: () => void; onDelete: () => void;
  canEdit: boolean; canDelete: boolean;
}) {
  const initials = (s.full_name || s.email).split(/[\s@]/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors p-5 group">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-sky-600 flex items-center justify-center text-white font-bold shadow-lg shadow-emerald-500/20 text-sm">
          {initials || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={onOpen} className="text-base font-semibold text-white hover:text-emerald-300 truncate text-left">
              {s.full_name}
            </button>
            <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${STATUS_BADGE[s.status] ?? STATUS_BADGE.active}`}>
              {s.status.replace('_', ' ')}
            </span>
          </div>
          <div className="text-xs text-slate-400 truncate">{s.designation || '—'}</div>
          {s.department && <div className="text-[11px] text-slate-500 truncate">{s.department}</div>}
        </div>
      </div>

      <div className="mt-3 space-y-1 text-xs">
        <div className="flex items-center gap-2 text-slate-300"><Mail className="w-3.5 h-3.5 text-slate-500" /><span className="truncate">{s.email}</span></div>
        {s.phone && <div className="flex items-center gap-2 text-slate-400"><Phone className="w-3.5 h-3.5 text-slate-500" /><span>{s.phone}</span></div>}
        <div className="flex items-center gap-2 text-slate-400"><Briefcase className="w-3.5 h-3.5 text-slate-500" /><span>{EMPLOYMENT_LABELS[s.employment_type]}</span></div>
        <div className="flex items-center gap-2 text-slate-400"><ShieldCheck className="w-3.5 h-3.5 text-slate-500" /><span>{s.role_name || (s.role === 'ADMIN' ? 'Admin' : 'Member')}</span></div>
        <div className="flex items-center gap-2 text-slate-400"><Users className="w-3.5 h-3.5 text-slate-500" /><span>{s.workspace_count} workspace{s.workspace_count === 1 ? '' : 's'}</span></div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button onClick={onOpen} className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-sm rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 text-slate-200">
          Open
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
        <button onClick={onEdit} disabled={!canEdit} className="py-2 px-3 text-sm rounded-lg bg-white/[0.02] hover:bg-emerald-500/10 hover:text-emerald-300 border border-white/5 text-slate-400 disabled:opacity-40 disabled:cursor-not-allowed">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button onClick={onDelete} disabled={!canDelete} className="py-2 px-3 text-sm rounded-lg bg-white/[0.02] hover:bg-red-500/10 hover:text-red-300 border border-white/5 text-slate-400 disabled:opacity-40 disabled:cursor-not-allowed">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ───────────────────────────── Create/Edit modal ─────────────────────────────

function StaffModal({
  form: initial, roles, workspaces, onClose, onSaved,
}: {
  form: StaffForm; roles: RoleDef[]; workspaces: Workspace[]; onClose: () => void; onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState<StaffForm>(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isEditing = !!form.id;
  const selectedRole = roles.find((r) => r.id === form.role_obj_id);

  // Workspace assignments to apply on save. On edit, the ones already assigned
  // are shown as locked (manage/remove them in the detail drawer); here you can
  // only add. role '' = inherit the member's base role.
  const alreadyIn = new Set((initial.workspaces ?? []).map((m) => m.workspace.id));
  const [wsRows, setWsRows] = useState<{ workspace_id: number; role: string }[]>([]);
  const wsPickable = workspaces.filter(
    (w) => !alreadyIn.has(w.id) && !wsRows.some((r) => r.workspace_id === w.id),
  );
  const addWsRow = (id: number) => setWsRows((r) => [...r, { workspace_id: id, role: '' }]);
  const removeWsRow = (id: number) => setWsRows((r) => r.filter((x) => x.workspace_id !== id));
  const setWsRole = (id: number, role: string) =>
    setWsRows((r) => r.map((x) => (x.workspace_id === id ? { ...x, role } : x)));
  const wsName = (id: number) => workspaces.find((w) => w.id === id)?.name ?? `#${id}`;

  const set = <K extends keyof StaffForm>(k: K, v: StaffForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.email?.trim()) return setError('Email is required.');
    if (!isEditing && !form.password?.trim()) return setError('Password is required for new members.');
    setBusy(true);
    try {
      const payload: Record<string, unknown> = { ...form };
      // Don't send empty strings for nullable date fields
      if (!payload.hire_date) delete payload.hire_date;
      if (!payload.termination_date) delete payload.termination_date;
      // Workspace assignments to apply on save (role '' → backend uses base role)
      if (wsRows.length) {
        payload.workspace_assignments = wsRows.map((r) => ({
          workspace_id: r.workspace_id,
          ...(r.role ? { role: r.role } : {}),
        }));
      }
      const res = isEditing
        ? await OrganizationService.updateStaff(form.id!, payload)
        : await OrganizationService.createStaff(payload);
      if (res?.success) {
        toast.success(isEditing ? 'Staff updated.' : 'Staff created.');
        await onSaved();
      } else setError(res?.message || 'Failed to save.');
    } catch (err) {
      const v = err as { response?: { data?: { message?: string } } };
      setError(v.response?.data?.message ?? 'Failed to save.');
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <form onSubmit={submit} className="w-full max-w-2xl max-h-[90vh] rounded-2xl bg-slate-900 border border-white/10 shadow-2xl flex flex-col">
        <div className="flex items-start justify-between gap-4 p-6 border-b border-white/5">
          <div>
            <h2 className="text-lg font-semibold text-white">{isEditing ? 'Edit staff member' : 'New staff member'}</h2>
            <p className="text-sm text-slate-400 mt-1">All fields are saved to the user's profile.</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-md text-slate-500 hover:text-white hover:bg-white/5"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <Section title="Identity">
            <Grid>
              <Field label="Email *" required>
                <input type="email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} className={inputCls} disabled={isEditing} required />
              </Field>
              <Field label={isEditing ? 'Password (leave blank to keep)' : 'Password *'}>
                <input type="password" value={form.password ?? ''} onChange={(e) => set('password', e.target.value)} className={inputCls} placeholder={isEditing ? 'unchanged' : 'at least 6 chars'} />
              </Field>
              <Field label="First name"><input value={form.first_name ?? ''} onChange={(e) => set('first_name', e.target.value)} className={inputCls} /></Field>
              <Field label="Last name"><input value={form.last_name ?? ''} onChange={(e) => set('last_name', e.target.value)} className={inputCls} /></Field>
              <Field label="Role">
                <select
                  value={form.role_obj_id ?? ''}
                  onChange={(e) => set('role_obj_id', e.target.value ? Number(e.target.value) : null)}
                  className={inputCls}
                >
                  <option value="">Default (Member)</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}{r.is_system ? '' : ' (custom)'}
                    </option>
                  ))}
                </select>
                {selectedRole && (
                  <p className="mt-1 text-[11px] text-slate-500">
                    {selectedRole.description || `${selectedRole.permission_codes.length} permission${selectedRole.permission_codes.length === 1 ? '' : 's'}`}
                    {(selectedRole.code === 'owner' || selectedRole.code === 'admin') && ' · full panel access'}
                  </p>
                )}
              </Field>
              <Field label="Active">
                <select value={form.is_active === false ? 'false' : 'true'} onChange={(e) => set('is_active', e.target.value === 'true')} className={inputCls}>
                  <option value="true">Active</option>
                  <option value="false">Disabled (cannot log in)</option>
                </select>
              </Field>
            </Grid>
          </Section>

          <Section title="Job">
            <Grid>
              <Field label="Employee ID"><input value={form.employee_id ?? ''} onChange={(e) => set('employee_id', e.target.value)} className={inputCls} placeholder="EMP-0001" /></Field>
              <Field label="Designation"><input value={form.designation ?? ''} onChange={(e) => set('designation', e.target.value)} className={inputCls} placeholder="Sales Manager" /></Field>
              <Field label="Department"><input value={form.department ?? ''} onChange={(e) => set('department', e.target.value)} className={inputCls} placeholder="Sales" /></Field>
              <Field label="Employment type">
                <select value={form.employment_type ?? 'full_time'} onChange={(e) => set('employment_type', e.target.value as StaffMember['employment_type'])} className={inputCls}>
                  {Object.entries(EMPLOYMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <Field label="Status">
                <select value={form.status ?? 'active'} onChange={(e) => set('status', e.target.value as StaffMember['status'])} className={inputCls}>
                  <option value="active">Active</option>
                  <option value="probation">Probation</option>
                  <option value="on_leave">On leave</option>
                  <option value="terminated">Terminated</option>
                </select>
              </Field>
              <Field label="Hire date"><input type="date" value={form.hire_date ?? ''} onChange={(e) => set('hire_date', e.target.value)} className={inputCls} /></Field>
              <Field label="Termination date"><input type="date" value={form.termination_date ?? ''} onChange={(e) => set('termination_date', e.target.value)} className={inputCls} /></Field>
            </Grid>
          </Section>

          <Section title="Compensation">
            <Grid>
              <Field label="Salary"><input type="number" step="0.01" value={form.salary ?? ''} onChange={(e) => set('salary', e.target.value)} className={inputCls} /></Field>
              <Field label="Currency"><input value={form.salary_currency ?? 'USD'} onChange={(e) => set('salary_currency', e.target.value)} className={inputCls} /></Field>
              <Field label="Pay frequency">
                <select value={form.pay_frequency ?? 'monthly'} onChange={(e) => set('pay_frequency', e.target.value as StaffMember['pay_frequency'])} className={inputCls}>
                  <option value="monthly">Monthly</option>
                  <option value="biweekly">Bi-weekly</option>
                  <option value="weekly">Weekly</option>
                </select>
              </Field>
            </Grid>
          </Section>

          <Section title="Contact">
            <Grid>
              <Field label="Phone"><input value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} className={inputCls} /></Field>
              <Field label="Emergency contact"><input value={form.emergency_contact_name ?? ''} onChange={(e) => set('emergency_contact_name', e.target.value)} className={inputCls} /></Field>
              <Field label="Emergency phone"><input value={form.emergency_contact_phone ?? ''} onChange={(e) => set('emergency_contact_phone', e.target.value)} className={inputCls} /></Field>
              <Field label="Address"><textarea rows={2} value={form.address ?? ''} onChange={(e) => set('address', e.target.value)} className={`${inputCls} resize-none`} /></Field>
            </Grid>
          </Section>

          <Section title="Workspace access">
            <p className="text-[12px] text-slate-500 mb-2 -mt-1">
              Assign this person to one or more workspaces. Their role there defaults to the
              base role above — pick a different one to make them, e.g., Accountant in one
              workspace and Front Desk in another.
            </p>

            {isEditing && (initial.workspaces ?? []).length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {(initial.workspaces ?? []).map((m) => (
                  <span key={m.workspace.id} className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full border border-white/10 bg-white/[0.03] text-slate-300">
                    {m.workspace.name}
                    <span className="text-slate-500">· {m.role}</span>
                  </span>
                ))}
                <span className="text-[11px] text-slate-500 self-center">— manage/remove in the staff detail drawer</span>
              </div>
            )}

            <div className="space-y-2">
              {wsRows.map((r) => (
                <div key={r.workspace_id} className="flex items-center gap-2">
                  <span className="flex-1 text-sm text-white px-3 py-2 rounded-lg bg-white/[0.03] border border-white/10 truncate">{wsName(r.workspace_id)}</span>
                  <select value={r.role} onChange={(e) => setWsRole(r.workspace_id, e.target.value)} className={`${inputCls} max-w-[200px]`}>
                    <option value="">Inherit base role</option>
                    {roles.map((rd) => <option key={rd.id} value={rd.code}>{rd.name}{rd.is_system ? '' : ' (custom)'}</option>)}
                  </select>
                  <button type="button" onClick={() => removeWsRow(r.workspace_id)} className="p-2 rounded-lg text-slate-500 hover:text-red-300 hover:bg-red-500/10"><X className="w-4 h-4" /></button>
                </div>
              ))}

              {wsPickable.length > 0 ? (
                <select
                  value=""
                  onChange={(e) => { if (e.target.value) addWsRow(Number(e.target.value)); }}
                  className={inputCls}
                >
                  <option value="">+ Add a workspace…</option>
                  {wsPickable.map((w) => <option key={w.id} value={w.id}>{w.name}{w.effective_industry ? ` · ${w.effective_industry}` : ''}</option>)}
                </select>
              ) : (
                workspaces.length === 0 && <p className="text-[12px] text-slate-500">No workspaces yet. Create one under Workspaces first.</p>
              )}
            </div>
          </Section>

          <Section title="Notes">
            <textarea rows={3} value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} className={`${inputCls} resize-none`} placeholder="Internal notes about this staff member…" />
          </Section>

          {error && <div className="rounded-lg border border-red-500/40 bg-red-500/[0.06] px-3 py-2 text-sm text-red-200">{error}</div>}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-white/5">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-white/5">Cancel</button>
          <button type="submit" disabled={busy} className="px-4 py-2 rounded-lg text-sm bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-50">
            {busy ? 'Saving…' : isEditing ? 'Save changes' : 'Create staff'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ───────────────────────────── Drawer with tabs ─────────────────────────────

function StaffDrawer({
  staffId, workspaces, roles, onClose, onChanged,
}: {
  staffId: number; workspaces: Workspace[]; roles: RoleDef[];
  onClose: () => void; onChanged: () => Promise<void>;
}) {
  const permissionCodes = useAuthStore((s) => s.permissionCodes);
  const can = (code: string) => hasPermission(permissionCodes, code);
  const [staff, setStaff] = useState<StaffMember | null>(null);
  const [tab, setTab] = useState<'overview' | 'workspaces' | 'payroll' | 'attendance'>('overview');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await OrganizationService.getStaff(staffId);
      if (res.success) setStaff(res.data);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [staffId]);

  return (
    <div className="fixed inset-0 z-40 flex bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="ml-auto w-full max-w-3xl h-full bg-slate-900 border-l border-white/10 shadow-2xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 p-6 border-b border-white/5">
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-wider text-slate-500">Staff member</div>
            <h2 className="text-xl font-semibold text-white truncate">{loading ? 'Loading…' : staff?.full_name}</h2>
            {staff && <div className="text-sm text-slate-400 mt-0.5">{staff.designation || '—'} {staff.department && `· ${staff.department}`}</div>}
          </div>
          <button onClick={onClose} className="p-2 rounded-md text-slate-500 hover:text-white hover:bg-white/5"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-6 border-b border-white/5 flex items-center gap-1">
          {([
            { k: 'overview', label: 'Overview', Icon: BadgeCheck },
            { k: 'workspaces', label: 'Workspaces', Icon: Building2 },
            { k: 'payroll', label: 'Payroll', Icon: Banknote },
            { k: 'attendance', label: 'Attendance', Icon: CalendarCheck },
          ] as const).map(({ k, label, Icon }) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-3 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                tab === k ? 'border-emerald-400 text-white' : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading && <PageSpinner />}
          {!loading && staff && (
            <>
              {tab === 'overview' && <OverviewTab s={staff} />}
              {tab === 'workspaces' && (
                <WorkspacesTab
                  s={staff}
                  workspaces={workspaces}
                  roles={roles}
                  canAssign={can('staff.assign_workspaces')}
                  onChanged={async () => { await load(); await onChanged(); }}
                />
              )}
              {tab === 'payroll' && (
                <PayrollTab
                  userId={staff.id}
                  defaultBase={Number(staff.salary || 0)}
                  defaultCurrency={staff.salary_currency || 'USD'}
                  canView={can('staff.payroll_view')}
                  canManage={can('staff.payroll_manage')}
                />
              )}
              {tab === 'attendance' && (
                <AttendanceTab
                  userId={staff.id}
                  canView={can('staff.attendance_view')}
                  canManage={can('staff.attendance_manage')}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function OverviewTab({ s }: { s: StaffMember }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <Tile icon={<Briefcase className="w-4 h-4" />} label="Employment" value={EMPLOYMENT_LABELS[s.employment_type] || s.employment_type} />
        <Tile icon={<ShieldCheck className="w-4 h-4" />} label="Role" value={s.role_name || (s.role === 'ADMIN' ? 'Admin' : 'Member')} />
        <Tile icon={<Banknote className="w-4 h-4" />} label="Salary" value={`${s.salary_currency} ${Number(s.salary || 0).toFixed(2)} / ${s.pay_frequency}`} />
        <Tile icon={<CalendarCheck className="w-4 h-4" />} label="Hired" value={s.hire_date ?? '—'} />
      </div>

      <DataList rows={[
        ['Employee ID', s.employee_id || '—'],
        ['Email', s.email],
        ['Phone', s.phone || '—'],
        ['Department', s.department || '—'],
        ['Status', s.status],
        ['Manager', s.manager_email ?? '—'],
        ['Emergency contact', s.emergency_contact_name ? `${s.emergency_contact_name} · ${s.emergency_contact_phone || '—'}` : '—'],
        ['Address', s.address || '—'],
      ]} />

      {s.notes && (
        <div>
          <div className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-2">Notes</div>
          <p className="text-sm text-slate-300 whitespace-pre-line">{s.notes}</p>
        </div>
      )}
    </div>
  );
}

function WorkspacesTab({
  s, workspaces, roles, canAssign, onChanged,
}: {
  s: StaffMember; workspaces: Workspace[]; roles: RoleDef[];
  canAssign: boolean; onChanged: () => Promise<void>;
}) {
  const defaultRole = roles.find((r) => r.code === 'member')?.code
    ?? roles.find((r) => !r.is_system)?.code
    ?? roles[0]?.code
    ?? 'viewer';
  const [wsId, setWsId] = useState<number | ''>('');
  const [role, setRole] = useState<string>(defaultRole);
  const [busy, setBusy] = useState(false);

  const assign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wsId) return;
    setBusy(true);
    try {
      const r = await OrganizationService.assignStaffWorkspace(s.id, Number(wsId), role);
      if (r.success) { toast.success(r.message || 'Assigned.'); setWsId(''); await onChanged(); }
      else toast.error(r.message || 'Failed to assign.');
    } catch (err) {
      const v = err as { response?: { data?: { message?: string } } };
      toast.error(v.response?.data?.message ?? 'Failed to assign.');
    } finally { setBusy(false); }
  };

  const updateRole = async (m: StaffWorkspaceAssignment, newRole: string) => {
    try {
      const r = await OrganizationService.updateStaffWorkspaceRole(s.id, m.workspace.id, newRole);
      if (r.success) { toast.success('Role updated.'); await onChanged(); }
      else toast.error(r.message || 'Failed.');
    } catch { toast.error('Failed.'); }
  };

  const remove = async (m: StaffWorkspaceAssignment) => {
    if (!confirm(`Remove ${s.full_name} from "${m.workspace.name}"?`)) return;
    try {
      const r = await OrganizationService.removeStaffWorkspace(s.id, m.workspace.id);
      if (r.success) { toast.success('Removed.'); await onChanged(); }
      else toast.error(r.message || 'Failed.');
    } catch { toast.error('Failed.'); }
  };

  const unassigned = workspaces.filter((w) => !s.workspaces.find((m) => m.workspace.id === w.id));

  return (
    <div className="space-y-5">
      {canAssign && (
        <form onSubmit={assign} className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 flex items-end gap-2 flex-wrap">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Workspace</label>
            <select value={wsId} onChange={(e) => setWsId(e.target.value ? Number(e.target.value) : '')} className={inputCls} required>
              <option value="">Pick a workspace…</option>
              {unassigned.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div className="min-w-[140px]">
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className={inputCls}>
              {roles.length === 0
                ? LEGACY_WORKSPACE_ROLES.map((r) => <option key={r} value={r}>{r}</option>)
                : roles.map((r) => <option key={r.id} value={r.code}>{r.name}{r.is_system ? '' : ' (custom)'}</option>)
              }
            </select>
          </div>
          <button type="submit" disabled={busy || !wsId} className="px-4 py-2 rounded-lg text-sm bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-50">
            {busy ? 'Assigning…' : 'Assign'}
          </button>
        </form>
      )}

      {s.workspaces.length === 0 ? (
        <EmptyState title="No workspace assignments yet" description="Assign this staff member to one or more workspaces above." />
      ) : (
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.02] border-b border-white/5">
              <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="px-4 py-2.5 font-medium">Workspace</th>
                <th className="px-4 py-2.5 font-medium">Role</th>
                <th className="px-4 py-2.5 font-medium">Joined</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {s.workspaces.map((m) => (
                <tr key={m.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-2.5 text-white font-medium">{m.workspace.name}</td>
                  <td className="px-4 py-2.5">
                    {canAssign ? (
                      <select value={m.role} onChange={(e) => updateRole(m, e.target.value)}
                        className="bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-xs text-slate-200">
                        {/* Surface the current value too in case it's a legacy code not in Roles. */}
                        {!roles.find((r) => r.code === m.role) && (
                          <option key={m.role} value={m.role}>{m.role}</option>
                        )}
                        {roles.length === 0
                          ? LEGACY_WORKSPACE_ROLES.map((r) => <option key={r} value={r}>{r}</option>)
                          : roles.map((r) => <option key={r.id} value={r.code}>{r.name}</option>)
                        }
                      </select>
                    ) : (
                      <span className="text-xs uppercase tracking-wider text-slate-300">{m.role}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-400">{new Date(m.joined_at).toLocaleDateString()}</td>
                  <td className="px-4 py-2.5 text-right">
                    {canAssign && (
                      <button onClick={() => remove(m)} className="text-xs text-slate-400 hover:text-red-300">Remove</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PayrollTab({
  userId, defaultBase, defaultCurrency, canView, canManage,
}: {
  userId: number; defaultBase: number; defaultCurrency: string; canView: boolean; canManage: boolean;
}) {
  const [rows, setRows] = useState<PayrollEntry[] | null>(null);
  const [totalNet, setTotalNet] = useState<string>('0');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({
    period_start: '', period_end: '', base_pay: String(defaultBase || 0), bonuses: '0', deductions: '0',
    currency: defaultCurrency || 'USD', status: 'pending',
  });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!canView) return;
    const r = await OrganizationService.listPayroll({ user: userId });
    if (r.success) { setRows(r.data.results); setTotalNet(r.data.totals.net_pay); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [userId]);

  if (!canView) {
    return <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-4 text-sm text-amber-200">You don't have permission to view payroll.</div>;
  }

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await OrganizationService.createPayroll({ user: userId, ...form });
      if (r.success) { toast.success('Payroll added.'); setAdding(false); await load(); }
      else toast.error(r.message || 'Failed.');
    } catch (err) {
      const v = err as { response?: { data?: { message?: string } } };
      toast.error(v.response?.data?.message ?? 'Failed.');
    } finally { setBusy(false); }
  };

  const markPaid = async (p: PayrollEntry) => {
    try {
      const r = await OrganizationService.updatePayroll(p.id, { status: 'paid', paid_at: new Date().toISOString() });
      if (r.success) { toast.success('Marked paid.'); await load(); }
    } catch { toast.error('Failed.'); }
  };

  const remove = async (p: PayrollEntry) => {
    if (!confirm(`Delete payroll #${p.id}?`)) return;
    try {
      const r = await OrganizationService.deletePayroll(p.id);
      if (r.success) { toast.success('Deleted.'); await load(); }
    } catch { toast.error('Failed.'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-300">
          Lifetime net pay <span className="text-white font-semibold ml-2">{defaultCurrency} {Number(totalNet || 0).toFixed(2)}</span>
        </div>
        {canManage && (
          <button onClick={() => setAdding((v) => !v)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold">
            <Plus className="w-3.5 h-3.5" /> {adding ? 'Cancel' : 'Add entry'}
          </button>
        )}
      </div>

      {adding && (
        <form onSubmit={create} className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 grid grid-cols-2 gap-3">
          <Field label="Period start *"><input type="date" required value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })} className={inputCls} /></Field>
          <Field label="Period end *"><input type="date" required value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} className={inputCls} /></Field>
          <Field label="Base pay"><input type="number" step="0.01" value={form.base_pay} onChange={(e) => setForm({ ...form, base_pay: e.target.value })} className={inputCls} /></Field>
          <Field label="Bonuses"><input type="number" step="0.01" value={form.bonuses} onChange={(e) => setForm({ ...form, bonuses: e.target.value })} className={inputCls} /></Field>
          <Field label="Deductions"><input type="number" step="0.01" value={form.deductions} onChange={(e) => setForm({ ...form, deductions: e.target.value })} className={inputCls} /></Field>
          <Field label="Status">
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inputCls}>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="paid">Paid</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </Field>
          <div className="col-span-2 flex justify-end">
            <button type="submit" disabled={busy} className="px-4 py-2 rounded-lg text-sm bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-50">
              {busy ? 'Saving…' : 'Save entry'}
            </button>
          </div>
        </form>
      )}

      {rows === null ? <PageSpinner /> : rows.length === 0 ? (
        <EmptyState title="No payroll entries yet" description="Add the first entry above when ready." />
      ) : (
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.02] border-b border-white/5">
              <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="px-4 py-2.5 font-medium">Period</th>
                <th className="px-4 py-2.5 font-medium">Base</th>
                <th className="px-4 py-2.5 font-medium">+Bonus</th>
                <th className="px-4 py-2.5 font-medium">-Deduct</th>
                <th className="px-4 py-2.5 font-medium">Net</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((p) => (
                <tr key={p.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-2.5 text-slate-200 text-xs">{p.period_start} → {p.period_end}</td>
                  <td className="px-4 py-2.5 text-slate-300">{p.base_pay}</td>
                  <td className="px-4 py-2.5 text-emerald-300">+{p.bonuses}</td>
                  <td className="px-4 py-2.5 text-red-300">−{p.deductions}</td>
                  <td className="px-4 py-2.5 text-white font-semibold">{p.net_pay}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-1 rounded-full border ${
                      p.status === 'paid' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                      : p.status === 'approved' ? 'bg-sky-500/10 text-sky-300 border-sky-500/20'
                      : p.status === 'cancelled' ? 'bg-red-500/10 text-red-300 border-red-500/20'
                      : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                    }`}>{p.status}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    {canManage && p.status !== 'paid' && (
                      <button onClick={() => markPaid(p)} className="text-xs text-emerald-300 hover:text-emerald-200 mr-3">Mark paid</button>
                    )}
                    {canManage && (
                      <button onClick={() => remove(p)} className="text-xs text-slate-400 hover:text-red-300">Delete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AttendanceTab({ userId, canView, canManage }: { userId: number; canView: boolean; canManage: boolean }) {
  const [rows, setRows] = useState<AttendanceEntry[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({
    date: new Date().toISOString().slice(0, 10), status: 'present', check_in: '', check_out: '', notes: '',
  });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!canView) return;
    const r = await OrganizationService.listAttendance({ user: userId });
    if (r.success) setRows(r.data);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [userId]);

  if (!canView) {
    return <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-4 text-sm text-amber-200">You don't have permission to view attendance.</div>;
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        user: userId, date: form.date, status: form.status, notes: form.notes,
      };
      if (form.check_in) payload.check_in = new Date(form.check_in).toISOString();
      if (form.check_out) payload.check_out = new Date(form.check_out).toISOString();
      const r = await OrganizationService.upsertAttendance(payload);
      if (r.success) { toast.success(r.message || 'Saved.'); setAdding(false); await load(); }
      else toast.error(r.message || 'Failed.');
    } catch (err) {
      const v = err as { response?: { data?: { message?: string } } };
      toast.error(v.response?.data?.message ?? 'Failed.');
    } finally { setBusy(false); }
  };

  const remove = async (a: AttendanceEntry) => {
    if (!confirm(`Delete attendance for ${a.date}?`)) return;
    const r = await OrganizationService.deleteAttendance(a.id);
    if (r.success) { toast.success('Deleted.'); await load(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-300">{rows?.length ?? 0} record{(rows?.length ?? 0) === 1 ? '' : 's'}</div>
        {canManage && (
          <button onClick={() => setAdding((v) => !v)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold">
            <Plus className="w-3.5 h-3.5" /> {adding ? 'Cancel' : 'Add / record'}
          </button>
        )}
      </div>

      {adding && (
        <form onSubmit={save} className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 grid grid-cols-2 gap-3">
          <Field label="Date *"><input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputCls} /></Field>
          <Field label="Status">
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inputCls}>
              {['present', 'remote', 'half_day', 'leave', 'absent', 'holiday'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </Field>
          <Field label="Check-in"><input type="datetime-local" value={form.check_in} onChange={(e) => setForm({ ...form, check_in: e.target.value })} className={inputCls} /></Field>
          <Field label="Check-out"><input type="datetime-local" value={form.check_out} onChange={(e) => setForm({ ...form, check_out: e.target.value })} className={inputCls} /></Field>
          <Field label="Notes"><input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputCls} /></Field>
          <div className="col-span-2 flex justify-end">
            <button type="submit" disabled={busy} className="px-4 py-2 rounded-lg text-sm bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-50">
              {busy ? 'Saving…' : 'Save record'}
            </button>
          </div>
        </form>
      )}

      {rows === null ? <PageSpinner /> : rows.length === 0 ? (
        <EmptyState title="No attendance records" description="Add the first record above." />
      ) : (
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.02] border-b border-white/5">
              <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Check-in</th>
                <th className="px-4 py-2.5 font-medium">Check-out</th>
                <th className="px-4 py-2.5 font-medium">Hours</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((a) => (
                <tr key={a.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-2.5 text-slate-200">{a.date}</td>
                  <td className="px-4 py-2.5 text-xs uppercase tracking-wider text-slate-300">{a.status.replace('_', ' ')}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-400">{a.check_in ? new Date(a.check_in).toLocaleTimeString() : '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-400">{a.check_out ? new Date(a.check_out).toLocaleTimeString() : '—'}</td>
                  <td className="px-4 py-2.5 text-white font-semibold">{Number(a.hours_worked || 0).toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-right">
                    {canManage && (
                      <button onClick={() => remove(a)} className="text-xs text-slate-400 hover:text-red-300">Delete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ───────────────────────────── Tiny UI helpers ─────────────────────────────

const inputCls = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-3">{title}</div>
      {children}
    </div>
  );
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>;
}
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-300 mb-1.5">
        {label}{required && <span className="text-emerald-300"> *</span>}
      </span>
      {children}
    </label>
  );
}
function Tile({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-white/[0.03] border border-white/5 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-slate-500 uppercase tracking-wider text-[10px]">
        {icon} {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold text-white">{value}</div>
    </div>
  );
}
function DataList({ rows }: { rows: Array<[string, React.ReactNode]> }) {
  return (
    <dl className="rounded-2xl border border-white/5 bg-white/[0.02] divide-y divide-white/5">
      {rows.map(([k, v]) => (
        <div key={k} className="px-4 py-2.5 grid grid-cols-3 gap-4">
          <dt className="text-xs text-slate-500 uppercase tracking-wider">{k}</dt>
          <dd className="col-span-2 text-sm text-white">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
