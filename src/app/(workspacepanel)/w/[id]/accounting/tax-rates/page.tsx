'use client';

import { useCallback, useState, use as reactUse } from 'react';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { AccountingService, type TaxRateRow } from '@/services/accounting.service';
import {
  AccountingTabs, PageHeader, AddButton, ErrorBox, Card, TableShell, EmptyRow,
  Modal, Field, TextInput, SelectInput, PrimaryButton, Pill, useList, apiError,
} from '@/components/accounting/kit';

const TYPES = ['vat', 'gst', 'sales', 'withholding', 'other'];
const emptyForm = { name: '', rate: '', tax_type: 'vat', is_default: false, description: '' };

export default function TaxRatesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard service="accounting" required="accounting.view" workspaceId={wsId} skeleton="list">
      <Inner wsId={wsId} />
    </PermissionGuard>
  );
}

function Inner({ wsId }: { wsId: string }) {
  const fetcher = useCallback(() => AccountingService.taxRates.list(wsId), [wsId]);
  const { rows, loading, error, reload } = useList<TaxRateRow>(fetcher);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TaxRateRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setFormError(null); setOpen(true); };
  const openEdit = (t: TaxRateRow) => {
    setEditing(t);
    setForm({ name: t.name, rate: String(t.rate), tax_type: t.tax_type, is_default: t.is_default, description: t.description || '' });
    setFormError(null); setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setFormError(null);
    try {
      const payload = { ...form, rate: form.rate };
      const res = editing
        ? await AccountingService.taxRates.update(wsId, editing.id, payload)
        : await AccountingService.taxRates.create(wsId, payload);
      if (!res.success) { setFormError(res.message || 'Could not save tax rate.'); return; }
      setOpen(false); setForm(emptyForm); setEditing(null); reload();
    } catch (err) { setFormError(apiError(err, 'Could not save tax rate.')); }
    finally { setSaving(false); }
  };

  const remove = async (t: TaxRateRow) => {
    if (!confirm(`Delete tax rate ${t.name}?`)) return;
    try { await AccountingService.taxRates.remove(wsId, t.id); reload(); }
    catch (err) { alert(apiError(err, 'Could not delete tax rate.')); }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Tax Rates" subtitle="Reusable VAT/GST/sales-tax rates for invoices and bills." action={<AddButton label="New tax rate" onClick={openCreate} />} />
      <AccountingTabs wsId={wsId} />
      {loading ? <PageSkeleton kind="list" /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
        <Card>
          <TableShell head={<tr><th className="px-3 py-2">Name</th><th className="px-3 py-2">Type</th><th className="px-3 py-2 text-right">Rate</th><th className="px-3 py-2 text-center">Default</th><th className="px-3 py-2 text-center">Status</th><th className="px-3 py-2 text-right">Actions</th></tr>}>
            {rows.map((t) => (
              <tr key={t.id} className="text-slate-300">
                <td className="px-3 py-2 font-medium text-white">{t.name}</td>
                <td className="px-3 py-2 uppercase">{t.tax_type}</td>
                <td className="px-3 py-2 text-right">{t.rate}%</td>
                <td className="px-3 py-2 text-center">{t.is_default ? <Pill>default</Pill> : <span className="text-slate-600">—</span>}</td>
                <td className="px-3 py-2 text-center"><Pill>{t.is_active ? 'active' : 'inactive'}</Pill></td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button onClick={() => openEdit(t)} className="text-xs font-medium text-cyan-300 hover:text-cyan-200">Edit</button>
                  <button onClick={() => remove(t)} className="ml-3 text-xs font-medium text-red-300 hover:text-red-200">Delete</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={6} label="No tax rates yet. Add one (e.g. VAT 13%)." />}
          </TableShell>
        </Card>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit tax rate' : 'New tax rate'}>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name"><TextInput required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="VAT 13%" /></Field>
            <Field label="Rate (%)"><TextInput type="number" step="0.01" required value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} placeholder="13" /></Field>
            <Field label="Type"><SelectInput value={form.tax_type} onChange={(e) => setForm({ ...form, tax_type: e.target.value })}>{TYPES.map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}</SelectInput></Field>
            <Field label="Description"><TextInput value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} className="h-4 w-4 rounded border-white/20 bg-black/20" />
            Set as default tax rate
          </label>
          {formError && <p className="text-xs text-red-300">{formError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10">Cancel</button>
            <PrimaryButton type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create tax rate'}</PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
