'use client';

import { useCallback, useState, use as reactUse } from 'react';
import { businessCurrency } from '@/lib/currency';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { LoyaltyService, type MembershipPlanRow } from '@/services/loyalty.service';
import {
  PageHeader, AddButton, ErrorBox, Card, TableShell, EmptyRow,
  Modal, Field, TextInput, SelectInput, PrimaryButton, Pill, money, useList, apiError, LoyaltyTabs,
} from '@/components/loyalty/kit';

const empty = { name: '', price: '0', currency: businessCurrency(), interval: 'monthly', benefits: '', description: '', is_active: true, is_public: false };

export default function MembershipPlansPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard service="loyalty" required="loyalty.view" workspaceId={wsId} skeleton="list">
      <Inner wsId={wsId} />
    </PermissionGuard>
  );
}

function Inner({ wsId }: { wsId: string }) {
  const fetcher = useCallback(() => LoyaltyService.plans.list(wsId), [wsId]);
  const { rows, loading, error, reload } = useList<MembershipPlanRow>(fetcher);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MembershipPlanRow | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openCreate = () => { setEditing(null); setForm(empty); setFormError(null); setOpen(true); };
  const openEdit = (p: MembershipPlanRow) => { setEditing(p); setForm({ name: p.name, price: String(p.price), currency: p.currency, interval: p.interval, benefits: p.benefits || '', description: p.description || '', is_active: p.is_active, is_public: Boolean(p.is_public) }); setFormError(null); setOpen(true); };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault(); setSaving(true); setFormError(null);
    try {
      const res = editing ? await LoyaltyService.plans.update(wsId, editing.id, form) : await LoyaltyService.plans.create(wsId, form);
      if (!res.success) { setFormError(res.message || 'Could not save.'); return; }
      setOpen(false); reload();
    } catch (err) { setFormError(apiError(err, 'Could not save.')); }
    finally { setSaving(false); }
  };

  const remove = async (p: MembershipPlanRow) => {
    if (!confirm(`Delete plan "${p.name}"?`)) return;
    try { await LoyaltyService.plans.remove(wsId, p.id); reload(); } catch (err) { alert(apiError(err, 'Could not delete.')); }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Membership Plans" subtitle="Tiers customers can subscribe to." action={<AddButton label="New plan" onClick={openCreate} />} />
      <LoyaltyTabs wsId={wsId} />
      {loading ? <PageSkeleton kind="list" /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
        <Card>
          <TableShell head={<tr><th className="px-3 py-2">Name</th><th className="px-3 py-2">Interval</th><th className="px-3 py-2 text-right">Price</th><th className="px-3 py-2 text-center">Status</th><th className="px-3 py-2 text-right">Actions</th></tr>}>
            {rows.map((p) => (
              <tr key={p.id} className="text-slate-300">
                <td className="px-3 py-2 font-medium text-white">{p.name}</td>
                <td className="px-3 py-2">{p.interval.replace('_', ' ')}</td>
                <td className="px-3 py-2 text-right">{money(p.price, p.currency)}</td>
                <td className="px-3 py-2 text-center"><Pill>{p.is_active ? 'active' : 'inactive'}</Pill>{p.is_public && <span className="ml-1 text-[10px] text-pink-300">public</span>}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button onClick={() => openEdit(p)} className="text-xs font-medium text-cyan-300 hover:text-cyan-200">Edit</button>
                  <button onClick={() => remove(p)} className="ml-3 text-xs font-medium text-red-300 hover:text-red-200">Delete</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={5} label="No plans yet." />}
          </TableShell>
        </Card>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit plan' : 'New plan'}>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name"><TextInput required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Interval"><SelectInput value={form.interval} onChange={(e) => setForm({ ...form, interval: e.target.value })}><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option><option value="one_time">One-time</option></SelectInput></Field>
            <Field label="Price"><TextInput type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></Field>
            <Field label="Currency"><TextInput value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></Field>
          </div>
          <Field label="Benefits"><TextInput value={form.benefits} onChange={(e) => setForm({ ...form, benefits: e.target.value })} /></Field>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="h-4 w-4 accent-pink-500" /> Active</label>
            <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={form.is_public} onChange={(e) => setForm({ ...form, is_public: e.target.checked })} className="h-4 w-4 accent-pink-500" /> Sell on storefront (public)</label>
          </div>
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
