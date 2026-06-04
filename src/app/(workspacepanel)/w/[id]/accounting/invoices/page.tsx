'use client';

import { useCallback, useEffect, useMemo, useState, use as reactUse } from 'react';
import Link from 'next/link';
import { Trash2, Plus } from 'lucide-react';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { AccountingService, type InvoiceRow, type CustomerRow } from '@/services/accounting.service';
import {
  AccountingTabs, PageHeader, AddButton, ErrorBox, Card, TableShell, EmptyRow,
  Modal, Field, TextInput, SelectInput, PrimaryButton, Pill, money, numberValue, useList, apiError,
} from '@/components/accounting/kit';

type LineDraft = { description: string; quantity: string; unit_price: string; discount_amount: string; tax_amount: string };
const blankLine = (): LineDraft => ({ description: '', quantity: '1', unit_price: '', discount_amount: '', tax_amount: '' });
const today = () => new Date().toISOString().slice(0, 10);
const plus = (d: number) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);

export default function InvoicesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard service="accounting" required="accounting.view" workspaceId={wsId} skeleton="list">
      <Inner wsId={wsId} />
    </PermissionGuard>
  );
}

function Inner({ wsId }: { wsId: string }) {
  const fetcher = useCallback(() => AccountingService.invoices.list(wsId), [wsId]);
  const { rows, loading, error, reload } = useList<InvoiceRow>(fetcher);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  useEffect(() => { AccountingService.customers.list(wsId).then((r) => setCustomers((r.data ?? []).filter((c) => c.is_active))).catch(() => {}); }, [wsId]);

  const [open, setOpen] = useState(false);
  const [head, setHead] = useState({ invoice_no: '', customer: '', issue_date: today(), due_date: plus(30), currency: 'NPR', notes: '' });
  const [lines, setLines] = useState<LineDraft[]>([blankLine()]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const act = async (id: number, fn: () => Promise<{ success: boolean; message?: string }>) => {
    setBusyId(id);
    try { const res = await fn(); if (!res.success) alert(res.message || 'Action failed.'); reload(); }
    catch (err) { alert(apiError(err, 'Action failed.')); }
    finally { setBusyId(null); }
  };

  const total = useMemo(() => lines.reduce((s, l) => s + (numberValue(l.quantity) * numberValue(l.unit_price) - numberValue(l.discount_amount) + numberValue(l.tax_amount)), 0), [lines]);

  const openModal = () => { setHead({ invoice_no: '', customer: '', issue_date: today(), due_date: plus(30), currency: 'NPR', notes: '' }); setLines([blankLine()]); setFormError(null); setOpen(true); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setFormError(null);
    try {
      const payloadLines = lines.filter((l) => l.description && numberValue(l.unit_price) >= 0).map((l) => ({
        description: l.description, quantity: numberValue(l.quantity) || 1, unit_price: numberValue(l.unit_price),
        discount_amount: numberValue(l.discount_amount), tax_amount: numberValue(l.tax_amount),
      }));
      const res = await AccountingService.invoices.create(wsId, { ...head, customer: Number(head.customer), lines: payloadLines });
      if (!res.success) { setFormError(res.message || 'Could not create invoice.'); return; }
      setOpen(false); reload();
    } catch (err) { setFormError(apiError(err, 'Could not create invoice.')); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Invoices" subtitle="Amounts customers owe you. Totals are computed from line items." action={<AddButton label="New invoice" onClick={openModal} />} />
      <AccountingTabs wsId={wsId} />
      {loading ? <PageSkeleton kind="list" /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
        <Card>
          <TableShell head={<tr><th className="px-3 py-2">No.</th><th className="px-3 py-2">Customer</th><th className="px-3 py-2">Issued</th><th className="px-3 py-2">Due</th><th className="px-3 py-2 text-right">Total</th><th className="px-3 py-2 text-right">Due</th><th className="px-3 py-2 text-center">Status</th><th className="px-3 py-2 text-right">Actions</th></tr>}>
            {rows.map((inv) => (
              <tr key={inv.id} className="text-slate-300">
                <td className="px-3 py-2 font-mono"><Link href={`/w/${wsId}/accounting/invoices/${inv.id}`} className="text-cyan-300 hover:text-cyan-200 hover:underline">{inv.invoice_no}</Link></td>
                <td className="px-3 py-2">{inv.customer_name}</td>
                <td className="px-3 py-2">{inv.issue_date}</td>
                <td className="px-3 py-2">{inv.due_date}</td>
                <td className="px-3 py-2 text-right">{money(inv.total, inv.currency)}</td>
                <td className="px-3 py-2 text-right">{money(inv.amount_due, inv.currency)}</td>
                <td className="px-3 py-2 text-center"><Pill>{inv.status}</Pill></td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {inv.status === 'draft' && <button disabled={busyId === inv.id} onClick={() => act(inv.id, () => AccountingService.sendInvoice(wsId, inv.id))} className="text-xs font-semibold text-cyan-300 hover:text-cyan-200 disabled:opacity-50">Send</button>}
                  {['overdue', 'sent', 'partial'].includes(inv.status) && Number(inv.amount_due) > 0 && <button disabled={busyId === inv.id} onClick={() => act(inv.id, () => AccountingService.remindInvoice(wsId, inv.id))} className="ml-3 text-xs font-semibold text-amber-300 hover:text-amber-200 disabled:opacity-50">Remind</button>}
                  {!['paid', 'void', 'cancelled'].includes(inv.status) && <button disabled={busyId === inv.id} onClick={() => act(inv.id, () => AccountingService.voidInvoice(wsId, inv.id))} className="ml-3 text-xs font-medium text-red-300 hover:text-red-200 disabled:opacity-50">Void</button>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={8} label="No invoices yet." />}
          </TableShell>
        </Card>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="New invoice">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Invoice no. (auto)"><TextInput value={head.invoice_no} onChange={(e) => setHead({ ...head, invoice_no: e.target.value })} placeholder="Auto-generated — leave blank" /></Field>
            <Field label="Customer">
              <SelectInput required value={head.customer} onChange={(e) => setHead({ ...head, customer: e.target.value })}>
                <option value="">Select…</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </SelectInput>
            </Field>
            <Field label="Issue date"><TextInput type="date" required value={head.issue_date} onChange={(e) => setHead({ ...head, issue_date: e.target.value })} /></Field>
            <Field label="Due date"><TextInput type="date" required value={head.due_date} onChange={(e) => setHead({ ...head, due_date: e.target.value })} /></Field>
          </div>
          {customers.length === 0 && <p className="text-xs text-amber-300">No customers yet — create one on the Customers tab first.</p>}

          <div className="rounded-xl border border-white/10">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/[0.03] uppercase tracking-wide text-slate-500"><tr><th className="px-2 py-2">Description</th><th className="px-2 py-2 text-right">Qty</th><th className="px-2 py-2 text-right">Price</th><th className="px-2 py-2 text-right">Disc.</th><th className="px-2 py-2 text-right">Tax</th><th className="px-2 py-2"></th></tr></thead>
              <tbody className="divide-y divide-white/5">
                {lines.map((l, i) => (
                  <tr key={i}>
                    <td className="px-2 py-1.5"><TextInput value={l.description} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} /></td>
                    <td className="px-2 py-1.5"><TextInput type="number" step="0.01" value={l.quantity} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, quantity: e.target.value } : x))} /></td>
                    <td className="px-2 py-1.5"><TextInput type="number" step="0.01" value={l.unit_price} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, unit_price: e.target.value } : x))} /></td>
                    <td className="px-2 py-1.5"><TextInput type="number" step="0.01" value={l.discount_amount} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, discount_amount: e.target.value } : x))} /></td>
                    <td className="px-2 py-1.5"><TextInput type="number" step="0.01" value={l.tax_amount} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, tax_amount: e.target.value } : x))} /></td>
                    <td className="px-2 py-1.5 text-center">{lines.length > 1 && <button type="button" onClick={() => setLines(lines.filter((_, j) => j !== i))} className="text-slate-500 hover:text-red-300"><Trash2 className="h-3.5 w-3.5" /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between border-t border-white/10 px-3 py-2">
              <button type="button" onClick={() => setLines([...lines, blankLine()])} className="inline-flex items-center gap-1 text-xs font-medium text-emerald-300 hover:text-emerald-200"><Plus className="h-3.5 w-3.5" /> Add line</button>
              <div className="text-xs"><span className="text-slate-400">Total </span><span className="font-semibold text-white">{money(total, head.currency)}</span></div>
            </div>
          </div>

          {formError && <p className="text-xs text-red-300">{formError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10">Cancel</button>
            <PrimaryButton type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create invoice'}</PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
