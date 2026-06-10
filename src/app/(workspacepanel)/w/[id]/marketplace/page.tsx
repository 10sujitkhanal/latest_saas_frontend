'use client';

import { useCallback, useEffect, useMemo, useState, use as reactUse } from 'react';
import { businessCurrency } from '@/lib/currency';
import Link from 'next/link';
import { Globe, Sparkles, AlertTriangle, EyeOff } from 'lucide-react';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { MarketplaceService, type ListingRow } from '@/services/marketplace.service';
import { InventoryService, type ItemRow } from '@/services/inventory.service';
import { ImageDropzone } from '@/components/workspace/ImageDropzone';
import {
  PageHeader, AddButton, ErrorBox, Card, TableShell, EmptyRow,
  Modal, Field, TextInput, SelectInput, PrimaryButton, Pill, money, useList, apiError,
} from '@/components/accounting/kit';

const emptyForm = { title: '', category: '', item: '', price: '0', currency: businessCurrency(), image_url: '', description: '' };

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
  // Is the store live? Needed to explain why products aren't visible yet.
  const [storeOpen, setStoreOpen] = useState<boolean | null>(null);
  useEffect(() => { MarketplaceService.getStorefront(wsId).then((r) => { if (r.success) setStoreOpen(Boolean(r.data?.is_open)); }).catch(() => {}); }, [wsId]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ListingRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [heroFile, setHeroFile] = useState<File | null>(null);
  const heroPreview = useMemo(
    () => (heroFile ? URL.createObjectURL(heroFile) : (editing?.hero_image_url || '')),
    [heroFile, editing],
  );
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setHeroFile(null); setFormError(null); setOpen(true); };
  const openEdit = (l: ListingRow) => {
    setEditing(l);
    setForm({ title: l.title, category: l.category || '', item: l.item ? String(l.item) : '', price: String(l.price), currency: l.currency, image_url: l.image_url || '', description: l.description || '' });
    setHeroFile(null); setFormError(null); setOpen(true);
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
      // Upload the hero image after the listing exists (needs its id).
      const listingId = editing ? editing.id : res.data?.id;
      if (heroFile && listingId) {
        const up = await MarketplaceService.uploadHeroImage(wsId, listingId, heroFile);
        if (!up.success) { setFormError(up.message || 'Listing saved, but the image upload failed.'); reload(); return; }
      }
      setOpen(false); setForm(emptyForm); setHeroFile(null); setEditing(null); reload();
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

  const draftCount = rows.filter((l) => l.status === 'draft').length;

  return (
    <div className="space-y-5">
      <PageHeader title="Marketplace Listings" subtitle="Manage and publish product listings, then open your public storefront to take orders." action={<AddButton label="New listing" onClick={openCreate} />} />
      {/* Visibility alerts — tell the owner exactly why customers can't see
          products yet (the recurring "I added it, why isn't it showing?" gap). */}
      {storeOpen === false && rows.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-4 py-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-300" />
          <span className="flex-1 text-[13px] text-amber-100">
            <strong className="font-semibold">Your store isn’t live yet.</strong> Published products stay hidden from customers until you go live.
          </span>
          <Link href={`/w/${wsId}/marketplace/storefront`} className="shrink-0 rounded-lg bg-amber-500/90 px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-amber-400">Go live</Link>
        </div>
      )}
      {draftCount > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <EyeOff className="h-5 w-5 shrink-0 text-slate-400" />
          <span className="flex-1 text-[13px] text-slate-300">
            <strong className="font-semibold text-white">{draftCount} draft {draftCount === 1 ? 'product is' : 'products are'} hidden from customers.</strong> Click <span className="font-semibold text-emerald-300">Publish</span> on {draftCount === 1 ? 'it' : 'each'} below to make {draftCount === 1 ? 'it' : 'them'} visible.
          </span>
        </div>
      )}
      {rows.length === 0 && (
        <Link href={`/w/${wsId}/marketplace/setup`} className="flex items-center gap-3 rounded-xl border border-emerald-400/25 bg-emerald-500/[0.06] px-4 py-3 hover:bg-emerald-500/[0.1] transition-colors">
          <Sparkles className="h-5 w-5 text-emerald-300" />
          <span className="flex-1">
            <span className="block text-sm font-semibold text-white">Set up products or services</span>
            <span className="block text-[11px] text-slate-400">New here? Add your catalog the quick, guided way — pick categories, add items, save as drafts →</span>
          </span>
        </Link>
      )}
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
                <td className="px-3 py-2 text-center">
                  {l.status === 'published'
                    ? <span className="inline-flex items-center rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">Published · visible</span>
                    : l.status === 'draft'
                      ? <span className="inline-flex items-center rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300">Draft · hidden</span>
                      : <span className="inline-flex items-center rounded-md bg-white/[0.06] px-2 py-0.5 text-[11px] font-semibold text-slate-400">{l.status}</span>}
                </td>
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
          {/* Photo first — a picture is what sells the item, so it's the most
              prominent control, not a buried file field. */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-300">Photo</label>
            <ImageDropzone
              previewUrl={heroPreview || null}
              onFile={setHeroFile}
              hint="Add a photo of what you’re selling — drag & drop or click (PNG, JPG, WEBP)"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Link to inventory item (optional)"><SelectInput value={form.item} onChange={(e) => pickItem(e.target.value)}><option value="">— None —</option>{items.map((it) => <option key={it.id} value={it.id}>{it.sku} — {it.name}</option>)}</SelectInput></Field>
            <Field label="Title"><TextInput required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <Field label="Category"><TextInput value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field>
            <Field label="Price"><TextInput type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></Field>
            <Field label="Currency"><TextInput value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></Field>
            <Field label="Or paste an image URL (used only if no photo uploaded)"><TextInput value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} /></Field>
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
