'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Topbar from '@/components/Topbar';
import {
  Plus, Folder, AlertTriangle, X, Users, ShieldCheck, ArrowRight, Trash2, Pencil,
  Archive, ArchiveRestore, ChevronDown, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PageSpinner, PageError, EmptyState } from '@/components/StateViews';
import {
  OrganizationService,
  type Workspace,
  type WorkspaceMember,
  type AssignableStaffRow,
  type CurrentSubscription,
  type RoleDef,
  type IndustryOption,
} from '@/services/organization.service';
import { useAuthStore, hasPermission } from '@/store/authStore';

const LEGACY_BADGE: Record<string, string> = {
  owner: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  admin: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
  manager: 'bg-violet-500/10 text-violet-300 border-violet-500/20',
  sales: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  viewer: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
  member: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
};
const ACCENT_PALETTE = [
  'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  'bg-sky-500/10 text-sky-300 border-sky-500/20',
  'bg-violet-500/10 text-violet-300 border-violet-500/20',
  'bg-amber-500/10 text-amber-300 border-amber-500/20',
  'bg-pink-500/10 text-pink-300 border-pink-500/20',
  'bg-teal-500/10 text-teal-300 border-teal-500/20',
];
function roleBadge(code: string, allCodes: string[]) {
  if (LEGACY_BADGE[code]) return LEGACY_BADGE[code];
  // Stable colour per code based on position
  const idx = allCodes.indexOf(code);
  return ACCENT_PALETTE[(idx >= 0 ? idx : 0) % ACCENT_PALETTE.length];
}

const workspaceSchema = z.object({
  name: z
    .string()
    .min(2, 'Workspace name must be at least 2 characters')
    .max(100),
});
type WorkspaceForm = z.infer<typeof workspaceSchema>;

