'use client';

import { useCallback, useEffect, useState, use as reactUse } from 'react';
import { businessCurrency } from '@/lib/currency';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { InventoryService, type ItemRow, type CategoryRow } from '@/services/inventory.service';
import {
  InventoryTabs, PageHeader, AddButton, ErrorBox, Card, TableShell, EmptyRow,
  Modal, Field, TextInput, SelectInput, PrimaryButton, Pill, money, useList, apiError,
} from '@/components/inventory/kit';

const UNITS = ['pcs', 'kg', 'g', 'l', 'ml', 'box', 'pack', 'hour'];
const emptyForm = { sku: '', name: '', category: '', unit: 'pcs', cost_price: '0', selling_price: '0', reorder_point: '0', reorder_qty: '0', currency: businessCurrency(), barcode: '' };

export default function ItemsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard service="inventory" required="inventory.view" workspaceId={wsId} skeleton="list">
      <Inner wsId={wsId} />
    </PermissionGuard>
  );
}

function Inner({ wsId }: { wsId: string }) {
  const fetcher = useCallback(() => InventoryService.items.list(wsId), [wsId]);
  const { rows, loading, error, reload } = useList<ItemRow>(fetcher);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  useEffect(() => { InventoryService.categories.list(wsId).then((r) => setCategories((r.data ?? []).filter((c) => c.is_active))).catch(() => {}); }, [wsId]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ItemRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setFormError(null); setOpen(true); };
  const openEdit = (i: ItemRow) => {
    setEditing(i);
    setForm({ sku: i.sku, name: i.name, category: i.category ? String(i.category) : '', unit: i.unit, cost_price: String(i.cost_price), selling_price: String(i.selling_price), reorder_point: String(i.reorder_point), reorder_qty: String(i.reorder_qty), currency: i.currency, barcode: i.barcode || '' });
    setFormError(null); setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setFormError(null);
    try {
      const payload = { ...form, category: form.category ? Number(form.category) : null };
      const res = editing
        ? await InventoryService.items.update(wsId, editing.id, payload)
        : await InventoryService.items.create(wsId, payload);
      if (!res.success) { setFormError(res.message || 'Could not save item.'); return; }
      setOpen(false); setForm(emptyForm); setEditing(null); reload();
    } catch (err) { setFormError(apiError(err, 'Could not save item.')); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Inventory Items" subtitle="Products and stock levels. Quantity moves only via Stock Movements." action={<AddButton label="New item" onClick={openCreate} />} />
      <InventoryTabs wsId={wsId} />
      {loading ? <PageSkeleton kind="list" /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
        <Card>
          <TableShell head={<tr><th className="px-3 py-2">SKU</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">Category</th><th className="px-3 py-2 text-right">On hand</th><th className="px-3 py-2 text-right">Cost</th><th className="px-3 py-2 text-right">Price</th><th className="px-3 py-2 text-center">Stock</th><th className="px-3 py-2 text-right">Actions</th></tr>}>
            {rows.map((i) => (
              <tr key={i.id} className="text-slate-300">
                <td className="px-3 py-2 font-mono text-white">{i.sku}</td>
                <td className="px-3 py-2 text-white">{i.name}</td>
                <td className="px-3 py-2">{i.category_name || '—'}</td>
                <td className="px-3 py-2 text-right">{i.qty_on_hand} {i.unit}</td>
                <td className="px-3 py-2 text-right">{money(i.cost_price, i.currency)}</td>
                <td className="px-3 py-2 text-right">{money(i.selling_price, i.currency)}</td>
                <td className="px-3 py-2 text-center">{i.is_low_stock ? <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] text-amber-200">low</span> : <Pill>ok</Pill>}</td>
                <td className="px-3 py-2 text-right"><button onClick={() => openEdit(i)} className="text-xs font-medium text-cyan-300 hover:text-cyan-200">Edit</button></td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={8} label="No items yet. Add your first product." />}
          </TableShell>
        </Card>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit item' : 'New item'}>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="SKU"><TextInput required value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="SKU-001" /></Field>
            <Field label="Name"><TextInput required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Category"><SelectInput value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}><option value="">— None —</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</SelectInput></Field>
            <Field label="Unit"><SelectInput value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>{UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</SelectInput></Field>
            <Field label="Cost price"><TextInput type="number" step="0.01" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} /></Field>
            <Field label="Selling price"><TextInput type="number" step="0.01" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} /></Field>
            <Field label="Reorder point"><TextInput type="number" step="0.01" value={form.reorder_point} onChange={(e) => setForm({ ...form, reorder_point: e.target.value })} /></Field>
            <Field label="Reorder qty"><TextInput type="number" step="0.01" value={form.reorder_qty} onChange={(e) => setForm({ ...form, reorder_qty: e.target.value })} /></Field>
            <Field label="Currency"><TextInput value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></Field>
            <Field label="Barcode"><TextInput value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} /></Field>
          </div>
          {editing && <p className="text-xs text-slate-500">Quantity on hand is changed on the Stock Movements tab, not here.</p>}
          {formError && <p className="text-xs text-red-300">{formError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10">Cancel</button>
            <PrimaryButton type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create item'}</PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
