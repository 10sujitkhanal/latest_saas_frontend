'use client';

import { useCallback, useEffect, useState, use as reactUse } from 'react';
import { businessCurrency } from '@/lib/currency';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { AccountingService, type PaymentRow, type CustomerRow, type VendorRow, type InvoiceRow, type BillRow } from '@/services/accounting.service';
import {
  AccountingTabs, PageHeader, AddButton, ErrorBox, Card, TableShell, EmptyRow,
  Modal, Field, TextInput, SelectInput, PrimaryButton, Pill, money, numberValue, useList, apiError,
} from '@/components/accounting/kit';

const today = () => new Date().toISOString().slice(0, 10);

export default function PaymentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard service="accounting" required="accounting.view" workspaceId={wsId} skeleton="list">
      <Inner wsId={wsId} />
    </PermissionGuard>
  );
}

function Inner({ wsId }: { wsId: string }) {
  const fetcher = useCallback(() => AccountingService.payments.list(wsId), [wsId]);
  const { rows, loading, error, reload } = useList<PaymentRow>(fetcher);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [bills, setBills] = useState<BillRow[]>([]);
  useEffect(() => {
    AccountingService.customers.list(wsId).then((r) => setCustomers((r.data ?? []).filter((c) => c.is_active))).catch(() => {});
    AccountingService.vendors.list(wsId).then((r) => setVendors((r.data ?? []).filter((v) => v.is_active))).catch(() => {});
    AccountingService.invoices.list(wsId).then((r) => setInvoices((r.data ?? []).filter((i) => !['paid', 'void', 'cancelled'].includes(i.status)))).catch(() => {});
    AccountingService.bills.list(wsId).then((r) => setBills((r.data ?? []).filter((b) => !['paid', 'void'].includes(b.status)))).catch(() => {});
  }, [wsId]);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ payment_no: '', type: 'received', customer: '', vendor: '', invoice: '', bill: '', date: today(), amount: '', currency: businessCurrency(), method: 'Bank Transfer', reference: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openModal = () => { setForm({ payment_no: '', type: 'received', customer: '', vendor: '', invoice: '', bill: '', date: today(), amount: '', currency: businessCurrency(), method: 'Bank Transfer', reference: '' }); setFormError(null); setOpen(true); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setFormError(null);
    try {
      const payload: Record<string, unknown> = {
        payment_no: form.payment_no, type: form.type, date: form.date,
        amount: numberValue(form.amount), currency: form.currency, method: form.method, reference: form.reference,
      };
      if (form.type === 'received') {
        payload.customer = Number(form.customer);
        if (form.invoice) payload.invoice = Number(form.invoice);
      } else {
        payload.vendor = Number(form.vendor);
        if (form.bill) payload.bill = Number(form.bill);
      }
      const res = await AccountingService.payments.create(wsId, payload);
      if (!res.success) { setFormError(res.message || 'Could not record payment.'); return; }
      setOpen(false); reload();
    } catch (err) { setFormError(apiError(err, 'Could not record payment.')); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Payments" subtitle="Money received from customers and paid to vendors." action={<AddButton label="Record payment" onClick={openModal} />} />
      <AccountingTabs wsId={wsId} />
      {loading ? <PageSkeleton kind="list" /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
        <Card>
          <TableShell head={<tr><th className="px-3 py-2">No.</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Party</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Method</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2 text-center">Status</th></tr>}>
            {rows.map((p) => (
              <tr key={p.id} className="text-slate-300">
                <td className="px-3 py-2 font-mono text-white">{p.payment_no}</td>
                <td className="px-3 py-2 capitalize">{p.type}</td>
                <td className="px-3 py-2">{p.customer_name || p.vendor_name || '—'}</td>
                <td className="px-3 py-2">{p.date}</td>
                <td className="px-3 py-2">{p.method}</td>
                <td className="px-3 py-2 text-right">{money(p.amount, p.currency)}</td>
                <td className="px-3 py-2 text-center"><Pill>{p.status}</Pill></td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={7} label="No payments yet." />}
          </TableShell>
        </Card>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Record payment">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Payment no. (auto)"><TextInput value={form.payment_no} onChange={(e) => setForm({ ...form, payment_no: e.target.value })} placeholder="Auto-generated — leave blank" /></Field>
            <Field label="Type"><SelectInput value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, customer: '', vendor: '', invoice: '', bill: '' })}><option value="received">Received (from customer)</option><option value="made">Made (to vendor)</option></SelectInput></Field>
            {form.type === 'received' ? (
              <Field label="Customer"><SelectInput required value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value, invoice: '' })}><option value="">Select…</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</SelectInput></Field>
            ) : (
              <Field label="Vendor"><SelectInput required value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value, bill: '' })}><option value="">Select…</option>{vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</SelectInput></Field>
            )}
            {form.type === 'received' ? (
              <Field label="Apply to invoice (optional)"><SelectInput value={form.invoice} onChange={(e) => setForm({ ...form, invoice: e.target.value })}><option value="">— None —</option>{invoices.filter((i) => !form.customer || String(i.customer) === form.customer).map((i) => <option key={i.id} value={i.id}>{i.invoice_no} (due {i.amount_due})</option>)}</SelectInput></Field>
            ) : (
              <Field label="Apply to bill (optional)"><SelectInput value={form.bill} onChange={(e) => setForm({ ...form, bill: e.target.value })}><option value="">— None —</option>{bills.filter((b) => !form.vendor || String(b.vendor) === form.vendor).map((b) => <option key={b.id} value={b.id}>{b.bill_no} (due {b.amount_due})</option>)}</SelectInput></Field>
            )}
            <Field label="Date"><TextInput type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            <Field label="Amount"><TextInput type="number" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
            <Field label="Currency"><TextInput value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></Field>
            <Field label="Method"><TextInput value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} /></Field>
            <Field label="Reference"><TextInput value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></Field>
          </div>
          {formError && <p className="text-xs text-red-300">{formError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10">Cancel</button>
            <PrimaryButton type="submit" disabled={saving}>{saving ? 'Saving…' : 'Record payment'}</PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