export default function WorkspacesPage() {
  const permissionCodes = useAuthStore((s) => s.permissionCodes);
  const can = (code: string) => hasPermission(permissionCodes, code);

  const [items, setItems] = useState<Workspace[] | null>(null);
  const [subInfo, setSubInfo] = useState<CurrentSubscription | null>(null);
  const [roles, setRoles] = useState<RoleDef[]>([]);
  const [industries, setIndustries] = useState<IndustryOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const load = async () => {
    setError(null);
    try {
      const [wsRes, currentRes, rolesRes, indRes] = await Promise.all([
        OrganizationService.listWorkspaces(),
        OrganizationService.currentSubscription(1, 1),
        OrganizationService.listRoles().catch(() => ({ success: false })),
        OrganizationService.listIndustries().catch(() => ({ success: false })),
      ]);
      if (wsRes.success) setItems(wsRes.data ?? []);
      else setError(wsRes.message || 'Failed to load workspaces.');
      if (currentRes.success) setSubInfo(currentRes.data);
      if (rolesRes.success) setRoles(rolesRes.data ?? []);
      if (indRes.success) setIndustries(indRes.data ?? []);
    } catch (err) {
      const v = err as { response?: { data?: { message?: string } } };
      setError(v.response?.data?.message ?? 'Failed to load workspaces.');
    }
  };

  useEffect(() => { load(); }, []);

  const used = items?.length ?? 0;
  const rawCap = subInfo?.subscription.effective_max_workspaces ?? null;
  // ``-1`` / ``0`` mean unlimited — normalise both into a friendly
  // ``unlimited`` flag so the page never prints "of -1 workspaces in
  // use" or disables the create button on an Enterprise plan.
  const unlimited = rawCap == null || rawCap <= 0;
  const cap = unlimited ? null : rawCap;
  const atCap = !unlimited && cap != null && used >= cap;
  const usagePct = unlimited || cap == null ? 0 : Math.min(100, Math.round((used / cap) * 100));
  const selected = items?.find((w) => w.id === selectedId) ?? null;

  return (
    <>
      <Topbar
        title="Workspaces"
        subtitle={unlimited
          ? `${used} workspaces in use · Unlimited`
          : `${used} of ${cap} workspaces in use`}
        actions={
          <button
            onClick={() => setShowCreate(true)}
            disabled={atCap}
            title={atCap ? 'Workspace limit reached — upgrade your plan' : 'Create workspace'}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-lg shadow-emerald-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-emerald-600"
          >
            <Plus className="w-4 h-4" />
            New workspace
          </button>
        }
      />

      <main className="flex-1 px-6 lg:px-10 py-8 overflow-y-auto">
        {cap != null && (
          <div className={`mb-6 rounded-2xl border p-4 ${atCap ? 'border-amber-500/30 bg-amber-500/[0.04]' : 'border-white/5 bg-white/[0.02]'}`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500">Plan usage</div>
                <div className="mt-1 text-sm text-white">
                  <span className="font-semibold">{used}</span>
                  <span className="text-slate-400"> / {cap} workspaces</span>
                  {subInfo?.subscription.plan_name && <span className="text-slate-500"> · {subInfo.subscription.plan_name}</span>}
                </div>
              </div>
              {atCap && (
                <Link
                  href="/subscription"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-semibold"
                >
                  <AlertTriangle className="w-3.5 h-3.5" /> Upgrade plan
                </Link>
              )}
            </div>
            <div className="mt-3 h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className={`h-full ${atCap ? 'bg-amber-500' : 'bg-gradient-to-r from-emerald-500 to-sky-500'}`}
                style={{ width: `${usagePct}%` }}
              />
            </div>
          </div>
        )}

        {items === null && !error && <PageSpinner />}
        {error && <PageError message={error} onRetry={load} />}
        {items && items.length === 0 && (
          <EmptyState
            title="No workspaces yet"
            description={atCap ? 'Your plan is fully used — upgrade to create a workspace.' : 'Create your first workspace to start organizing your team.'}
            action={
              atCap ? (
                <Link href="/subscription" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-semibold">
                  Upgrade plan
                </Link>
              ) : (
                <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold">
                  <Plus className="w-4 h-4" /> Create workspace
                </button>
              )
            }
          />
        )}
        {items && items.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {items.map((w) => (
              <button
                key={w.id}
                onClick={() => setSelectedId(w.id)}
                className="text-left rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors p-5 group"
              >
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-300">
                    <Folder className="w-5 h-5" />
                  </div>
                  {w.role && (
                    <span className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full border ${roleBadge(w.role, roles.map((r) => r.code))}`}>
                      {w.role}
                    </span>
                  )}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-white truncate">{w.name}</h3>
                {w.effective_industry && (
                  <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border border-sky-500/20 bg-sky-500/10 text-sky-300">
                    {w.effective_industry}
                  </span>
                )}
                <p className="mt-1 text-xs text-slate-500 flex items-center gap-1.5">
                  <Users className="w-3 h-3" />
                  {w.member_count} member{w.member_count === 1 ? '' : 's'}
                  <span className="text-slate-600 mx-1">·</span>
                  Created {new Date(w.created_at).toLocaleDateString()}
                </p>
                <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300 opacity-0 group-hover:opacity-100 transition-opacity">
                  Manage members
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </button>
            ))}
            {!atCap && (
              <button
                onClick={() => setShowCreate(true)}
                className="rounded-2xl border-2 border-dashed border-white/10 hover:border-emerald-500/40 text-slate-400 hover:text-emerald-300 transition-colors p-5 flex flex-col items-center justify-center min-h-[160px]"
              >
                <Plus className="w-6 h-6 mb-2" />
                <span className="text-sm font-medium">Create workspace</span>
              </button>
            )}
          </div>
        )}

        {items !== null && <ArchivedWorkspaces onChanged={load} />}
      </main>

      {showCreate && (
        <CreateWorkspaceModal
          industries={industries}
          onClose={() => setShowCreate(false)}
          onCreated={(ws) => {
            setItems((curr) => [ws, ...(curr ?? [])]);
            setShowCreate(false);
            toast.success(`Workspace "${ws.name}" created`);
          }}
        />
      )}

      {selected && (
        <WorkspaceDrawer
          workspace={selected}
          roles={roles}
          industries={industries}
          canAssign={can('staff.assign_workspaces')}
          canEdit={can('staff.assign_workspaces')}
          onClose={() => setSelectedId(null)}
          onChanged={load}
        />
      )}
    </>
  );
}

// ───────────────────────────── Create modal ─────────────────────────────

function CreateWorkspaceModal({
  industries,
  onClose,
  onCreated,
}: {
  industries: IndustryOption[];
  onClose: () => void;
  onCreated: (w: Workspace) => void;
}) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [industry, setIndustry] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<WorkspaceForm>({
    resolver: zodResolver(workspaceSchema),
  });

  const onSubmit = async (data: WorkspaceForm) => {
    setSubmitError(null);
    try {
      const res = await OrganizationService.createWorkspace(data.name, industry || undefined);
      if (res.success && res.data) onCreated(res.data as Workspace);
      else setSubmitError(res.message || 'Failed to create workspace.');
    } catch (err) {
      const v = err as { response?: { data?: { message?: string } } };
      setSubmitError(v.response?.data?.message ?? 'Failed to create workspace.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-md rounded-2xl bg-slate-900 border border-white/10 p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-white">Create a workspace</h2>
        <p className="text-sm text-slate-400 mt-1">You'll be set as the owner automatically.</p>

        <label className="block mt-5 text-sm font-medium text-slate-300 mb-2">Name</label>
        <input
          autoFocus
          {...register('name')}
          placeholder="e.g. Sales Pipeline"
          className={`w-full bg-slate-800 border ${errors.name ? 'border-red-500' : 'border-slate-700'} rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500`}
        />
        {errors.name && <p className="mt-1 text-sm text-red-400">{errors.name.message}</p>}

        <label className="block mt-5 text-sm font-medium text-slate-300 mb-2">Industry</label>
        <select
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="">Inherit org default</option>
          {industries.map((i) => (
            <option key={i.industry} value={i.industry}>
              {i.industry} ({i.mode === 'cart' ? 'online ordering' : 'bookings'})
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-[12px] text-slate-500">
          Tunes this workspace's storefront, menu and reports. Pick a different industry to run a
          separate business line (e.g. a restaurant and a wellness store under one account).
        </p>
        {submitError && <p className="mt-3 text-sm text-red-400">{submitError}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-white/5">Cancel</button>
          <button type="submit" disabled={isSubmitting} className="px-4 py-2 rounded-lg text-sm bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-50">
            {isSubmitting ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ───────────────────────────── Member drawer ─────────────────────────────

function WorkspaceDrawer({
  workspace,
  roles,
  industries,
  canAssign,
  canEdit,
  onClose,
  onChanged,
}: {
  workspace: Workspace;
  roles: RoleDef[];
  industries: IndustryOption[];
  canAssign: boolean;
  canEdit: boolean;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [industry, setIndustry] = useState<string>(workspace.industry ?? '');
  const [savingIndustry, setSavingIndustry] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const archive = async () => {
    if (!confirm(
      `Archive "${workspace.name}"?\n\n` +
      `It leaves the dashboard and switcher and its storefront stops serving. ` +
      `All data inside is kept — you can restore it later from the Archived section.`
    )) return;
    setArchiving(true);
    try {
      const r = await OrganizationService.archiveWorkspace(workspace.id);
      if (r.success) {
        toast.success(r.message || 'Workspace archived.');
        onClose();
        await onChanged();
      } else toast.error(r.message || 'Failed to archive.');
    } catch (err) {
      const v = err as { response?: { data?: { message?: string } } };
      toast.error(v.response?.data?.message ?? 'Failed to archive.');
    } finally { setArchiving(false); }
  };

  const saveIndustry = async () => {
    setSavingIndustry(true);
    try {
      const r = await OrganizationService.updateWorkspace(workspace.id, { industry: industry || null });
      if (r.success) { toast.success('Industry updated.'); await onChanged(); }
      else toast.error(r.message || 'Failed to update industry.');
    } catch (err) {
      const v = err as { response?: { data?: { message?: string } } };
      toast.error(v.response?.data?.message ?? 'Failed to update industry.');
    } finally { setSavingIndustry(false); }
  };
  const [members, setMembers] = useState<WorkspaceMember[] | null>(null);
  const [assignable, setAssignable] = useState<AssignableStaffRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [pickUser, setPickUser] = useState<number | ''>('');
  // Default to a sensible non-admin role if available; fall back to 'viewer'.
  const defaultRoleCode = roles.find((r) => r.code === 'member')?.code
    ?? roles.find((r) => !r.is_system)?.code
    ?? roles[0]?.code
    ?? 'viewer';
  const [pickRole, setPickRole] = useState<string>(defaultRoleCode);
  const [filter, setFilter] = useState('');
  const allRoleCodes = roles.map((r) => r.code);

  const load = async () => {
    try {
      const [m, a] = await Promise.all([
        OrganizationService.listWorkspaceMembers(workspace.id),
        OrganizationService.listAssignableStaff(workspace.id),
      ]);
      if (m.success) setMembers(m.data ?? []);
      if (a.success) setAssignable(a.data ?? []);
    } catch (err) {
      const v = err as { response?: { data?: { message?: string } } };
      toast.error(v.response?.data?.message ?? 'Failed to load members.');
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [workspace.id]);

  const assign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickUser) return toast.error('Pick a staff member first.');
    setBusy(true);
    try {
      const r = await OrganizationService.assignWorkspaceMember(workspace.id, Number(pickUser), pickRole);
      if (r.success) {
        toast.success(r.message || 'Staff assigned.');
        setPickUser(''); setPickRole('viewer');
        await load();
        await onChanged();
      } else toast.error(r.message || 'Failed.');
    } catch (err) {
      const v = err as { response?: { data?: { message?: string } } };
      toast.error(v.response?.data?.message ?? 'Failed.');
    } finally { setBusy(false); }
  };

  const changeRole = async (m: WorkspaceMember, role: string) => {
    try {
      const r = await OrganizationService.updateWorkspaceMemberRole(workspace.id, m.user_id, role);
      if (r.success) { toast.success('Role updated.'); await load(); await onChanged(); }
      else toast.error(r.message || 'Failed.');
    } catch { toast.error('Failed.'); }
  };

  const remove = async (m: WorkspaceMember) => {
    if (!confirm(`Remove ${m.full_name} from "${workspace.name}"?`)) return;
    try {
      const r = await OrganizationService.removeWorkspaceMember(workspace.id, m.user_id);
      if (r.success) { toast.success('Removed.'); await load(); await onChanged(); }
      else toast.error(r.message || 'Failed.');
    } catch { toast.error('Failed.'); }
  };

  const filteredAssignable = assignable.filter((a) => {
    if (!filter.trim()) return true;
    const q = filter.toLowerCase();
    return a.full_name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q) || (a.designation || '').toLowerCase().includes(q);
  });

  return (
    <div className="fixed inset-0 z-40 flex bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="ml-auto w-full max-w-2xl h-full bg-slate-900 border-l border-white/10 shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 p-6 border-b border-white/5">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-300">
              <Folder className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500">Workspace</div>
              <h2 className="text-xl font-semibold text-white">{workspace.name}</h2>
              <p className="text-xs text-slate-500 mt-1">
                {members?.length ?? 0} member{(members?.length ?? 0) === 1 ? '' : 's'} ·
                Created {new Date(workspace.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-md text-slate-500 hover:text-white hover:bg-white/5"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Industry — shapes this workspace's storefront, menu & reports */}
          <section>
            <div className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-3 flex items-center gap-2">
              <Folder className="w-3.5 h-3.5" /> Industry
            </div>
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 flex flex-col sm:flex-row sm:items-end gap-2">
              <div className="flex-1 min-w-[180px]">
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Business type for this workspace</label>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  disabled={!canEdit}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
                >
                  <option value="">Inherit org default{workspace.effective_industry ? ` (${workspace.effective_industry})` : ''}</option>
                  {industries.map((i) => (
                    <option key={i.industry} value={i.industry}>
                      {i.industry} ({i.mode === 'cart' ? 'online ordering' : 'bookings'})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Currently active: <span className="text-slate-300">{workspace.effective_industry || '—'}</span>
                </p>
              </div>
              {canEdit && (
                <button
                  onClick={saveIndustry}
                  disabled={savingIndustry || industry === (workspace.industry ?? '')}
                  className="px-4 py-2 rounded-lg text-sm bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-50"
                >
                  {savingIndustry ? 'Saving…' : 'Save'}
                </button>
              )}
            </div>
          </section>

          {/* Assign new member */}
          {canAssign && (
            <section>
              <div className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-3 flex items-center gap-2">
                <Plus className="w-3.5 h-3.5" /> Assign staff to this workspace
              </div>
              <form onSubmit={assign} className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 flex flex-col md:flex-row md:items-end gap-2">
                <div className="flex-1 min-w-[180px]">
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Staff member</label>
                  <select
                    value={pickUser}
                    onChange={(e) => setPickUser(e.target.value ? Number(e.target.value) : '')}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Pick a staff member…</option>
                    {assignable.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.full_name} ({a.email}){a.designation ? ` · ${a.designation}` : ''}
                      </option>
                    ))}
                  </select>
                  {assignable.length === 0 && (
                    <p className="text-[11px] text-slate-500 mt-1">
                      Everyone is already in this workspace.{' '}
                      <Link href="/staff" className="text-emerald-300 hover:text-emerald-200">Add more staff →</Link>
                    </p>
                  )}
                </div>
                <div className="min-w-[180px]">
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Role
                    {roles.length > 0 && (
                      <Link href="/roles" className="ml-2 text-emerald-300 hover:text-emerald-200 normal-case font-normal text-[11px]">
                        manage →
                      </Link>
                    )}
                  </label>
                  <select
                    value={pickRole}
                    onChange={(e) => setPickRole(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {roles.length === 0 ? (
                      <>
                        <option value="viewer">viewer</option>
                        <option value="sales">sales</option>
                        <option value="manager">manager</option>
                        <option value="admin">admin</option>
                      </>
                    ) : (
                      roles.map((r) => (
                        <option key={r.id} value={r.code}>
                          {r.name}{r.is_system ? '' : ' (custom)'}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={busy || !pickUser}
                  className="px-4 py-2 rounded-lg text-sm bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-50"
                >
                  {busy ? 'Assigning…' : 'Assign'}
                </button>
              </form>
            </section>
          )}

          {/* Current members */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs uppercase tracking-wider text-slate-500 font-bold flex items-center gap-2">
                <Users className="w-3.5 h-3.5" /> Members ({members?.length ?? 0})
              </div>
              {members && members.length > 0 && (
                <input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Filter…"
                  className="bg-slate-800 border border-white/5 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              )}
            </div>

            {members === null && <PageSpinner />}
            {members && members.length === 0 && (
              <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 text-center">
                <ShieldCheck className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                <p className="text-sm text-slate-400">No one is in this workspace yet.</p>
                {canAssign && <p className="text-xs text-slate-500 mt-1">Use the form above to add staff.</p>}
              </div>
            )}
            {members && members.length > 0 && (
              <div className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-white/[0.02] border-b border-white/5">
                    <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                      <th className="px-4 py-2.5 font-medium">Member</th>
                      <th className="px-4 py-2.5 font-medium">Role</th>
                      <th className="px-4 py-2.5 font-medium hidden md:table-cell">Joined</th>
                      <th className="px-4 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {members.filter((m) => {
                      if (!filter.trim()) return true;
                      const q = filter.toLowerCase();
                      return m.full_name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q) || (m.designation || '').toLowerCase().includes(q);
                    }).map((m) => {
                      const initials = (m.full_name || m.email).split(/[\s@]/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
                      return (
                        <tr key={m.id} className="hover:bg-white/[0.02]">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-xs font-semibold text-emerald-300 border border-white/10">
                                {initials || '?'}
                              </div>
                              <div className="min-w-0">
                                <div className="text-white font-medium truncate">{m.full_name}</div>
                                <div className="text-[11px] text-slate-500 truncate">{m.email}</div>
                                {(m.designation || m.employee_id) && (
                                  <div className="text-[11px] text-slate-500 truncate">
                                    {m.designation}{m.employee_id ? ` · ${m.employee_id}` : ''}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            {canAssign ? (
                              <select
                                value={m.role}
                                onChange={(e) => changeRole(m, e.target.value)}
                                className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-1.5 rounded-full border bg-transparent focus:outline-none cursor-pointer ${roleBadge(m.role, allRoleCodes)}`}
                              >
                                {/* Keep the current value as an option even if it's no longer in
                                    the tenant Role table (e.g. legacy 'sales' string). */}
                                {!roles.find((r) => r.code === m.role) && (
                                  <option key={m.role} value={m.role} className="bg-slate-900">{m.role}</option>
                                )}
                                {roles.map((r) => (
                                  <option key={r.id} value={r.code} className="bg-slate-900">{r.name}</option>
                                ))}
                              </select>
                            ) : (
                              <span className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full border ${roleBadge(m.role, allRoleCodes)}`}>
                                {m.role}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 hidden md:table-cell text-xs text-slate-400">
                            {new Date(m.joined_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-2.5 text-right whitespace-nowrap">
                            <Link
                              href={`/staff`}
                              title="Open staff directory"
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-emerald-300 hover:bg-emerald-500/10 mr-1"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Link>
                            {canAssign && (
                              <button
                                onClick={() => remove(m)}
                                title="Remove from workspace"
                                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-red-300 hover:bg-red-500/10"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Danger zone — archive (soft delete) */}
          {canEdit && (
            <section>
              <div className="text-xs uppercase tracking-wider text-red-400/80 font-bold mb-3 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5" /> Danger zone
              </div>
              <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.03] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-white">Archive this workspace</div>
                  <p className="text-[12px] text-slate-400 mt-0.5 leading-relaxed">
                    Removes it from the dashboard and switcher, and stops its storefront.
                    <span className="text-slate-300"> All data inside is kept</span> — you can
                    restore it anytime from the Archived section. Nothing is deleted.
                  </p>
                </div>
                <button
                  onClick={archive}
                  disabled={archiving}
                  className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 font-semibold disabled:opacity-50"
                >
                  <Archive className="w-4 h-4" />
                  {archiving ? 'Archiving…' : 'Archive workspace'}
                </button>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── Archived workspaces ─────────────────────────

function ArchivedWorkspaces({ onChanged }: { onChanged: () => Promise<void> }) {
  const [rows, setRows] = useState<Workspace[] | null>(null);
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<Workspace | null>(null);

  const load = async () => {
    try {
      const r = await OrganizationService.listWorkspaces({ archived: true });
      if (r.success) setRows(r.data ?? []);
      else setRows([]);
    } catch { setRows([]); }
  };
  useEffect(() => { load(); }, []);

  const restore = async (w: Workspace) => {
    setBusyId(w.id);
    try {
      const r = await OrganizationService.restoreWorkspace(w.id);
      if (r.success) {
        toast.success(r.message || 'Workspace restored.');
        await load();
        await onChanged();
      } else toast.error(r.message || 'Failed to restore.');
    } catch (err) {
      const v = err as { response?: { data?: { message?: string } } };
      toast.error(v.response?.data?.message ?? 'Failed to restore.');
    } finally { setBusyId(null); }
  };

  if (rows === null || rows.length === 0) return null;

  return (
    <div className="mt-10">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white"
      >
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <Archive className="w-4 h-4 text-slate-500" />
        Archived workspaces
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/10">{rows.length}</span>
      </button>

      {open && (
        <div className="mt-4 rounded-2xl border border-white/5 bg-white/[0.02] divide-y divide-white/5">
          {rows.map((w) => (
            <div key={w.id} className="flex items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-slate-700/40 border border-white/5 flex items-center justify-center text-slate-400 shrink-0">
                  <Archive className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-200 truncate">{w.name}</div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {w.member_count} member{w.member_count === 1 ? '' : 's'}
                    {w.archived_at && <> · archived {new Date(w.archived_at).toLocaleDateString()}</>}
                    {w.archived_by_email && <> · by {w.archived_by_email}</>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => restore(w)}
                  disabled={busyId === w.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 disabled:opacity-50"
                >
                  <ArchiveRestore className="w-3.5 h-3.5" /> Restore
                </button>
                <button
                  onClick={() => setPurgeTarget(w)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete forever
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {purgeTarget && (
        <PurgeModal
          workspace={purgeTarget}
          onClose={() => setPurgeTarget(null)}
          onPurged={async () => {
            setPurgeTarget(null);
            await load();
            await onChanged();
          }}
        />
      )}
    </div>
  );
}

// Type-to-confirm permanent delete. This is the ONLY destructive path — it
// cascades and truly loses the data inside, so it requires the exact name.
function PurgeModal({
  workspace,
  onClose,
  onPurged,
}: {
  workspace: Workspace;
  onClose: () => void;
  onPurged: () => Promise<void>;
}) {
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const matches = confirmText.trim() === workspace.name;

  const purge = async () => {
    if (!matches) return;
    setBusy(true);
    try {
      const r = await OrganizationService.purgeWorkspace(workspace.id, confirmText.trim());
      if (r.success) { toast.success(r.message || 'Workspace permanently deleted.'); await onPurged(); }
      else toast.error(r.message || 'Failed to delete.');
    } catch (err) {
      const v = err as { response?: { data?: { message?: string } } };
      toast.error(v.response?.data?.message ?? 'Failed to delete.');
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-red-500/20 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 text-red-300">
          <AlertTriangle className="w-5 h-5" />
          <h2 className="text-lg font-semibold">Permanently delete workspace</h2>
        </div>
        <p className="text-sm text-slate-300 mt-3 leading-relaxed">
          This <span className="font-semibold text-red-300">cannot be undone</span>. It will permanently
          delete <span className="font-semibold text-white">{workspace.name}</span> and{' '}
          <span className="font-semibold">every record inside it</span> — accounting, inventory, orders,
          storefront, members and more. Prefer Restore unless you're certain.
        </p>
        <label className="block mt-5 text-sm text-slate-400 mb-2">
          Type <span className="font-semibold text-white">{workspace.name}</span> to confirm
        </label>
        <input
          autoFocus
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={workspace.name}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-red-500"
        />
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-white/5">Cancel</button>
          <button
            onClick={purge}
            disabled={!matches || busy}
            className="px-4 py-2 rounded-lg text-sm bg-red-600 hover:bg-red-500 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? 'Deleting…' : 'Delete forever'}
          </button>
        </div>
      </div>
    </div>
  );
}
