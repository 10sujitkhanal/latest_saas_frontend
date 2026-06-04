'use client';

import { useCallback, useEffect, useState, use as reactUse } from 'react';
import Link from 'next/link';
import { Globe } from 'lucide-react';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { MarketplaceService, type ListingRow } from '@/services/marketplace.service';
import { InventoryService, type ItemRow } from '@/services/inventory.service';
import {
  PageHeader, AddButton, ErrorBox, Card, TableShell, EmptyRow,
  Modal, Field, TextInput, SelectInput, PrimaryButton, Pill, money, useList, apiError,
} from '@/components/accounting/kit';

const emptyForm = { title: '', category: '', item: '', price: '0', currency: 'NPR', image_url: '', description: '' };

export default function MarketplacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard service="marketplace" required="marketplace.view" workspaceId={wsId} skeleton="list">
      <Inner wsId={wsId} />
    </PermissionGuard>
  );
}

function Inner({ wsId }: { wsId: string }) {
  const fetcher = useCallback(() => MarketplaceService.list(wsId), [wsId]);
  const { rows, loading, error, reload } = useList<ListingRow>(fetcher);
  const [items, setItems] = useState<ItemRow[]>([]);
  useEffect(() => { InventoryService.items.list(wsId).then((r) => setItems((r.data ?? []).filter((i) => i.is_active))).catch(() => {}); }, [wsId]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ListingRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setFormError(null); setOpen(true); };
  const openEdit = (l: ListingRow) => {
    setEditing(l);
    setForm({ title: l.title, category: l.category || '', item: l.item ? String(l.item) : '', price: String(l.price), currency: l.currency, image_url: l.image_url || '', description: l.description || '' });
    setFormError(null); setOpen(true);
  };

  const pickItem = (itemId: string) => {
    const it = items.find((x) => String(x.id) === itemId);
    setForm((f) => ({ ...f, item: itemId, title: f.title || (it ? it.name : ''), price: it ? String(it.selling_price) : f.price }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setFormError(null);
    try {
      const payload = { ...form, item: form.item ? Number(form.item) : null };
      const res = editing
        ? await MarketplaceService.update(wsId, editing.id, payload)
        : await MarketplaceService.create(wsId, payload);
      if (!res.success) { setFormError(res.message || 'Could not save listing.'); return; }
      setOpen(false); setForm(emptyForm); setEditing(null); reload();
    } catch (err) { setFormError(apiError(err, 'Could not save listing.')); }
    finally { setSaving(false); }
  };

  const act = async (id: number, fn: () => Promise<{ success: boolean; message?: string }>) => {
    setBusyId(id);
    try { const res = await fn(); if (!res.success) alert(res.message || 'Action failed.'); reload(); }
    catch (err) { alert(apiError(err, 'Action failed.')); }
    finally { setBusyId(null); }
  };

  const removeListing = async (l: ListingRow) => {
    if (!confirm(`Delete listing "${l.title}"?`)) return;
    try { await MarketplaceService.remove(wsId, l.id); reload(); }
    catch (err) { alert(apiError(err, 'Could not delete.')); }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Marketplace Listings" subtitle="Manage and publish product listings, then open your public storefront to take orders." action={<AddButton label="New listing" onClick={openCreate} />} />
      <Link href={`/w/${wsId}/marketplace/storefront`} className="flex items-center gap-3 rounded-xl border border-pink-400/20 bg-pink-500/[0.05] px-4 py-3 hover:bg-pink-500/[0.1] transition-colors">
        <Globe className="h-5 w-5 text-pink-300" />
        <span className="flex-1">
          <span className="block text-sm font-semibold text-white">Storefront setup</span>
          <span className="block text-[11px] text-slate-400">Open your public store, accept orders, sell memberships & gift cards →</span>
        </span>
      </Link>
      {loading ? <PageSkeleton kind="list" /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
        <Card>
          <TableShell head={<tr><th className="px-3 py-2">Title</th><th className="px-3 py-2">Category</th><th className="px-3 py-2 text-right">Price</th><th className="px-3 py-2 text-center">Featured</th><th className="px-3 py-2 text-center">Status</th><th className="px-3 py-2 text-right">Actions</th></tr>}>
            {rows.map((l) => (
              <tr key={l.id} className="text-slate-300">
                <td className="px-3 py-2 font-medium text-white">{l.title}</td>
                <td className="px-3 py-2">{l.category || '—'}</td>
                <td className="px-3 py-2 text-right">{money(l.price, l.currency)}</td>
                <td className="px-3 py-2 text-center">{l.is_featured ? <Pill>featured</Pill> : <span className="text-slate-600">—</span>}</td>
                <td className="px-3 py-2 text-center"><Pill>{l.status}</Pill></td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button onClick={() => openEdit(l)} className="text-xs font-medium text-cyan-300 hover:text-cyan-200">Edit</button>
                  {l.status !== 'published'
                    ? <button disabled={busyId === l.id} onClick={() => act(l.id, () => MarketplaceService.publish(wsId, l.id, true))} className="ml-3 text-xs font-semibold text-emerald-300 hover:text-emerald-200 disabled:opacity-50">Publish</button>
                    : <button disabled={busyId === l.id} onClick={() => act(l.id, () => MarketplaceService.publish(wsId, l.id, false))} className="ml-3 text-xs font-medium text-amber-300 hover:text-amber-200 disabled:opacity-50">Unpublish</button>}
                  <button disabled={busyId === l.id} onClick={() => act(l.id, () => MarketplaceService.feature(wsId, l.id))} className="ml-3 text-xs font-medium text-violet-300 hover:text-violet-200 disabled:opacity-50">{l.is_featured ? 'Unfeature' : 'Feature'}</button>
                  <button onClick={() => removeListing(l)} className="ml-3 text-xs font-medium text-red-300 hover:text-red-200">Delete</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={6} label="No listings yet." />}
          </TableShell>
        </Card>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit listing' : 'New listing'}>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Link to inventory item (optional)"><SelectInput value={form.item} onChange={(e) => pickItem(e.target.value)}><option value="">— None —</option>{items.map((it) => <option key={it.id} value={it.id}>{it.sku} — {it.name}</option>)}</SelectInput></Field>
            <Field label="Title"><TextInput required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <Field label="Category"><TextInput value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field>
            <Field label="Price"><TextInput type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></Field>
            <Field label="Currency"><TextInput value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></Field>
            <Field label="Image URL"><TextInput value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} /></Field>
            <div className="sm:col-span-2"><Field label="Description"><TextInput value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field></div>
          </div>
          {formError && <p className="text-xs text-red-300">{formError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10">Cancel</button>
            <PrimaryButton type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create listing'}</PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
