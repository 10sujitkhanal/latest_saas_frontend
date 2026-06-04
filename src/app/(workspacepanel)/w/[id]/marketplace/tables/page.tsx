'use client';

import { useCallback, useState, use as reactUse } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { MarketplaceService, type RestaurantTableRow } from '@/services/marketplace.service';
import { PageHeader, AddButton, Card, ErrorBox, TableShell, EmptyRow, Modal, Field, TextInput, PrimaryButton, Pill, useList, apiError } from '@/components/accounting/kit';

function MarketplaceTabs({ wsId }: { wsId: string }) {
  const pathname = usePathname();
  const base = `/w/${wsId}/marketplace`;
  const tabs = [{ label: 'Listings', seg: '' }, { label: 'Storefront setup', seg: 'storefront' }, { label: 'Bookings', seg: 'bookings' }, { label: 'Tables', seg: 'tables' }];
  return (
    <nav className="flex flex-wrap gap-1 rounded-xl border border-white/5 bg-white/[0.02] p-1">
      {tabs.map((t) => {
        const href = t.seg ? `${base}/${t.seg}` : base;
        const active = t.seg ? pathname.startsWith(href) : pathname === base;
        return <Link key={t.label} href={href} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${active ? 'bg-pink-600 text-white' : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-200'}`}>{t.label}</Link>;
      })}
    </nav>
  );
}

export default function TablesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard service="marketplace" required="marketplace.view" workspaceId={wsId} skeleton="list">
      <Inner wsId={wsId} />
    </PermissionGuard>
  );
}

function Inner({ wsId }: { wsId: string }) {
  const fetcher = useCallback(() => MarketplaceService.tables.list(wsId), [wsId]);
  const { rows, loading, error, reload } = useList<RestaurantTableRow>(fetcher);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RestaurantTableRow | null>(null);
  const [form, setForm] = useState({ name: '', capacity: '2', section: '', notes: '', is_active: true });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openCreate = () => { setEditing(null); setForm({ name: '', capacity: '2', section: '', notes: '', is_active: true }); setFormError(null); setOpen(true); };
  const openEdit = (t: RestaurantTableRow) => { setEditing(t); setForm({ name: t.name, capacity: String(t.capacity), section: t.section || '', notes: t.notes || '', is_active: t.is_active }); setFormError(null); setOpen(true); };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault(); setSaving(true); setFormError(null);
    try {
      const payload = { ...form, capacity: Number(form.capacity) };
      const res = editing ? await MarketplaceService.tables.update(wsId, editing.id, payload) : await MarketplaceService.tables.create(wsId, payload);
      if (!res.success) { setFormError(res.message || 'Could not save.'); return; }
      setOpen(false); reload();
    } catch (e) { setFormError(apiError(e, 'Could not save.')); }
    finally { setSaving(false); }
  };

  const remove = async (t: RestaurantTableRow) => {
    if (!confirm(`Remove table "${t.name}"?`)) return;
    try { await MarketplaceService.tables.remove(wsId, t.id); reload(); } catch (e) { alert(apiError(e, 'Could not remove.')); }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Tables" subtitle="Your floor plan — reservations arrive under Bookings." action={<AddButton label="Add table" onClick={openCreate} />} />
      <MarketplaceTabs wsId={wsId} />
      {loading ? <PageSkeleton kind="list" /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
        <Card>
          <TableShell head={<tr><th className="px-3 py-2">Table</th><th className="px-3 py-2">Section</th><th className="px-3 py-2 text-center">Seats</th><th className="px-3 py-2 text-center">Status</th><th className="px-3 py-2 text-right">Actions</th></tr>}>
            {rows.map((t) => (
              <tr key={t.id} className="text-slate-300">
                <td className="px-3 py-2 font-medium text-white">{t.name}</td>
                <td className="px-3 py-2">{t.section || '—'}</td>
                <td className="px-3 py-2 text-center">{t.capacity}</td>
                <td className="px-3 py-2 text-center"><Pill>{t.is_active ? 'active' : 'inactive'}</Pill></td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button onClick={() => openEdit(t)} className="text-xs font-medium text-cyan-300 hover:text-cyan-200">Edit</button>
                  <button onClick={() => remove(t)} className="ml-3 text-xs font-medium text-red-300 hover:text-red-200">Delete</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={5} label="No tables yet." />}
          </TableShell>
        </Card>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit table' : 'Add table'}>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name / number"><TextInput required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="T1" /></Field>
            <Field label="Capacity"><TextInput type="number" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></Field>
            <Field label="Section"><TextInput value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} placeholder="Indoor / Patio / Bar" /></Field>
          </div>
          <Field label="Notes"><TextInput value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="h-4 w-4 accent-pink-500" /> Active</label>
          {formError && <p className="text-xs text-red-300">{formError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10">Cancel</button>
            <PrimaryButton type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save' : 'Add'}</PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
