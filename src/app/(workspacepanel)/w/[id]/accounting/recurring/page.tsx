'use client';

import { useCallback, useEffect, useState, use as reactUse } from 'react';
import { businessCurrency } from '@/lib/currency';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { AccountingService, type RecurringRow, type CustomerRow, type VendorRow } from '@/services/accounting.service';
import {
  AccountingTabs, PageHeader, AddButton, ErrorBox, Card, TableShell, EmptyRow,
  Modal, Field, TextInput, SelectInput, PrimaryButton, Pill, money, numberValue, useList, apiError,
} from '@/components/accounting/kit';

const FREQS = ['weekly', 'monthly', 'quarterly', 'yearly'];
const today = () => new Date().toISOString().slice(0, 10);

export default function RecurringPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard service="accounting" required="accounting.view" workspaceId={wsId} skeleton="list">
      <Inner wsId={wsId} />
    </PermissionGuard>
  );
}

function Inner({ wsId }: { wsId: string }) {
  const fetcher = useCallback(() => AccountingService.recurring.list(wsId), [wsId]);
  const { rows, loading, error, reload } = useList<RecurringRow>(fetcher);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  useEffect(() => {
    AccountingService.customers.list(wsId).then((r) => setCustomers((r.data ?? []).filter((c) => c.is_active))).catch(() => {});
    AccountingService.vendors.list(wsId).then((r) => setVendors((r.data ?? []).filter((v) => v.is_active))).catch(() => {});
  }, [wsId]);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ doc_type: 'invoice', customer: '', vendor: '', description: '', amount: '', frequency: 'monthly', next_run_date: today(), currency: businessCurrency() });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const openCreate = () => { setForm({ doc_type: 'invoice', customer: '', vendor: '', description: '', amount: '', frequency: 'monthly', next_run_date: today(), currency: businessCurrency() }); setFormError(null); setOpen(true); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setFormError(null);
    try {
      const payload: Record<string, unknown> = {
        doc_type: form.doc_type, description: form.description, amount: numberValue(form.amount),
        frequency: form.frequency, next_run_date: form.next_run_date, currency: form.currency,
      };
      if (form.doc_type === 'invoice') payload.customer = Number(form.customer);
      else payload.vendor = Number(form.vendor);
      const res = await AccountingService.recurring.create(wsId, payload);
      if (!res.success) { setFormError(res.message || 'Could not create schedule.'); return; }
      setOpen(false); reload();
    } catch (err) { setFormError(apiError(err, 'Could not create schedule.')); }
    finally { setSaving(false); }
  };

  const generate = async (r: RecurringRow) => {
    setBusyId(r.id);
    try { const res = await AccountingService.generateRecurring(wsId, r.id); alert(res.message || (res.success ? 'Generated.' : 'Failed.')); reload(); }
    catch (err) { alert(apiError(err, 'Could not generate.')); }
    finally { setBusyId(null); }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Recurring" subtitle="Schedule invoices/bills to generate automatically." action={<AddButton label="New schedule" onClick={openCreate} />} />
      <AccountingTabs wsId={wsId} />
      {loading ? <PageSkeleton kind="list" /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
        <Card>
          <TableShell head={<tr><th className="px-3 py-2">Type</th><th className="px-3 py-2">Party</th><th className="px-3 py-2">Description</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2">Frequency</th><th className="px-3 py-2">Next run</th><th className="px-3 py-2 text-center">Generated</th><th className="px-3 py-2 text-right">Actions</th></tr>}>
            {rows.map((r) => (
              <tr key={r.id} className="text-slate-300">
                <td className="px-3 py-2 capitalize text-white">{r.doc_type}</td>
                <td className="px-3 py-2">{r.customer_name || r.vendor_name || '—'}</td>
                <td className="px-3 py-2">{r.description}</td>
                <td className="px-3 py-2 text-right">{money(r.amount, r.currency)}</td>
                <td className="px-3 py-2 capitalize">{r.frequency}</td>
                <td className="px-3 py-2">{r.next_run_date}</td>
                <td className="px-3 py-2 text-center">{r.generated_count}</td>
                <td className="px-3 py-2 text-right">
                  {r.is_active
                    ? <button disabled={busyId === r.id} onClick={() => generate(r)} className="text-xs font-semibold text-emerald-300 hover:text-emerald-200 disabled:opacity-50">{busyId === r.id ? 'Generating…' : 'Generate now'}</button>
                    : <Pill>inactive</Pill>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={8} label="No recurring schedules yet." />}
          </TableShell>
        </Card>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="New recurring schedule">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Document type"><SelectInput value={form.doc_type} onChange={(e) => setForm({ ...form, doc_type: e.target.value, customer: '', vendor: '' })}><option value="invoice">Invoice (customer)</option><option value="bill">Bill (vendor)</option></SelectInput></Field>
            {form.doc_type === 'invoice'
              ? <Field label="Customer"><SelectInput required value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })}><option value="">Select…</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</SelectInput></Field>
              : <Field label="Vendor"><SelectInput required value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })}><option value="">Select…</option>{vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</SelectInput></Field>}
            <Field label="Description"><TextInput required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Monthly retainer" /></Field>
            <Field label="Amount"><TextInput type="number" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
            <Field label="Frequency"><SelectInput value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>{FREQS.map((f) => <option key={f} value={f}>{f}</option>)}</SelectInput></Field>
            <Field label="Next run date"><TextInput type="date" required value={form.next_run_date} onChange={(e) => setForm({ ...form, next_run_date: e.target.value })} /></Field>
            <Field label="Currency"><TextInput value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></Field>
          </div>
          {formError && <p className="text-xs text-red-300">{formError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10">Cancel</button>
            <PrimaryButton type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create schedule'}</PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
