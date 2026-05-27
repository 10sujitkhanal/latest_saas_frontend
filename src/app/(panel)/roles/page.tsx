'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, ShieldCheck, Lock, X, CheckCircle2, Users, ArrowRight, ArrowLeft, Info } from 'lucide-react';
import Topbar from '@/components/Topbar';
import { PageSpinner, PageError, EmptyState } from '@/components/StateViews';
import { OrganizationService, type RoleDef, type PermissionDef } from '@/services/organization.service';

type Editable = {
  id?: number;
  code: string;
  name: string;
  description: string;
  permission_codes: string[];
  is_default: boolean;
  is_system?: boolean;
};

const emptyForm: Editable = {
  code: '',
  name: '',
  description: '',
  permission_codes: [],
  is_default: false,
};

export default function RolesPage() {
  const [roles, setRoles] = useState<RoleDef[] | null>(null);
  const [permissions, setPermissions] = useState<PermissionDef[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editable | null>(null);
  const [busy, setBusy] = useState<'create' | 'update' | 'delete' | null>(null);

  const load = async () => {
    setError(null);
    try {
      const [rolesRes, permsRes] = await Promise.all([
        OrganizationService.listRoles(),
        OrganizationService.listPermissions(),
      ]);
      if (!rolesRes.success) throw new Error(rolesRes.message || 'Failed to load roles.');
      if (!permsRes.success) throw new Error(permsRes.message || 'Failed to load permissions.');
      setRoles(rolesRes.data ?? []);
      setPermissions(permsRes.data ?? []);
    } catch (err) {
      const v = err as { response?: { data?: { message?: string } }; message?: string };
      setError(v.response?.data?.message ?? v.message ?? 'Failed to load roles.');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => setEditing({ ...emptyForm });
  const openEdit = (role: RoleDef) =>
    setEditing({
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description ?? '',
      permission_codes: [...(role.permission_codes ?? [])],
      is_default: role.is_default,
      is_system: role.is_system,
    });

  const remove = async (role: RoleDef) => {
    if (role.is_system) {
      toast.error('System roles cannot be deleted.');
      return;
    }
    if (role.user_count > 0) {
      toast.error(`Cannot delete — ${role.user_count} user${role.user_count === 1 ? '' : 's'} still assigned to "${role.name}".`);
      return;
    }
    if (!confirm(`Delete the "${role.name}" role?`)) return;
    setBusy('delete');
    try {
      const res = await OrganizationService.deleteRole(role.id);
      if (res.success) {
        toast.success('Role deleted.');
        await load();
      } else {
        toast.error(res.message || 'Failed to delete role.');
      }
    } catch (err) {
      const v = err as { response?: { data?: { message?: string } } };
      toast.error(v.response?.data?.message ?? 'Failed to delete role.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Topbar
        title="Roles"
        subtitle="Bundle permissions into named roles you can assign to teammates."
        actions={
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-lg shadow-emerald-500/20 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New role
          </button>
        }
      />

      <main className="flex-1 px-6 lg:px-10 py-8 overflow-y-auto">
        {roles === null && !error && <PageSpinner />}
        {error && <PageError message={error} onRetry={load} />}

        {roles && roles.length === 0 && !error && (
          <EmptyState
            title="No roles yet"
            description="Create your first role to grant teammates a curated bundle of permissions."
            action={
              <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold">
                <Plus className="w-4 h-4" /> New role
              </button>
            }
          />
        )}

        {roles && roles.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {roles.map((role) => (
              <RoleCard
                key={role.id}
                role={role}
                onEdit={() => openEdit(role)}
                onDelete={() => remove(role)}
                deleting={busy === 'delete'}
              />
            ))}
          </div>
        )}
      </main>

      {editing && (
        <RoleModal
          editable={editing}
          permissions={permissions}
          existing={roles ?? []}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
          busy={busy === 'create' || busy === 'update'}
          setBusy={setBusy}
        />
      )}
    </>
  );
}

function RoleCard({
  role,
  onEdit,
  onDelete,
  deleting,
}: {
  role: RoleDef;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-300">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="flex items-center gap-1.5">
          {role.is_default && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-300 border border-sky-500/30">
              Default
            </span>
          )}
          {role.is_system && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30">
              <Lock className="w-3 h-3" />
              System
            </span>
          )}
        </div>
      </div>
      <h3 className="mt-4 text-lg font-semibold text-white truncate">{role.name}</h3>
      <p className="text-xs text-slate-500 font-mono mt-0.5">{role.code}</p>
      {role.description && <p className="text-sm text-slate-400 mt-2 line-clamp-2">{role.description}</p>}

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-white/[0.03] border border-white/5 px-3 py-2">
          <div className="text-slate-500 uppercase tracking-wider text-[10px]">Permissions</div>
          <div className="text-white font-semibold mt-0.5">
            {role.code === 'owner' ? 'All' : (role.permission_codes?.length ?? 0)}
          </div>
        </div>
        <div className="rounded-lg bg-white/[0.03] border border-white/5 px-3 py-2 flex items-center gap-2">
          <Users className="w-3.5 h-3.5 text-slate-500" />
          <div>
            <div className="text-slate-500 uppercase tracking-wider text-[10px]">Members</div>
            <div className="text-white font-semibold mt-0.5">{role.user_count}</div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={onEdit}
          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-sm rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 text-slate-200 transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
          {role.is_system ? 'Adjust permissions' : 'Edit'}
        </button>
        <button
          onClick={onDelete}
          disabled={deleting || role.is_system || role.user_count > 0}
          title={
            role.is_system
              ? 'System roles cannot be deleted.'
              : role.user_count > 0
              ? `Reassign ${role.user_count} member${role.user_count === 1 ? '' : 's'} before deleting.`
              : 'Delete role'
          }
          className="py-2 px-3 text-sm rounded-lg bg-white/[0.02] hover:bg-red-500/10 hover:text-red-300 border border-white/5 text-slate-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function RoleModal({
  editable,
  permissions,
  existing,
  onClose,
  onSaved,
  busy,
  setBusy,
}: {
  editable: Editable;
  permissions: PermissionDef[];
  existing: RoleDef[];
  onClose: () => void;
  onSaved: () => Promise<void>;
  busy: boolean;
  setBusy: (b: 'create' | 'update' | null) => void;
}) {
  const [form, setForm] = useState<Editable>(editable);
  const [formError, setFormError] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);

  // Group permissions by service, then by module so the picker is scannable.
  // Owned services first, locked services below.
  type ModGroup = { code: string; name: string; items: PermissionDef[] };
  type SvcGroup = {
    serviceKey: string;
    serviceName: string;
    isOwned: boolean;
    modules: ModGroup[];
  };
  const grouped = useMemo<SvcGroup[]>(() => {
    const map = new Map<string, SvcGroup>();
    for (const p of permissions) {
      const svcKey = p.service_name ? `svc:${p.service_id}` : 'core';
      const svcName = p.service_name ?? 'Core';
      const owned = p.service_id == null ? true : p.is_owned;

      let svc = map.get(svcKey);
      if (!svc) {
        svc = { serviceKey: svcKey, serviceName: svcName, isOwned: owned, modules: [] };
        map.set(svcKey, svc);
      }
      let mod = svc.modules.find((m) => m.code === p.module_code);
      if (!mod) {
        mod = { code: p.module_code, name: p.module_name, items: [] };
        svc.modules.push(mod);
      }
      mod.items.push(p);
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.isOwned !== b.isOwned) return a.isOwned ? -1 : 1;
      return a.serviceName.localeCompare(b.serviceName);
    });
  }, [permissions]);

  const togglePermission = (code: string) => {
    setForm((f) => ({
      ...f,
      permission_codes: f.permission_codes.includes(code)
        ? f.permission_codes.filter((c) => c !== code)
        : [...f.permission_codes, code],
    }));
  };

  const toggleAllInModule = (moduleCode: string) => {
    const moduleCodes = permissions.filter((p) => p.module_code === moduleCode).map((p) => p.code);
    const hasAll = moduleCodes.every((c) => form.permission_codes.includes(c));
    setForm((f) => ({
      ...f,
      permission_codes: hasAll
        ? f.permission_codes.filter((c) => !moduleCodes.includes(c))
        : [...new Set([...f.permission_codes, ...moduleCodes])],
    }));
  };

  const isEditing = form.id != null;
  const isOwnerRole = form.code === 'owner';

  const validateStep1 = (): string | null => {
    const code = form.code.trim().toLowerCase();
    if (!code) return 'Role code is required.';
    if (!/^[a-z][a-z0-9_-]*$/.test(code)) {
      return 'Code must start with a letter and contain only lowercase letters, numbers, underscores, or dashes.';
    }
    if (!isEditing) {
      const taken = existing.some((r) => r.code === code);
      if (taken) return 'A role with that code already exists.';
    }
    if (!form.name.trim() || form.name.trim().length < 2) return 'Name must be at least 2 characters.';
    return null;
  };

  const goNext = (e?: React.MouseEvent) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    const err = validateStep1();
    setFormError(err);
    if (!err) setStep(2);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // If a user hits Enter inside an input on step 1, the form would normally
    // post — instead, advance to step 2.
    if (step === 1) {
      goNext();
      return;
    }
    const err = validateStep1();
    if (err) {
      setFormError(err);
      setStep(1);
      return;
    }
    setFormError(null);
    setBusy(isEditing ? 'update' : 'create');
    try {
      const payload = {
        code: form.code.trim().toLowerCase(),
        name: form.name.trim(),
        description: form.description.trim(),
        permission_codes: isOwnerRole ? [] : form.permission_codes,
        is_default: form.is_default,
      };
      const res = isEditing
        ? await OrganizationService.updateRole(form.id!, payload)
        : await OrganizationService.createRole(payload);
      if (res.success) {
        toast.success(isEditing ? 'Role updated.' : 'Role created.');
        await onSaved();
      } else {
        setFormError(res.message || 'Failed to save role.');
      }
    } catch (err) {
      const v = err as { response?: { data?: { message?: string } } };
      setFormError(v.response?.data?.message ?? 'Failed to save role.');
    } finally {
      setBusy(null);
    }
  };

  const moduleAllSelected = (moduleCode: string) => {
    const all = permissions.filter((p) => p.module_code === moduleCode).map((p) => p.code);
    return all.length > 0 && all.every((c) => form.permission_codes.includes(c));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <form
        onSubmit={submit}
        className="w-full max-w-2xl max-h-[90vh] rounded-2xl bg-slate-900 border border-white/10 shadow-2xl flex flex-col"
      >
        <div className="flex items-start justify-between gap-4 p-6 border-b border-white/5">
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-white">
              {isEditing ? `Edit role: ${editable.name}` : 'Create a role'}
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              {step === 1
                ? 'Step 1 of 2 — name and describe this role.'
                : isOwnerRole
                ? 'Step 2 of 2 — Owner gets every permission automatically.'
                : 'Step 2 of 2 — pick the permissions you want to grant.'}
            </p>
            <Stepper step={step} />
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-md text-slate-500 hover:text-white hover:bg-white/5">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {step === 1 && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Code <span className="text-slate-500 font-normal">(machine name)</span>
                  </label>
                  <input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    disabled={editable.is_system}
                    placeholder="e.g. sales-rep"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                  />
                  {editable.is_system && (
                    <p className="text-[11px] text-slate-500 mt-1">System role codes cannot be renamed.</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Display name</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Sales Rep"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="What can this role do?"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_default}
                  onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
                  className="accent-emerald-500"
                />
                <span className="text-sm text-slate-300">Assign this role automatically to newly invited members</span>
              </label>
            </>
          )}

          {step === 2 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-slate-300">Permissions</label>
                <span className="text-xs text-slate-500">
                  {isOwnerRole ? 'All permissions (implicit)' : `${form.permission_codes.length} selected`}
                </span>
              </div>

              {isOwnerRole ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.04] p-3 text-sm text-amber-200 flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  The Owner role grants every permission automatically — no individual selections are needed.
                </div>
              ) : permissions.length === 0 ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.05] p-4 text-sm text-amber-200 flex items-start gap-3">
                  <Info className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold">No permissions available for your current plan.</p>
                    <p className="text-xs text-amber-200/80 mt-1">
                      Permissions are scoped to the services you have. Upgrade your plan or buy an add-on service to unlock permissions for that module.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  {grouped.map((svc) => (
                    <div key={svc.serviceKey} className={!svc.isOwned ? 'opacity-90' : ''}>
                      <div className="flex items-center justify-between mb-2 px-1">
                        <div className="flex items-center gap-2">
                          {!svc.isOwned && <Lock className="w-3.5 h-3.5 text-amber-300" />}
                          <span className={`text-[11px] uppercase tracking-[0.18em] font-bold ${svc.isOwned ? 'text-emerald-300' : 'text-amber-300'}`}>
                            {svc.serviceName}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            · {svc.modules.reduce((acc, m) => acc + m.items.length, 0)} perm{svc.modules.reduce((acc, m) => acc + m.items.length, 0) === 1 ? '' : 's'}
                          </span>
                        </div>
                        {!svc.isOwned && (
                          <a
                            href="/subscription"
                            className="text-[10px] uppercase tracking-wider font-bold text-emerald-300 hover:text-emerald-200"
                          >
                            Upgrade →
                          </a>
                        )}
                      </div>

                      {!svc.isOwned && (
                        <div className="mb-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.05] px-3 py-2 text-[12px] text-amber-200/90 flex items-start gap-2">
                          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                          <span>
                            Your plan doesn't include <strong>{svc.serviceName}</strong>. Upgrade to grant these permissions.
                          </span>
                        </div>
                      )}

                      <div className="space-y-3">
                        {svc.modules.map((mod) => {
                          const moduleCodes = mod.items.map((p) => p.code);
                          const allSelected = moduleCodes.every((c) => form.permission_codes.includes(c));
                          return (
                            <div
                              key={mod.code}
                              className={`rounded-lg border ${svc.isOwned ? 'border-white/5 bg-white/[0.02]' : 'border-white/5 bg-white/[0.01]'}`}
                            >
                              <div className="w-full flex items-center justify-between px-4 py-2.5 border-b border-white/5">
                                <div className="text-left">
                                  <div className={`text-sm font-semibold ${svc.isOwned ? 'text-white' : 'text-slate-400'}`}>
                                    {mod.name}
                                  </div>
                                  <div className="text-[11px] uppercase tracking-wider text-slate-500 font-mono">{mod.code}</div>
                                </div>
                                {svc.isOwned && (
                                  <button
                                    type="button"
                                    onClick={() => toggleAllInModule(mod.code)}
                                    className="text-xs text-emerald-300 font-medium hover:text-emerald-200"
                                  >
                                    {allSelected ? 'Clear all' : 'Select all'}
                                  </button>
                                )}
                              </div>
                              <div className="p-3 grid grid-cols-1 gap-2">
                                {mod.items.map((perm) => {
                                  const selected = form.permission_codes.includes(perm.code);
                                  const disabled = !svc.isOwned;
                                  return (
                                    <label
                                      key={perm.id}
                                      title={disabled ? `Upgrade to enable ${svc.serviceName} permissions.` : undefined}
                                      className={`flex items-start gap-3 px-3 py-2 rounded-md transition-colors ${
                                        disabled
                                          ? 'cursor-not-allowed bg-white/[0.01] border border-dashed border-white/10'
                                          : selected
                                          ? 'cursor-pointer bg-emerald-500/[0.07] border border-emerald-500/20'
                                          : 'cursor-pointer hover:bg-white/[0.03] border border-transparent'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={selected}
                                        disabled={disabled}
                                        onChange={() => !disabled && togglePermission(perm.code)}
                                        className="mt-0.5 accent-emerald-500 disabled:opacity-40"
                                      />
                                      <div className="flex-1 min-w-0">
                                        <div className={`text-sm flex items-center gap-2 ${disabled ? 'text-slate-500' : 'text-white'}`}>
                                          {selected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />}
                                          {disabled && <Lock className="w-3.5 h-3.5 text-slate-500" />}
                                          {perm.label}
                                        </div>
                                        <div className="text-[11px] font-mono text-slate-500 mt-0.5">{perm.code}</div>
                                        {perm.description && (
                                          <div className={`text-xs mt-1 ${disabled ? 'text-slate-600' : 'text-slate-400'}`}>
                                            {perm.description}
                                          </div>
                                        )}
                                      </div>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {formError && (
          <div className="px-6 pt-3">
            <div className="rounded-lg border border-red-500/40 bg-red-500/[0.08] px-3 py-2 text-sm text-red-200 flex items-start gap-2">
              <Info className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{formError}</span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-white/5">
          {step === 2 ? (
            <button
              type="button"
              onClick={() => {
                setFormError(null);
                setStep(1);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-white/5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-white/5">
              Cancel
            </button>
            {step === 1 ? (
              <button
                type="button"
                onClick={goNext}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
              >
                Next: permissions
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={busy}
                className="px-4 py-2 rounded-lg text-sm bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-50"
              >
                {busy ? 'Saving…' : isEditing ? 'Save changes' : 'Create role'}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

function Stepper({ step }: { step: 1 | 2 }) {
  return (
    <div className="mt-3 flex items-center gap-2">
      <Pill index={1} label="Details" active={step === 1} done={step > 1} />
      <div className="flex-1 h-px bg-white/10" />
      <Pill index={2} label="Permissions" active={step === 2} done={false} />
    </div>
  );
}

function Pill({ index, label, active, done }: { index: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className={`inline-flex items-center gap-2 text-xs font-semibold ${active || done ? 'text-emerald-300' : 'text-slate-500'}`}>
      <span
        className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold ${
          done
            ? 'bg-emerald-500 text-slate-950'
            : active
            ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
            : 'bg-white/[0.04] border border-white/10 text-slate-500'
        }`}
      >
        {done ? '✓' : index}
      </span>
      {label}
    </div>
  );
}
