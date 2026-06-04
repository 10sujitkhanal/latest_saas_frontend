'use client';

import { useCallback, useEffect, useState, use as reactUse } from 'react';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { ExpensesService, type ExpenseCategoryRow } from '@/services/expenses.service';
import { AccountingService, type AccountRow } from '@/services/accounting.service';
import {
  PageHeader, AddButton, ErrorBox, Card, TableShell, EmptyRow,
  Modal, Field, TextInput, SelectInput, PrimaryButton, Pill, useList, apiError, ExpensesTabs,
} from '@/components/expenses/kit';

export default function ExpenseCategoriesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard service="expenses" required="expenses.view" workspaceId={wsId} skeleton="list">
      <Inner wsId={wsId} />
    </PermissionGuard>
  );
}

function Inner({ wsId }: { wsId: string }) {
  const fetcher = useCallback(() => ExpensesService.categories.list(wsId), [wsId]);
  const { rows, loading, error, reload } = useList<ExpenseCategoryRow>(fetcher);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  useEffect(() => {
    AccountingService.accounts?.list?.(wsId).then((r: { data?: AccountRow[] }) => setAccounts(r.data ?? [])).catch(() => {});
  }, [wsId]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseCategoryRow | null>(null);
  const [form, setForm] = useState({ name: '', description: '', account: '', is_active: true });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openCreate = () => { setEditing(null); setForm({ name: '', description: '', account: '', is_active: true }); setFormError(null); setOpen(true); };
  const openEdit = (c: ExpenseCategoryRow) => { setEditing(c); setForm({ name: c.name, description: c.description || '', account: c.account ? String(c.account) : '', is_active: c.is_active }); setFormError(null); setOpen(true); };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault(); setSaving(true); setFormError(null);
    try {
      const payload = { ...form, account: form.account ? Number(form.account) : null };
      const res = editing ? await ExpensesService.categories.update(wsId, editing.id, payload) : await ExpensesService.categories.create(wsId, payload);
      if (!res.success) { setFormError(res.message || 'Could not save.'); return; }
      setOpen(false); reload();
    } catch (err) { setFormError(apiError(err, 'Could not save.')); }
    finally { setSaving(false); }
  };

  const remove = async (c: ExpenseCategoryRow) => {
    if (!confirm(`Delete category "${c.name}"?`)) return;
    try { await ExpensesService.categories.remove(wsId, c.id); reload(); }
    catch (err) { alert(apiError(err, 'Could not delete.')); }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Expense Categories" subtitle="Optionally map each to a GL account." action={<AddButton label="New category" onClick={openCreate} />} />
      <ExpensesTabs wsId={wsId} />
      {loading ? <PageSkeleton kind="list" /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
        <Card>
          <TableShell head={<tr><th className="px-3 py-2">Name</th><th className="px-3 py-2">GL account</th><th className="px-3 py-2 text-center">Status</th><th className="px-3 py-2 text-right">Actions</th></tr>}>
            {rows.map((c) => (
              <tr key={c.id} className="text-slate-300">
                <td className="px-3 py-2 font-medium text-white">{c.name}</td>
                <td className="px-3 py-2">{c.account_name || '— default Operating Expenses —'}</td>
                <td className="px-3 py-2 text-center"><Pill>{c.is_active ? 'active' : 'inactive'}</Pill></td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button onClick={() => openEdit(c)} className="text-xs font-medium text-cyan-300 hover:text-cyan-200">Edit</button>
                  <button onClick={() => remove(c)} className="ml-3 text-xs font-medium text-red-300 hover:text-red-200">Delete</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={4} label="No categories yet." />}
          </TableShell>
        </Card>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit category' : 'New category'}>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Name"><TextInput required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="GL account (optional)"><SelectInput value={form.account} onChange={(e) => setForm({ ...form, account: e.target.value })}><option value="">— Default (Operating Expenses) —</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}</SelectInput></Field>
          <Field label="Description"><TextInput value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="h-4 w-4 accent-red-500" /> Active</label>
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
