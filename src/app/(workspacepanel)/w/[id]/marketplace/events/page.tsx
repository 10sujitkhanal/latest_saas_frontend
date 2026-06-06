'use client';

import { useCallback, useState, use as reactUse } from 'react';
import { businessCurrency } from '@/lib/currency';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { MarketplaceService, type StorefrontEventRow } from '@/services/marketplace.service';
import { PageHeader, AddButton, Card, ErrorBox, TableShell, EmptyRow, Modal, Field, TextInput, PrimaryButton, Pill, money, useList, apiError } from '@/components/accounting/kit';

function MarketplaceTabs({ wsId }: { wsId: string }) {
  const pathname = usePathname();
  const base = `/w/${wsId}/marketplace`;
  const tabs = [{ label: 'Listings', seg: '' }, { label: 'Storefront setup', seg: 'storefront' }, { label: 'Bookings', seg: 'bookings' }, { label: 'Tables', seg: 'tables' }, { label: 'Events', seg: 'events' }];
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

const empty = { title: '', description: '', venue: '', starts_at: '', capacity: '0', price: '0', currency: businessCurrency(), status: 'published' };

export default function EventsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard service="marketplace" required="marketplace.view" workspaceId={wsId} skeleton="list">
      <Inner wsId={wsId} />
    </PermissionGuard>
  );
}

function Inner({ wsId }: { wsId: string }) {
  const fetcher = useCallback(() => MarketplaceService.events.list(wsId), [wsId]);
  const { rows, loading, error, reload } = useList<StorefrontEventRow>(fetcher);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StorefrontEventRow | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openCreate = () => { setEditing(null); setForm(empty); setFormError(null); setOpen(true); };
  const openEdit = (e: StorefrontEventRow) => {
    setEditing(e);
    setForm({ title: e.title, description: e.description || '', venue: e.venue || '', starts_at: (e.starts_at || '').slice(0, 16), capacity: String(e.capacity), price: String(e.price), currency: e.currency, status: e.status });
    setFormError(null); setOpen(true);
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault(); setSaving(true); setFormError(null);
    try {
      const payload = { ...form, capacity: Number(form.capacity) };
      const res = editing ? await MarketplaceService.events.update(wsId, editing.id, payload) : await MarketplaceService.events.create(wsId, payload);
      if (!res.success) { setFormError(res.message || 'Could not save.'); return; }
      setOpen(false); reload();
    } catch (e) { setFormError(apiError(e, 'Could not save.')); }
    finally { setSaving(false); }
  };

  const remove = async (e: StorefrontEventRow) => {
    if (!confirm(`Delete event "${e.title}"?`)) return;
    try { await MarketplaceService.events.remove(wsId, e.id); reload(); } catch (err) { alert(apiError(err, 'Could not delete.')); }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Events" subtitle="Ticketed or free events — RSVPs post to your books." action={<AddButton label="New event" onClick={openCreate} />} />
      <MarketplaceTabs wsId={wsId} />
      {loading ? <PageSkeleton kind="list" /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
        <Card>
          <TableShell head={<tr><th className="px-3 py-2">Event</th><th className="px-3 py-2">When</th><th className="px-3 py-2">Venue</th><th className="px-3 py-2 text-right">Price</th><th className="px-3 py-2 text-center">Sold</th><th className="px-3 py-2 text-center">Status</th><th className="px-3 py-2 text-right">Actions</th></tr>}>
            {rows.map((e) => (
              <tr key={e.id} className="text-slate-300">
                <td className="px-3 py-2 font-medium text-white">{e.title}</td>
                <td className="px-3 py-2">{(e.starts_at || '').replace('T', ' ').slice(0, 16)}</td>
                <td className="px-3 py-2">{e.venue || '—'}</td>
                <td className="px-3 py-2 text-right">{parseFloat(e.price) > 0 ? money(e.price, e.currency) : 'Free'}</td>
                <td className="px-3 py-2 text-center">{e.tickets_sold}{e.capacity ? `/${e.capacity}` : ''}</td>
                <td className="px-3 py-2 text-center"><Pill>{e.status}</Pill></td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button onClick={() => openEdit(e)} className="text-xs font-medium text-cyan-300 hover:text-cyan-200">Edit</button>
                  <button onClick={() => remove(e)} className="ml-3 text-xs font-medium text-red-300 hover:text-red-200">Delete</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={7} label="No events yet." />}
          </TableShell>
        </Card>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit event' : 'New event'}>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Title"><TextInput required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Starts at"><TextInput type="datetime-local" required value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></Field>
            <Field label="Venue"><TextInput value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} /></Field>
            <Field label="Ticket price (0 = free)"><TextInput type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></Field>
            <Field label="Capacity (0 = unlimited)"><TextInput type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></Field>
          </div>
          <Field label="Description"><TextInput value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <Field label="Status">
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full rounded-lg border border-white/10 bg-[#0a1020] px-3 py-2 text-sm text-white">
              <option value="draft">Draft</option><option value="published">Published</option><option value="cancelled">Cancelled</option>
            </select>
          </Field>
          {formError && <p className="text-xs text-red-300">{formError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10">Cancel</button>
            <PrimaryButton type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save' : 'Create'}</PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
