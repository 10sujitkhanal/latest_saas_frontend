'use client';

import { useCallback, useEffect, useState, use as reactUse } from 'react';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { AccountingService, type CreditNoteRow, type CustomerRow, type InvoiceRow } from '@/services/accounting.service';
import {
  AccountingTabs, PageHeader, AddButton, ErrorBox, Card, TableShell, EmptyRow,
  Modal, Field, TextInput, SelectInput, PrimaryButton, Pill, money, numberValue, useList, apiError,
} from '@/components/accounting/kit';

const today = () => new Date().toISOString().slice(0, 10);

export default function CreditNotesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard service="accounting" required="accounting.view" workspaceId={wsId} skeleton="list">
      <Inner wsId={wsId} />
    </PermissionGuard>
  );
}

function Inner({ wsId }: { wsId: string }) {
  const fetcher = useCallback(() => AccountingService.creditNotes.list(wsId), [wsId]);
  const { rows, loading, error, reload } = useList<CreditNoteRow>(fetcher);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  useEffect(() => {
    AccountingService.customers.list(wsId).then((r) => setCustomers((r.data ?? []).filter((c) => c.is_active))).catch(() => {});
    AccountingService.invoices.list(wsId).then((r) => setInvoices(r.data ?? [])).catch(() => {});
  }, [wsId]);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ customer: '', invoice: '', issue_date: today(), amount: '', reason: '', currency: 'NPR' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const openCreate = () => { setForm({ customer: '', invoice: '', issue_date: today(), amount: '', reason: '', currency: 'NPR' }); setFormError(null); setOpen(true); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setFormError(null);
    try {
      const payload: Record<string, unknown> = {
        customer: Number(form.customer), issue_date: form.issue_date,
        amount: numberValue(form.amount), reason: form.reason, currency: form.currency,
      };
      if (form.invoice) payload.invoice = Number(form.invoice);
      const res = await AccountingService.creditNotes.create(wsId, payload);
      if (!res.success) { setFormError(res.message || 'Could not create credit note.'); return; }
      setOpen(false); reload();
    } catch (err) { setFormError(apiError(err, 'Could not create credit note.')); }
    finally { setSaving(false); }
  };

  const act = async (id: number, fn: () => Promise<{ success: boolean; message?: string }>) => {
    setBusyId(id);
    try { const res = await fn(); if (!res.success) alert(res.message || 'Action failed.'); reload(); }
    catch (err) { alert(apiError(err, 'Action failed.')); }
    finally { setBusyId(null); }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Credit Notes" subtitle="Credits issued to customers (returns, adjustments)." action={<AddButton label="New credit note" onClick={openCreate} />} />
      <AccountingTabs wsId={wsId} />
      {loading ? <PageSkeleton kind="list" /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
        <Card>
          <TableShell head={<tr><th className="px-3 py-2">No.</th><th className="px-3 py-2">Customer</th><th className="px-3 py-2">Invoice</th><th className="px-3 py-2">Date</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2 text-center">Status</th><th className="px-3 py-2 text-right">Actions</th></tr>}>
            {rows.map((c) => (
              <tr key={c.id} className="text-slate-300">
                <td className="px-3 py-2 font-mono text-white">{c.note_no}</td>
                <td className="px-3 py-2">{c.customer_name}</td>
                <td className="px-3 py-2 font-mono">{c.invoice_no || '—'}</td>
                <td className="px-3 py-2">{c.issue_date}</td>
                <td className="px-3 py-2 text-right">{money(c.amount, c.currency)}</td>
                <td className="px-3 py-2 text-center"><Pill>{c.status}</Pill></td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {c.status === 'draft' && <button disabled={busyId === c.id} onClick={() => act(c.id, () => AccountingService.issueCreditNote(wsId, c.id))} className="text-xs font-semibold text-cyan-300 hover:text-cyan-200 disabled:opacity-50">Issue</button>}
                  {c.status !== 'voided' && <button disabled={busyId === c.id} onClick={() => act(c.id, () => AccountingService.voidCreditNote(wsId, c.id))} className="ml-3 text-xs font-medium text-red-300 hover:text-red-200 disabled:opacity-50">Void</button>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={7} label="No credit notes yet." />}
          </TableShell>
        </Card>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="New credit note">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Customer"><SelectInput required value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value, invoice: '' })}><option value="">Select…</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</SelectInput></Field>
            <Field label="Against invoice (optional)"><SelectInput value={form.invoice} onChange={(e) => setForm({ ...form, invoice: e.target.value })}><option value="">— None —</option>{invoices.filter((i) => !form.customer || String(i.customer) === form.customer).map((i) => <option key={i.id} value={i.id}>{i.invoice_no}</option>)}</SelectInput></Field>
            <Field label="Issue date"><TextInput type="date" required value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} /></Field>
            <Field label="Amount"><TextInput type="number" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
            <Field label="Reason"><TextInput value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Returned goods" /></Field>
            <Field label="Currency"><TextInput value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></Field>
          </div>
          {customers.length === 0 && <p className="text-xs text-amber-300">No customers yet — create one on the Customers tab first.</p>}
          {formError && <p className="text-xs text-red-300">{formError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10">Cancel</button>
            <PrimaryButton type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create credit note'}</PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
