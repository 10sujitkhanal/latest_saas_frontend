'use client';

import { useCallback, useEffect, useState, use as reactUse } from 'react';
import { businessCurrency } from '@/lib/currency';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { HRService, type EmployeeRow, type DepartmentRow } from '@/services/hr.service';
import {
  PageHeader, AddButton, ErrorBox, Card, TableShell, EmptyRow,
  Modal, Field, TextInput, SelectInput, PrimaryButton, Pill, money, useList, apiError, HRTabs,
} from '@/components/hr/kit';

const empty = {
  first_name: '', last_name: '', employee_no: '', department: '', role: '',
  type: 'full_time', status: 'active', hire_date: '', basic_salary: '0',
  currency: businessCurrency(), email: '', phone: '', address: '', notes: '',
};

export default function HREmployeesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard service="hr" required="hr.view" workspaceId={wsId} skeleton="list">
      <Inner wsId={wsId} />
    </PermissionGuard>
  );
}

function Inner({ wsId }: { wsId: string }) {
  const fetcher = useCallback(() => HRService.employees.list(wsId), [wsId]);
  const { rows, loading, error, reload } = useList<EmployeeRow>(fetcher);
  const [depts, setDepts] = useState<DepartmentRow[]>([]);
  useEffect(() => { HRService.departments.list(wsId).then((r) => setDepts(r.data ?? [])).catch(() => {}); }, [wsId]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeeRow | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openCreate = () => { setEditing(null); setForm(empty); setFormError(null); setOpen(true); };
  const openEdit = (e: EmployeeRow) => {
    setEditing(e);
    setForm({
      first_name: e.first_name, last_name: e.last_name || '', employee_no: e.employee_no,
      department: e.department ? String(e.department) : '', role: e.role || '', type: e.type,
      status: e.status, hire_date: e.hire_date, basic_salary: String(e.basic_salary),
      currency: e.currency, email: e.email || '', phone: e.phone || '', address: e.address || '', notes: e.notes || '',
    });
    setFormError(null); setOpen(true);
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault(); setSaving(true); setFormError(null);
    try {
      const payload = { ...form, department: form.department ? Number(form.department) : null };
      const res = editing
        ? await HRService.employees.update(wsId, editing.id, payload)
        : await HRService.employees.create(wsId, payload);
      if (!res.success) { setFormError(res.message || 'Could not save employee.'); return; }
      setOpen(false); reload();
    } catch (err) { setFormError(apiError(err, 'Could not save employee.')); }
    finally { setSaving(false); }
  };

  const remove = async (e: EmployeeRow) => {
    if (!confirm(`Delete ${e.full_name || e.first_name}?`)) return;
    try { await HRService.employees.remove(wsId, e.id); reload(); }
    catch (err) { alert(apiError(err, 'Could not delete.')); }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Employees" subtitle="Your people directory." action={<AddButton label="New employee" onClick={openCreate} />} />
      <HRTabs wsId={wsId} />
      {loading ? <PageSkeleton kind="list" /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
        <Card>
          <TableShell head={<tr><th className="px-3 py-2">#</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">Department</th><th className="px-3 py-2">Role</th><th className="px-3 py-2">Type</th><th className="px-3 py-2 text-center">Status</th><th className="px-3 py-2 text-right">Salary</th><th className="px-3 py-2 text-right">Actions</th></tr>}>
            {rows.map((e) => (
              <tr key={e.id} className="text-slate-300">
                <td className="px-3 py-2 text-slate-400">{e.employee_no}</td>
                <td className="px-3 py-2 font-medium text-white">{e.full_name || `${e.first_name} ${e.last_name}`}</td>
                <td className="px-3 py-2">{e.department_name || '—'}</td>
                <td className="px-3 py-2">{e.role || '—'}</td>
                <td className="px-3 py-2">{e.type.replace('_', ' ')}</td>
                <td className="px-3 py-2 text-center"><Pill>{e.status.replace('_', ' ')}</Pill></td>
                <td className="px-3 py-2 text-right">{money(e.basic_salary, e.currency)}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button onClick={() => openEdit(e)} className="text-xs font-medium text-cyan-300 hover:text-cyan-200">Edit</button>
                  <button onClick={() => remove(e)} className="ml-3 text-xs font-medium text-red-300 hover:text-red-200">Delete</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={8} label="No employees yet." />}
          </TableShell>
        </Card>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit employee' : 'New employee'}>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name"><TextInput required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></Field>
            <Field label="Last name"><TextInput value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></Field>
            <Field label="Employee no. (auto — leave blank)"><TextInput value={form.employee_no} onChange={(e) => setForm({ ...form, employee_no: e.target.value })} placeholder="EMP-2026-0001" /></Field>
            <Field label="Department"><SelectInput value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}><option value="">— None —</option>{depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</SelectInput></Field>
            <Field label="Role"><TextInput value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} /></Field>
            <Field label="Type"><SelectInput value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="full_time">Full Time</option><option value="part_time">Part Time</option><option value="contract">Contract</option><option value="intern">Intern</option></SelectInput></Field>
            <Field label="Status"><SelectInput value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="active">Active</option><option value="inactive">Inactive</option><option value="on_leave">On Leave</option><option value="terminated">Terminated</option></SelectInput></Field>
            <Field label="Hire date"><TextInput type="date" required value={form.hire_date} onChange={(e) => setForm({ ...form, hire_date: e.target.value })} /></Field>
            <Field label="Basic salary"><TextInput type="number" step="0.01" value={form.basic_salary} onChange={(e) => setForm({ ...form, basic_salary: e.target.value })} /></Field>
            <Field label="Currency"><TextInput value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></Field>
            <Field label="Email"><TextInput value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Phone"><TextInput value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          </div>
          {formError && <p className="text-xs text-red-300">{formError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10">Cancel</button>
            <PrimaryButton type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create employee'}</PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
