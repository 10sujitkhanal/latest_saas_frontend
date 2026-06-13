'use client';

import { useCallback, useEffect, useState, use as reactUse } from 'react';
import Link from 'next/link';
import { ImageIcon, Upload, Sparkles, Loader2 } from 'lucide-react';
import { businessCurrency } from '@/lib/currency';
import { AgentsService } from '@/services/agents.service';
import { MarketplaceService } from '@/services/marketplace.service';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { InventoryService, type ItemRow, type CategoryRow } from '@/services/inventory.service';
import {
  InventoryTabs, PageHeader, AddButton, ErrorBox, Card, TableShell, EmptyRow,
  Modal, Field, TextInput, SelectInput, PrimaryButton, Pill, money, useList, apiError,
} from '@/components/inventory/kit';

const UNITS = ['pcs', 'kg', 'g', 'l', 'ml', 'box', 'pack', 'hour'];
const emptyForm = { sku: '', name: '', category: '', unit: 'pcs', cost_price: '0', selling_price: '0', reorder_point: '0', reorder_qty: '0', currency: businessCurrency(), barcode: '', description: '', opening_stock: '0' };
// Drop a Decimal(…,4) string's trailing zeros for display: "1100.0000" -> "1100".
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? String(n) : '0'; };

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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [sfBusy, setSfBusy] = useState<number | null>(null);

  // One-click "Add to storefront" — creates an idempotent draft Listing from the
  // item, then reloads so the row flips to "View listing".
  const addToStorefront = async (i: ItemRow) => {
    setSfBusy(i.id);
    try {
      const res = await MarketplaceService.fromItem(wsId, i.id);
      if (!res.success) { alert(res.message || 'Could not add to storefront.'); return; }
      reload();
    } catch (err) { alert(apiError(err, 'Could not add to storefront.')); }
    finally { setSfBusy(null); }
  };

  const openCreate = () => { setEditing(null); setForm(emptyForm); setImageFile(null); setImagePreview(''); setFormError(null); setOpen(true); };
  const openEdit = (i: ItemRow) => {
    setEditing(i);
    setForm({ sku: i.sku, name: i.name, category: i.category ? String(i.category) : '', unit: i.unit, cost_price: num(i.cost_price), selling_price: num(i.selling_price), reorder_point: num(i.reorder_point), reorder_qty: num(i.reorder_qty), currency: i.currency, barcode: i.barcode || '', description: i.description || '', opening_stock: '0' });
    setImageFile(null); setImagePreview(i.image_display || '');
    setFormError(null); setOpen(true);
  };

  const pickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setFormError('Image must be 5 MB or smaller.'); return; }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setFormError(null);
  };

  const [suggestingDesc, setSuggestingDesc] = useState(false);
  // Copilot: draft a product description from the name + category.
  const suggestDescription = async () => {
    if (suggestingDesc) return;
    if (!form.name.trim()) { setFormError('Enter the product name first.'); return; }
    setSuggestingDesc(true);
    try {
      const catName = categories.find((c) => String(c.id) === form.category)?.name || '';
      const r = await AgentsService.suggestProductDescription(wsId, { name: form.name, category: catName });
      if (r.success && r.data?.text) setForm((f) => ({ ...f, description: r.data.text }));
      else setFormError(r.message || 'The assistant could not draft a description just now.');
    } catch (e) { setFormError(apiError(e, 'Could not draft a description.')); }
    finally { setSuggestingDesc(false); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setFormError(null);
    try {
      const { opening_stock, ...rest } = form;
      const payload = { ...rest, category: form.category ? Number(form.category) : null };
      const res = editing
        ? (imageFile ? await InventoryService.items.updateWithImage(wsId, editing.id, payload, imageFile) : await InventoryService.items.update(wsId, editing.id, payload))
        : (imageFile ? await InventoryService.items.createWithImage(wsId, payload, imageFile) : await InventoryService.items.create(wsId, payload));
      if (!res.success) { setFormError(res.message || 'Could not save item.'); return; }
      // New item with opening stock → record it as a stock-in movement (the
      // audited way; qty_on_hand is read-only and never edited directly).
      const newId = (res.data as { id?: number } | undefined)?.id;
      if (!editing && newId && Number(opening_stock) > 0) {
        try { await InventoryService.recordMovement(wsId, { item: newId, type: 'in', qty: opening_stock, reference: 'Opening stock' }); }
        catch { /* item created; opening movement is best-effort */ }
      }
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
                <td className="px-3 py-2 text-white">
                  <div className="flex items-center gap-2">
                    {i.image_display
                      ? <img src={i.image_display} alt="" className="h-7 w-7 shrink-0 rounded object-cover border border-white/10" />
                      : <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-white/10 bg-black/20"><ImageIcon className="h-3.5 w-3.5 text-slate-600" /></span>}
                    {i.name}
                  </div>
                </td>
                <td className="px-3 py-2">{i.category_name || '—'}</td>
                <td className="px-3 py-2 text-right">{num(i.qty_on_hand)} {i.unit}</td>
                <td className="px-3 py-2 text-right">{money(i.cost_price, i.currency)}</td>
                <td className="px-3 py-2 text-right">{money(i.selling_price, i.currency)}</td>
                <td className="px-3 py-2 text-center">{i.is_low_stock ? <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] text-amber-200">low</span> : <Pill>ok</Pill>}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button onClick={() => openEdit(i)} className="text-xs font-medium text-cyan-300 hover:text-cyan-200">Edit</button>
                  {i.storefront_listing_id
                    ? <Link href={`/w/${wsId}/marketplace`} className="ml-3 text-xs font-medium text-pink-300 hover:text-pink-200">View listing</Link>
                    : <button disabled={sfBusy === i.id} onClick={() => addToStorefront(i)} className="ml-3 text-xs font-medium text-emerald-300 hover:text-emerald-200 disabled:opacity-50">Add to storefront</button>}
                </td>
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
            {!editing && <Field label="Opening stock (optional)"><TextInput type="number" step="0.01" value={form.opening_stock} onChange={(e) => setForm({ ...form, opening_stock: e.target.value })} placeholder="0" /></Field>}
            <Field label="Currency"><TextInput value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></Field>
            <Field label="Barcode"><TextInput value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} /></Field>
          </div>

          {/* Product photo — shows on the storefront; the barcode/AI agent can fill this too */}
          <Field label="Photo">
            <div className="flex items-center gap-3">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/20">
                {imagePreview ? <img src={imagePreview} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-5 w-5 text-slate-600" />}
              </div>
              <div className="flex flex-col items-start gap-1">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10">
                  <Upload className="h-3.5 w-3.5" /> {imagePreview ? 'Change photo' : 'Upload photo'}
                  <input type="file" accept="image/*" onChange={pickImage} className="hidden" />
                </label>
                {imageFile && <button type="button" onClick={() => { setImageFile(null); setImagePreview(editing?.image_display || ''); }} className="text-[11px] text-slate-500 hover:text-rose-300">Cancel new photo</button>}
                <span className="text-[11px] text-slate-500">JPG/PNG/WEBP, up to 5 MB.</span>
              </div>
            </div>
          </Field>

          {/* Description — shows on the storefront; the agent can draft it */}
          <Field label="Description">
            <div className="mb-2 flex justify-end">
              <button type="button" onClick={suggestDescription} disabled={suggestingDesc}
                className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/40 bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold text-violet-200 hover:bg-violet-500/20 disabled:opacity-50">
                {suggestingDesc ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {suggestingDesc ? 'Drafting…' : 'Suggest with AI'}
              </button>
            </div>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3}
              placeholder="A short, appealing description customers see on your store."
              className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-pink-500/40" />
          </Field>
          {!editing && <p className="text-xs text-slate-500">Set the starting quantity in “Opening stock”. After that, quantity changes only via the Stock Movements tab.</p>}
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
