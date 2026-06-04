'use client';

import { useCallback, useState, use as reactUse } from 'react';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { InventoryService, type CategoryRow } from '@/services/inventory.service';
import {
  InventoryTabs, PageHeader, AddButton, ErrorBox, Card, TableShell, EmptyRow,
  Modal, Field, TextInput, PrimaryButton, Pill, useList, apiError,
} from '@/components/inventory/kit';

const emptyForm = { name: '', description: '' };

export default function CategoriesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard service="inventory" required="inventory.view" workspaceId={wsId} skeleton="list">
      <Inner wsId={wsId} />
    </PermissionGuard>
  );
}

function Inner({ wsId }: { wsId: string }) {
  const fetcher = useCallback(() => InventoryService.categories.list(wsId), [wsId]);
  const { rows, loading, error, reload } = useList<CategoryRow>(fetcher);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setFormError(null); setOpen(true); };
  const openEdit = (c: CategoryRow) => { setEditing(c); setForm({ name: c.name, description: c.description || '' }); setFormError(null); setOpen(true); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setFormError(null);
    try {
      const res = editing
        ? await InventoryService.categories.update(wsId, editing.id, form)
        : await InventoryService.categories.create(wsId, form);
      if (!res.success) { setFormError(res.message || 'Could not save category.'); return; }
      setOpen(false); setForm(emptyForm); setEditing(null); reload();
    } catch (err) { setFormError(apiError(err, 'Could not save category.')); }
    finally { setSaving(false); }
  };

  const remove = async (c: CategoryRow) => {
    if (!confirm(`Delete category ${c.name}?`)) return;
    try { await InventoryService.categories.remove(wsId, c.id); reload(); }
    catch (err) { alert(apiError(err, 'Could not delete category.')); }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Categories" subtitle="Group inventory items." action={<AddButton label="New category" onClick={openCreate} />} />
      <InventoryTabs wsId={wsId} />
      {loading ? <PageSkeleton kind="list" /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
        <Card>
          <TableShell head={<tr><th className="px-3 py-2">Name</th><th className="px-3 py-2">Description</th><th className="px-3 py-2 text-center">Items</th><th className="px-3 py-2 text-center">Status</th><th className="px-3 py-2 text-right">Actions</th></tr>}>
            {rows.map((c) => (
              <tr key={c.id} className="text-slate-300">
                <td className="px-3 py-2 font-medium text-white">{c.name}</td>
                <td className="px-3 py-2">{c.description || '—'}</td>
                <td className="px-3 py-2 text-center">{c.item_count ?? 0}</td>
                <td className="px-3 py-2 text-center"><Pill>{c.is_active ? 'active' : 'inactive'}</Pill></td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button onClick={() => openEdit(c)} className="text-xs font-medium text-cyan-300 hover:text-cyan-200">Edit</button>
                  <button onClick={() => remove(c)} className="ml-3 text-xs font-medium text-red-300 hover:text-red-200">Delete</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={5} label="No categories yet." />}
          </TableShell>
        </Card>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit category' : 'New category'}>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Name"><TextInput required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Beverages" /></Field>
          <Field label="Description"><TextInput value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          {formError && <p className="text-xs text-red-300">{formError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10">Cancel</button>
            <PrimaryButton type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create category'}</PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
