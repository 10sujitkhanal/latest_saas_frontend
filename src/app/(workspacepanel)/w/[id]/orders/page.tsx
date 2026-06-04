'use client';

import { useCallback, useEffect, useMemo, useState, use as reactUse } from 'react';
import { Trash2, Plus } from 'lucide-react';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { OrdersService, type OrderRow } from '@/services/orders.service';
import { AccountingService, type CustomerRow } from '@/services/accounting.service';
import { InventoryService, type ItemRow } from '@/services/inventory.service';
import {
  PageHeader, AddButton, ErrorBox, Card, TableShell, EmptyRow,
  Modal, Field, TextInput, SelectInput, PrimaryButton, Pill, money, numberValue, useList, apiError,
} from '@/components/accounting/kit';

type LineDraft = { item: string; description: string; qty: string; unit_price: string };
const blankLine = (): LineDraft => ({ item: '', description: '', qty: '1', unit_price: '' });
const today = () => new Date().toISOString().slice(0, 10);

export default function OrdersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard service="orders" required="orders.view" workspaceId={wsId} skeleton="list">
      <Inner wsId={wsId} />
    </PermissionGuard>
  );
}

function Inner({ wsId }: { wsId: string }) {
  const fetcher = useCallback(() => OrdersService.list(wsId), [wsId]);
  const { rows, loading, error, reload } = useList<OrderRow>(fetcher);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  useEffect(() => {
    AccountingService.customers.list(wsId).then((r) => setCustomers((r.data ?? []).filter((c) => c.is_active))).catch(() => {});
    InventoryService.items.list(wsId).then((r) => setItems((r.data ?? []).filter((i) => i.is_active))).catch(() => {});
  }, [wsId]);

  const [open, setOpen] = useState(false);
  const [head, setHead] = useState({ customer: '', customer_name: '', order_date: today(), currency: 'NPR', notes: '' });
  const [lines, setLines] = useState<LineDraft[]>([blankLine()]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const total = useMemo(() => lines.reduce((s, l) => s + numberValue(l.qty) * numberValue(l.unit_price), 0), [lines]);

  const openCreate = () => { setHead({ customer: '', customer_name: '', order_date: today(), currency: 'NPR', notes: '' }); setLines([blankLine()]); setFormError(null); setOpen(true); };

  // when an item is picked, prefill description + price from the item
  const pickItem = (idx: number, itemId: string) => {
    const it = items.find((x) => String(x.id) === itemId);
    setLines(lines.map((l, j) => j === idx ? { ...l, item: itemId, description: it ? it.name : l.description, unit_price: it ? String(it.selling_price) : l.unit_price } : l));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setFormError(null);
    try {
      const payloadLines = lines.filter((l) => l.description && numberValue(l.qty) > 0).map((l) => ({
        item: l.item ? Number(l.item) : null, description: l.description,
        qty: numberValue(l.qty), unit_price: numberValue(l.unit_price),
      }));
      const res = await OrdersService.create(wsId, { ...head, customer: head.customer ? Number(head.customer) : null, lines: payloadLines });
      if (!res.success) { setFormError(res.message || 'Could not create order.'); return; }
      setOpen(false); reload();
    } catch (err) { setFormError(apiError(err, 'Could not create order.')); }
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
      <PageHeader title="Sales Orders" subtitle="Capture orders, confirm, and fulfil (fulfilment draws down inventory stock)." action={<AddButton label="New order" onClick={openCreate} />} />
      {loading ? <PageSkeleton kind="list" /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
        <Card>
          <TableShell head={<tr><th className="px-3 py-2">No.</th><th className="px-3 py-2">Customer</th><th className="px-3 py-2">Date</th><th className="px-3 py-2 text-right">Total</th><th className="px-3 py-2 text-center">Status</th><th className="px-3 py-2 text-right">Actions</th></tr>}>
            {rows.map((o) => (
              <tr key={o.id} className="text-slate-300">
                <td className="px-3 py-2 font-mono text-white">{o.order_no}</td>
                <td className="px-3 py-2">{o.customer_label || o.customer_name || '—'}</td>
                <td className="px-3 py-2">{o.order_date}</td>
                <td className="px-3 py-2 text-right">{money(o.total, o.currency)}</td>
                <td className="px-3 py-2 text-center"><Pill>{o.status}</Pill></td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {o.status === 'draft' && <button disabled={busyId === o.id} onClick={() => act(o.id, () => OrdersService.confirm(wsId, o.id))} className="text-xs font-semibold text-cyan-300 hover:text-cyan-200 disabled:opacity-50">Confirm</button>}
                  {(o.status === 'draft' || o.status === 'confirmed') && <button disabled={busyId === o.id} onClick={() => act(o.id, () => OrdersService.fulfill(wsId, o.id))} className="ml-3 text-xs font-semibold text-emerald-300 hover:text-emerald-200 disabled:opacity-50">Fulfil</button>}
                  {o.status !== 'fulfilled' && o.status !== 'cancelled' && <button disabled={busyId === o.id} onClick={() => act(o.id, () => OrdersService.cancel(wsId, o.id))} className="ml-3 text-xs font-medium text-red-300 hover:text-red-200 disabled:opacity-50">Cancel</button>}
                  {o.status !== 'cancelled' && (o.invoice_no
                    ? <span className="ml-3 font-mono text-[11px] text-emerald-300/70">{o.invoice_no}</span>
                    : o.customer && <button disabled={busyId === o.id} onClick={() => act(o.id, () => OrdersService.createInvoice(wsId, o.id))} className="ml-3 text-xs font-medium text-violet-300 hover:text-violet-200 disabled:opacity-50">Invoice</button>)}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={6} label="No orders yet." />}
          </TableShell>
        </Card>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New sales order">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Customer"><SelectInput value={head.customer} onChange={(e) => setHead({ ...head, customer: e.target.value })}><option value="">— Walk-in / none —</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</SelectInput></Field>
            <Field label="Customer name (if no account)"><TextInput value={head.customer_name} onChange={(e) => setHead({ ...head, customer_name: e.target.value })} placeholder="Optional" /></Field>
            <Field label="Order date"><TextInput type="date" required value={head.order_date} onChange={(e) => setHead({ ...head, order_date: e.target.value })} /></Field>
            <Field label="Currency"><TextInput value={head.currency} onChange={(e) => setHead({ ...head, currency: e.target.value })} /></Field>
          </div>

          <div className="rounded-xl border border-white/10">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/[0.03] uppercase tracking-wide text-slate-500"><tr><th className="px-2 py-2">Item</th><th className="px-2 py-2">Description</th><th className="px-2 py-2 text-right">Qty</th><th className="px-2 py-2 text-right">Price</th><th className="px-2 py-2"></th></tr></thead>
              <tbody className="divide-y divide-white/5">
                {lines.map((l, i) => (
                  <tr key={i}>
                    <td className="px-2 py-1.5"><SelectInput value={l.item} onChange={(e) => pickItem(i, e.target.value)}><option value="">— Free text —</option>{items.map((it) => <option key={it.id} value={it.id}>{it.sku} — {it.name}</option>)}</SelectInput></td>
                    <td className="px-2 py-1.5"><TextInput value={l.description} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} /></td>
                    <td className="px-2 py-1.5"><TextInput type="number" step="0.01" value={l.qty} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, qty: e.target.value } : x))} /></td>
                    <td className="px-2 py-1.5"><TextInput type="number" step="0.01" value={l.unit_price} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, unit_price: e.target.value } : x))} /></td>
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
            <PrimaryButton type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create order'}</PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
