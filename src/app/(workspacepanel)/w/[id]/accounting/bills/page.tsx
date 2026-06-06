'use client';

import { useCallback, useEffect, useMemo, useState, use as reactUse } from 'react';
import { businessCurrency } from '@/lib/currency';
import { Trash2, Plus } from 'lucide-react';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { AccountingService, type BillRow, type VendorRow } from '@/services/accounting.service';
import {
  AccountingTabs, PageHeader, AddButton, ErrorBox, Card, TableShell, EmptyRow,
  Modal, Field, TextInput, SelectInput, PrimaryButton, Pill, money, numberValue, useList, apiError,
} from '@/components/accounting/kit';

type LineDraft = { description: string; quantity: string; unit_price: string; discount_amount: string; tax_amount: string };
const blankLine = (): LineDraft => ({ description: '', quantity: '1', unit_price: '', discount_amount: '', tax_amount: '' });
const today = () => new Date().toISOString().slice(0, 10);
const plus = (d: number) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);

export default function BillsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard service="accounting" required="accounting.view" workspaceId={wsId} skeleton="list">
      <Inner wsId={wsId} />
    </PermissionGuard>
  );
}

function Inner({ wsId }: { wsId: string }) {
  const fetcher = useCallback(() => AccountingService.bills.list(wsId), [wsId]);
  const { rows, loading, error, reload } = useList<BillRow>(fetcher);
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  useEffect(() => { AccountingService.vendors.list(wsId).then((r) => setVendors((r.data ?? []).filter((v) => v.is_active))).catch(() => {}); }, [wsId]);

  const [open, setOpen] = useState(false);
  const [head, setHead] = useState({ bill_no: '', vendor: '', vendor_reference: '', bill_date: today(), due_date: plus(30), currency: businessCurrency() });
  const [lines, setLines] = useState<LineDraft[]>([blankLine()]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const voidBill = async (id: number) => {
    setBusyId(id);
    try { const res = await AccountingService.voidBill(wsId, id); if (!res.success) alert(res.message || 'Could not void bill.'); reload(); }
    catch (err) { alert(apiError(err, 'Could not void bill.')); }
    finally { setBusyId(null); }
  };

  const total = useMemo(() => lines.reduce((s, l) => s + (numberValue(l.quantity) * numberValue(l.unit_price) - numberValue(l.discount_amount) + numberValue(l.tax_amount)), 0), [lines]);

  const openModal = () => { setHead({ bill_no: '', vendor: '', vendor_reference: '', bill_date: today(), due_date: plus(30), currency: businessCurrency() }); setLines([blankLine()]); setFormError(null); setOpen(true); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setFormError(null);
    try {
      const payloadLines = lines.filter((l) => l.description && numberValue(l.unit_price) >= 0).map((l) => ({
        description: l.description, quantity: numberValue(l.quantity) || 1, unit_price: numberValue(l.unit_price),
        discount_amount: numberValue(l.discount_amount), tax_amount: numberValue(l.tax_amount),
      }));
      const res = await AccountingService.bills.create(wsId, { ...head, vendor: Number(head.vendor), lines: payloadLines });
      if (!res.success) { setFormError(res.message || 'Could not create bill.'); return; }
      setOpen(false); reload();
    } catch (err) { setFormError(apiError(err, 'Could not create bill.')); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Bills" subtitle="Amounts you owe vendors. Totals are computed from line items." action={<AddButton label="New bill" onClick={openModal} />} />
      <AccountingTabs wsId={wsId} />
      {loading ? <PageSkeleton kind="list" /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
        <Card>
          <TableShell head={<tr><th className="px-3 py-2">No.</th><th className="px-3 py-2">Vendor</th><th className="px-3 py-2">Billed</th><th className="px-3 py-2">Due</th><th className="px-3 py-2 text-right">Total</th><th className="px-3 py-2 text-right">Due</th><th className="px-3 py-2 text-center">Status</th><th className="px-3 py-2 text-right">Actions</th></tr>}>
            {rows.map((b) => (
              <tr key={b.id} className="text-slate-300">
                <td className="px-3 py-2 font-mono text-white">{b.bill_no}</td>
                <td className="px-3 py-2">{b.vendor_name}</td>
                <td className="px-3 py-2">{b.bill_date}</td>
                <td className="px-3 py-2">{b.due_date}</td>
                <td className="px-3 py-2 text-right">{money(b.total, b.currency)}</td>
                <td className="px-3 py-2 text-right">{money(b.amount_due, b.currency)}</td>
                <td className="px-3 py-2 text-center"><Pill>{b.status}</Pill></td>
                <td className="px-3 py-2 text-right">
                  {!['paid', 'void'].includes(b.status) && <button disabled={busyId === b.id} onClick={() => voidBill(b.id)} className="text-xs font-medium text-red-300 hover:text-red-200 disabled:opacity-50">Void</button>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={8} label="No bills yet." />}
          </TableShell>
        </Card>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="New bill">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Bill no. (auto)"><TextInput value={head.bill_no} onChange={(e) => setHead({ ...head, bill_no: e.target.value })} placeholder="Auto-generated — leave blank" /></Field>
            <Field label="Vendor">
              <SelectInput required value={head.vendor} onChange={(e) => setHead({ ...head, vendor: e.target.value })}>
                <option value="">Select…</option>
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </SelectInput>
            </Field>
            <Field label="Bill date"><TextInput type="date" required value={head.bill_date} onChange={(e) => setHead({ ...head, bill_date: e.target.value })} /></Field>
            <Field label="Due date"><TextInput type="date" required value={head.due_date} onChange={(e) => setHead({ ...head, due_date: e.target.value })} /></Field>
          </div>
          {vendors.length === 0 && <p className="text-xs text-amber-300">No vendors yet — create one on the Vendors tab first.</p>}

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
            <PrimaryButton type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create bill'}</PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
