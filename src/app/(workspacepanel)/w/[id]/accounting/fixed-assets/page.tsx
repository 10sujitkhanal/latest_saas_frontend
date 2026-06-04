'use client';

import { useCallback, useState, use as reactUse } from 'react';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { AccountingService, type FixedAssetRow } from '@/services/accounting.service';
import {
  AccountingTabs, PageHeader, AddButton, ErrorBox, Card, TableShell, EmptyRow,
  Modal, Field, TextInput, PrimaryButton, Pill, money, useList, apiError,
} from '@/components/accounting/kit';

const today = () => new Date().toISOString().slice(0, 10);
const emptyForm = { name: '', category: '', purchase_date: today(), purchase_cost: '', salvage_value: '0', useful_life_years: '5', currency: 'NPR' };

export default function FixedAssetsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard service="accounting" required="accounting.view" workspaceId={wsId} skeleton="list">
      <Inner wsId={wsId} />
    </PermissionGuard>
  );
}

function Inner({ wsId }: { wsId: string }) {
  const fetcher = useCallback(() => AccountingService.fixedAssets.list(wsId), [wsId]);
  const { rows, loading, error, reload } = useList<FixedAssetRow>(fetcher);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setFormError(null);
    try {
      const res = await AccountingService.fixedAssets.create(wsId, form);
      if (!res.success) { setFormError(res.message || 'Could not create asset.'); return; }
      setOpen(false); setForm(emptyForm); reload();
    } catch (err) { setFormError(apiError(err, 'Could not create asset.')); }
    finally { setSaving(false); }
  };

  const depreciate = async (a: FixedAssetRow) => {
    setBusyId(a.id);
    try { const res = await AccountingService.depreciateAsset(wsId, a.id, 1); if (!res.success) alert(res.message || 'Could not depreciate.'); reload(); }
    catch (err) { alert(apiError(err, 'Could not depreciate.')); }
    finally { setBusyId(null); }
  };

  const dispose = async (a: FixedAssetRow) => {
    const amt = prompt(`Dispose "${a.name}". Disposal amount received?`, '0');
    if (amt === null) return;
    setBusyId(a.id);
    try { const res = await AccountingService.disposeAsset(wsId, a.id, { disposal_amount: amt, disposal_date: today() }); if (!res.success) alert(res.message || 'Could not dispose.'); reload(); }
    catch (err) { alert(apiError(err, 'Could not dispose.')); }
    finally { setBusyId(null); }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Fixed Assets" subtitle="Asset register with straight-line depreciation." action={<AddButton label="New asset" onClick={() => { setForm(emptyForm); setFormError(null); setOpen(true); }} />} />
      <AccountingTabs wsId={wsId} />
      {loading ? <PageSkeleton kind="list" /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
        <Card>
          <TableShell head={<tr><th className="px-3 py-2">Asset</th><th className="px-3 py-2">Category</th><th className="px-3 py-2 text-right">Cost</th><th className="px-3 py-2 text-right">Accum. Depr.</th><th className="px-3 py-2 text-right">Book Value</th><th className="px-3 py-2 text-right">Monthly</th><th className="px-3 py-2 text-center">Status</th><th className="px-3 py-2 text-right">Actions</th></tr>}>
            {rows.map((a) => (
              <tr key={a.id} className="text-slate-300">
                <td className="px-3 py-2 font-medium text-white">{a.name}</td>
                <td className="px-3 py-2">{a.category || '—'}</td>
                <td className="px-3 py-2 text-right">{money(a.purchase_cost, a.currency)}</td>
                <td className="px-3 py-2 text-right">{money(a.accumulated_depreciation, a.currency)}</td>
                <td className="px-3 py-2 text-right font-semibold text-white">{money(a.book_value, a.currency)}</td>
                <td className="px-3 py-2 text-right">{money(a.monthly_depreciation, a.currency)}</td>
                <td className="px-3 py-2 text-center"><Pill>{a.status.replace('_', ' ')}</Pill></td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {a.status === 'active' && <button disabled={busyId === a.id} onClick={() => depreciate(a)} className="text-xs font-semibold text-cyan-300 hover:text-cyan-200 disabled:opacity-50">Depreciate</button>}
                  {a.status !== 'disposed' && <button disabled={busyId === a.id} onClick={() => dispose(a)} className="ml-3 text-xs font-medium text-red-300 hover:text-red-200 disabled:opacity-50">Dispose</button>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={8} label="No fixed assets yet." />}
          </TableShell>
        </Card>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="New fixed asset">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name"><TextInput required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Delivery Van" /></Field>
            <Field label="Category"><TextInput value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Vehicles" /></Field>
            <Field label="Purchase date"><TextInput type="date" required value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} /></Field>
            <Field label="Purchase cost"><TextInput type="number" step="0.01" required value={form.purchase_cost} onChange={(e) => setForm({ ...form, purchase_cost: e.target.value })} /></Field>
            <Field label="Salvage value"><TextInput type="number" step="0.01" value={form.salvage_value} onChange={(e) => setForm({ ...form, salvage_value: e.target.value })} /></Field>
            <Field label="Useful life (years)"><TextInput type="number" step="0.5" required value={form.useful_life_years} onChange={(e) => setForm({ ...form, useful_life_years: e.target.value })} /></Field>
            <Field label="Currency"><TextInput value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></Field>
          </div>
          {formError && <p className="text-xs text-red-300">{formError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10">Cancel</button>
            <PrimaryButton type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create asset'}</PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
