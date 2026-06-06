'use client';

import { useCallback, useEffect, useState, use as reactUse } from 'react';
import { businessCurrency } from '@/lib/currency';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { AccountingService, type DebitNoteRow, type VendorRow, type BillRow } from '@/services/accounting.service';
import {
  AccountingTabs, PageHeader, AddButton, ErrorBox, Card, TableShell, EmptyRow,
  Modal, Field, TextInput, SelectInput, PrimaryButton, Pill, money, numberValue, useList, apiError,
} from '@/components/accounting/kit';

const today = () => new Date().toISOString().slice(0, 10);

export default function DebitNotesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard service="accounting" required="accounting.view" workspaceId={wsId} skeleton="list">
      <Inner wsId={wsId} />
    </PermissionGuard>
  );
}

function Inner({ wsId }: { wsId: string }) {
  const fetcher = useCallback(() => AccountingService.debitNotes.list(wsId), [wsId]);
  const { rows, loading, error, reload } = useList<DebitNoteRow>(fetcher);
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [bills, setBills] = useState<BillRow[]>([]);
  useEffect(() => {
    AccountingService.vendors.list(wsId).then((r) => setVendors((r.data ?? []).filter((v) => v.is_active))).catch(() => {});
    AccountingService.bills.list(wsId).then((r) => setBills(r.data ?? [])).catch(() => {});
  }, [wsId]);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ vendor: '', bill: '', issue_date: today(), amount: '', reason: '', currency: businessCurrency() });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const openCreate = () => { setForm({ vendor: '', bill: '', issue_date: today(), amount: '', reason: '', currency: businessCurrency() }); setFormError(null); setOpen(true); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setFormError(null);
    try {
      const payload: Record<string, unknown> = {
        vendor: Number(form.vendor), issue_date: form.issue_date,
        amount: numberValue(form.amount), reason: form.reason, currency: form.currency,
      };
      if (form.bill) payload.bill = Number(form.bill);
      const res = await AccountingService.debitNotes.create(wsId, payload);
      if (!res.success) { setFormError(res.message || 'Could not create debit note.'); return; }
      setOpen(false); reload();
    } catch (err) { setFormError(apiError(err, 'Could not create debit note.')); }
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
      <PageHeader title="Debit Notes" subtitle="Debits raised against vendors (returns, adjustments)." action={<AddButton label="New debit note" onClick={openCreate} />} />
      <AccountingTabs wsId={wsId} />
      {loading ? <PageSkeleton kind="list" /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
        <Card>
          <TableShell head={<tr><th className="px-3 py-2">No.</th><th className="px-3 py-2">Vendor</th><th className="px-3 py-2">Bill</th><th className="px-3 py-2">Date</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2 text-center">Status</th><th className="px-3 py-2 text-right">Actions</th></tr>}>
            {rows.map((d) => (
              <tr key={d.id} className="text-slate-300">
                <td className="px-3 py-2 font-mono text-white">{d.note_no}</td>
                <td className="px-3 py-2">{d.vendor_name}</td>
                <td className="px-3 py-2 font-mono">{d.bill_no || '—'}</td>
                <td className="px-3 py-2">{d.issue_date}</td>
                <td className="px-3 py-2 text-right">{money(d.amount, d.currency)}</td>
                <td className="px-3 py-2 text-center"><Pill>{d.status}</Pill></td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {d.status === 'draft' && <button disabled={busyId === d.id} onClick={() => act(d.id, () => AccountingService.issueDebitNote(wsId, d.id))} className="text-xs font-semibold text-cyan-300 hover:text-cyan-200 disabled:opacity-50">Issue</button>}
                  {d.status !== 'voided' && <button disabled={busyId === d.id} onClick={() => act(d.id, () => AccountingService.voidDebitNote(wsId, d.id))} className="ml-3 text-xs font-medium text-red-300 hover:text-red-200 disabled:opacity-50">Void</button>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={7} label="No debit notes yet." />}
          </TableShell>
        </Card>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="New debit note">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Vendor"><SelectInput required value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value, bill: '' })}><option value="">Select…</option>{vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</SelectInput></Field>
            <Field label="Against bill (optional)"><SelectInput value={form.bill} onChange={(e) => setForm({ ...form, bill: e.target.value })}><option value="">— None —</option>{bills.filter((b) => !form.vendor || String(b.vendor) === form.vendor).map((b) => <option key={b.id} value={b.id}>{b.bill_no}</option>)}</SelectInput></Field>
            <Field label="Issue date"><TextInput type="date" required value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} /></Field>
            <Field label="Amount"><TextInput type="number" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
            <Field label="Reason"><TextInput value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Damaged goods" /></Field>
            <Field label="Currency"><TextInput value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></Field>
          </div>
          {vendors.length === 0 && <p className="text-xs text-amber-300">No vendors yet — create one on the Vendors tab first.</p>}
          {formError && <p className="text-xs text-red-300">{formError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10">Cancel</button>
            <PrimaryButton type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create debit note'}</PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
