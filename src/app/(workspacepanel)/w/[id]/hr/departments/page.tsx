'use client';

import { useCallback, useState, use as reactUse } from 'react';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { HRService, type DepartmentRow } from '@/services/hr.service';
import {
  PageHeader, AddButton, ErrorBox, Card, TableShell, EmptyRow,
  Modal, Field, TextInput, PrimaryButton, Pill, useList, apiError, HRTabs,
} from '@/components/hr/kit';

export default function HRDepartmentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard service="hr" required="hr.view" workspaceId={wsId} skeleton="list">
      <Inner wsId={wsId} />
    </PermissionGuard>
  );
}

function Inner({ wsId }: { wsId: string }) {
  const fetcher = useCallback(() => HRService.departments.list(wsId), [wsId]);
  const { rows, loading, error, reload } = useList<DepartmentRow>(fetcher);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DepartmentRow | null>(null);
  const [form, setForm] = useState({ name: '', description: '', is_active: true });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openCreate = () => { setEditing(null); setForm({ name: '', description: '', is_active: true }); setFormError(null); setOpen(true); };
  const openEdit = (d: DepartmentRow) => { setEditing(d); setForm({ name: d.name, description: d.description || '', is_active: d.is_active }); setFormError(null); setOpen(true); };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault(); setSaving(true); setFormError(null);
    try {
      const res = editing ? await HRService.departments.update(wsId, editing.id, form) : await HRService.departments.create(wsId, form);
      if (!res.success) { setFormError(res.message || 'Could not save.'); return; }
      setOpen(false); reload();
    } catch (err) { setFormError(apiError(err, 'Could not save.')); }
    finally { setSaving(false); }
  };

  const remove = async (d: DepartmentRow) => {
    if (!confirm(`Delete department "${d.name}"?`)) return;
    try { await HRService.departments.remove(wsId, d.id); reload(); }
    catch (err) { alert(apiError(err, 'Could not delete.')); }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Departments" subtitle="Organise your people." action={<AddButton label="New department" onClick={openCreate} />} />
      <HRTabs wsId={wsId} />
      {loading ? <PageSkeleton kind="list" /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
        <Card>
          <TableShell head={<tr><th className="px-3 py-2">Name</th><th className="px-3 py-2">Description</th><th className="px-3 py-2 text-center">Employees</th><th className="px-3 py-2 text-center">Status</th><th className="px-3 py-2 text-right">Actions</th></tr>}>
            {rows.map((d) => (
              <tr key={d.id} className="text-slate-300">
                <td className="px-3 py-2 font-medium text-white">{d.name}</td>
                <td className="px-3 py-2">{d.description || '—'}</td>
                <td className="px-3 py-2 text-center">{d.employee_count ?? 0}</td>
                <td className="px-3 py-2 text-center"><Pill>{d.is_active ? 'active' : 'inactive'}</Pill></td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button onClick={() => openEdit(d)} className="text-xs font-medium text-cyan-300 hover:text-cyan-200">Edit</button>
                  <button onClick={() => remove(d)} className="ml-3 text-xs font-medium text-red-300 hover:text-red-200">Delete</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={5} label="No departments yet." />}
          </TableShell>
        </Card>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit department' : 'New department'}>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Name"><TextInput required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Description"><TextInput value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="h-4 w-4 accent-indigo-500" /> Active</label>
          {formError && <p className="text-xs text-red-300">{formError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10">Cancel</button>
            <PrimaryButton type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create'}</PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
