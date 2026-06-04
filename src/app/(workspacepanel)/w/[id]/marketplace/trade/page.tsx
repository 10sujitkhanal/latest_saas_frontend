'use client';

import { useCallback, useState, use as reactUse } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { MarketplaceService, type TradeAccountRow } from '@/services/marketplace.service';
import { PageHeader, AddButton, Card, ErrorBox, TableShell, EmptyRow, Modal, Field, TextInput, PrimaryButton, Pill, useList, apiError } from '@/components/accounting/kit';

function MarketplaceTabs({ wsId }: { wsId: string }) {
  const pathname = usePathname();
  const base = `/w/${wsId}/marketplace`;
  const tabs = [{ label: 'Listings', seg: '' }, { label: 'Storefront setup', seg: 'storefront' }, { label: 'Bookings', seg: 'bookings' }, { label: 'Tables', seg: 'tables' }, { label: 'Events', seg: 'events' }, { label: 'Trade accounts', seg: 'trade' }];
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

const empty = { business_name: '', contact_name: '', contact_email: '', contact_phone: '', discount_percent: '0', payment_terms_days: '0', notes: '' };

export default function TradeAccountsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard service="marketplace" required="marketplace.view" workspaceId={wsId} skeleton="list">
      <Inner wsId={wsId} />
    </PermissionGuard>
  );
}

function Inner({ wsId }: { wsId: string }) {
  const fetcher = useCallback(() => MarketplaceService.tradeAccounts.list(wsId), [wsId]);
  const { rows, loading, error, reload } = useList<TradeAccountRow>(fetcher);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TradeAccountRow | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const openCreate = () => { setEditing(null); setForm(empty); setFormError(null); setOpen(true); };
  const openEdit = (a: TradeAccountRow) => { setEditing(a); setForm({ business_name: a.business_name, contact_name: a.contact_name || '', contact_email: a.contact_email || '', contact_phone: a.contact_phone || '', discount_percent: String(a.discount_percent), payment_terms_days: String(a.payment_terms_days), notes: a.notes || '' }); setFormError(null); setOpen(true); };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault(); setSaving(true); setFormError(null);
    try {
      const payload = { ...form, discount_percent: form.discount_percent, payment_terms_days: Number(form.payment_terms_days) };
      const res = editing ? await MarketplaceService.tradeAccounts.update(wsId, editing.id, payload) : await MarketplaceService.tradeAccounts.create(wsId, payload);
      if (!res.success) { setFormError(res.message || 'Could not save.'); return; }
      setOpen(false); reload();
    } catch (e) { setFormError(apiError(e, 'Could not save.')); }
    finally { setSaving(false); }
  };

  const setStatus = async (a: TradeAccountRow, status: string) => {
    setBusyId(a.id);
    try { const r = await MarketplaceService.tradeAccounts.update(wsId, a.id, { status }); if (!r.success) alert(r.message || 'Failed.'); reload(); }
    catch (e) { alert(apiError(e, 'Failed.')); }
    finally { setBusyId(null); }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Trade accounts" subtitle="Wholesale buyers — account pricing + net terms. Approve applications here." action={<AddButton label="New account" onClick={openCreate} />} />
      <MarketplaceTabs wsId={wsId} />
      {loading ? <PageSkeleton kind="list" /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
        <Card>
          <TableShell head={<tr><th className="px-3 py-2">Account</th><th className="px-3 py-2">Business</th><th className="px-3 py-2 text-right">Discount</th><th className="px-3 py-2 text-center">Terms</th><th className="px-3 py-2 text-center">Status</th><th className="px-3 py-2 text-right">Actions</th></tr>}>
            {rows.map((a) => (
              <tr key={a.id} className="text-slate-300">
                <td className="px-3 py-2 text-slate-400">{a.account_no}</td>
                <td className="px-3 py-2 font-medium text-white">{a.business_name}<div className="text-[10px] text-slate-500">{a.contact_email || a.contact_name}</div></td>
                <td className="px-3 py-2 text-right">{a.discount_percent}%</td>
                <td className="px-3 py-2 text-center">{a.payment_terms_days > 0 ? `net ${a.payment_terms_days}` : 'pay now'}</td>
                <td className="px-3 py-2 text-center"><Pill>{a.status}</Pill></td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {a.status !== 'active' && <button disabled={busyId === a.id} onClick={() => setStatus(a, 'active')} className="text-xs font-semibold text-emerald-300 hover:text-emerald-200 disabled:opacity-50">Approve</button>}
                  {a.status === 'active' && <button disabled={busyId === a.id} onClick={() => setStatus(a, 'suspended')} className="text-xs font-medium text-amber-300 hover:text-amber-200 disabled:opacity-50">Suspend</button>}
                  <button onClick={() => openEdit(a)} className="ml-3 text-xs font-medium text-cyan-300 hover:text-cyan-200">Edit</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={6} label="No trade accounts yet." />}
          </TableShell>
        </Card>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? `Edit ${editing.account_no}` : 'New trade account'}>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Business name"><TextInput required value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Contact name"><TextInput value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} /></Field>
            <Field label="Contact email"><TextInput value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></Field>
            <Field label="Default discount %"><TextInput type="number" step="0.01" value={form.discount_percent} onChange={(e) => setForm({ ...form, discount_percent: e.target.value })} /></Field>
            <Field label="Payment terms (net days, 0 = pay now)"><TextInput type="number" value={form.payment_terms_days} onChange={(e) => setForm({ ...form, payment_terms_days: e.target.value })} /></Field>
          </div>
          <Field label="Notes"><TextInput value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
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
