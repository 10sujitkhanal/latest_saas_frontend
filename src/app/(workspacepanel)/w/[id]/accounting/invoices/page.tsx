'use client';

import { useCallback, useEffect, useMemo, useState, use as reactUse } from 'react';
import { businessCurrency } from '@/lib/currency';
import Link from 'next/link';
import { Trash2, Plus, Settings } from 'lucide-react';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { AccountingService, type InvoiceRow, type CustomerRow, type InvoiceSettings } from '@/services/accounting.service';
import { InventoryService, type ItemRow } from '@/services/inventory.service';

/** Live preview of the next invoice number from a numbering config. */
function previewNumber(s: { invoice_prefix: string; invoice_number_format: string; invoice_number_pad: number }) {
  const now = new Date();
  const head = (s.invoice_number_format || '{prefix}-{year}-{seq}').split('{seq}')[0]
    .replaceAll('{prefix}', s.invoice_prefix || 'INV')
    .replaceAll('{year}', String(now.getFullYear()))
    .replaceAll('{yy}', String(now.getFullYear() % 100).padStart(2, '0'))
    .replaceAll('{month}', String(now.getMonth() + 1).padStart(2, '0'));
  return head + '1'.padStart(Math.max(1, Math.min(s.invoice_number_pad || 4, 10)), '0');
}
import {
  AccountingTabs, PageHeader, AddButton, ErrorBox, Card, TableShell, EmptyRow,
  Modal, Field, TextInput, SelectInput, PrimaryButton, Pill, money, numberValue, useList, apiError,
} from '@/components/accounting/kit';

type LineDraft = { line_kind: 'service' | 'product'; item: string; description: string; quantity: string; unit_price: string; discount_amount: string; tax_amount: string };
const blankLine = (): LineDraft => ({ line_kind: 'service', item: '', description: '', quantity: '1', unit_price: '', discount_amount: '', tax_amount: '' });
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
  const [items, setItems] = useState<ItemRow[]>([]);
  useEffect(() => { InventoryService.items.list(wsId).then((r) => setItems(r.data ?? [])).catch(() => {}); }, [wsId]);

  const [open, setOpen] = useState(false);
  const [head, setHead] = useState({ invoice_no: '', customer: '', issue_date: today(), due_date: plus(30), currency: businessCurrency(), notes: '' });
  const [lines, setLines] = useState<LineDraft[]>([blankLine()]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  // Invoice numbering + branding settings
  const [setOpen2, setSetOpen2] = useState(false);
  const [settings, setSettings] = useState<InvoiceSettings | null>(null);
  const [savingSet, setSavingSet] = useState(false);
  const [settingsErr, setSettingsErr] = useState<string | null>(null);
  const openSettings = async () => {
    setSetOpen2(true);
    setSettingsErr(null);
    if (!settings) {
      try {
        const r = await AccountingService.invoiceSettings.get(wsId);
        if (r.success && r.data) setSettings(r.data);
        else setSettingsErr(r.message || 'Could not load invoice settings.');
      } catch (err) {
        setSettingsErr(apiError(err, 'Could not load invoice settings. If this persists, the latest update may still be deploying.'));
      }
    }
  };
  const saveSettings = async () => {
    if (!settings) return;
    setSavingSet(true);
    try {
      const r = await AccountingService.invoiceSettings.save(wsId, settings);
      if (r.success && r.data) { setSettings(r.data); setSetOpen2(false); }
      else alert(r.message || 'Could not save settings.');
    } catch (err) { alert(apiError(err, 'Could not save settings.')); }
    finally { setSavingSet(false); }
  };

  const act = async (id: number, fn: () => Promise<{ success: boolean; message?: string }>) => {
    setBusyId(id);
    try { const res = await fn(); if (!res.success) alert(res.message || 'Action failed.'); reload(); }
    catch (err) { alert(apiError(err, 'Action failed.')); }
    finally { setBusyId(null); }
  };

  const total = useMemo(() => lines.reduce((s, l) => s + (numberValue(l.quantity) * numberValue(l.unit_price) - numberValue(l.discount_amount) + numberValue(l.tax_amount)), 0), [lines]);

  const openModal = () => { setHead({ invoice_no: '', customer: '', issue_date: today(), due_date: plus(30), currency: businessCurrency(), notes: '' }); setLines([blankLine()]); setFormError(null); setOpen(true); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setFormError(null);
    try {
      const payloadLines = lines.filter((l) => l.description && numberValue(l.unit_price) >= 0).map((l) => ({
        line_kind: l.line_kind,
        item: l.line_kind === 'product' && l.item ? Number(l.item) : null,
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
      <PageHeader title="Invoices" subtitle="Amounts customers owe you. Totals are computed from line items." action={
        <div className="flex items-center gap-2">
          <button type="button" onClick={openSettings} title="Numbering & branding"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-slate-200 hover:border-emerald-500/40 hover:text-emerald-300">
            <Settings className="h-4 w-4" /> Settings
          </button>
          <AddButton label="New invoice" onClick={openModal} />
        </div>
      } />
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
              <thead className="bg-white/[0.03] uppercase tracking-wide text-slate-500"><tr><th className="px-2 py-2">Type</th><th className="px-2 py-2">Description / Item</th><th className="px-2 py-2 text-right">Qty</th><th className="px-2 py-2 text-right">Price</th><th className="px-2 py-2 text-right">Disc.</th><th className="px-2 py-2 text-right">Tax</th><th className="px-2 py-2"></th></tr></thead>
              <tbody className="divide-y divide-white/5">
                {lines.map((l, i) => (
                  <tr key={i}>
                    <td className="px-2 py-1.5">
                      <SelectInput value={l.line_kind} onChange={(e) => { const kind = e.target.value as 'service' | 'product'; setLines(lines.map((x, j) => j === i ? { ...x, line_kind: kind, ...(kind === 'service' ? { item: '' } : {}) } : x)); }}>
                        <option value="service">Service</option>
                        <option value="product">Product</option>
                      </SelectInput>
                    </td>
                    <td className="px-2 py-1.5">
                      {l.line_kind === 'product' ? (
                        <SelectInput value={l.item} onChange={(e) => { const it = items.find((x) => String(x.id) === e.target.value); setLines(lines.map((x, j) => j === i ? { ...x, item: e.target.value, description: it ? it.name : x.description, unit_price: it ? String(it.selling_price) : x.unit_price } : x)); }}>
                          <option value="">Select item…</option>
                          {items.map((it) => <option key={it.id} value={it.id}>{it.name} ({it.sku}) · {it.qty_on_hand} in stock</option>)}
                        </SelectInput>
                      ) : (
                        <TextInput value={l.description} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} />
                      )}
                    </td>
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

      <Modal open={setOpen2} onClose={() => setSetOpen2(false)} title="Invoice numbering & branding">
        {settingsErr ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-rose-500/20 bg-rose-500/[0.06] px-3 py-3 text-sm text-rose-200">{settingsErr}</div>
            <div className="flex justify-end"><button type="button" onClick={openSettings} className="rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-white/[0.03]">Retry</button></div>
          </div>
        ) : !settings ? <div className="py-6 text-center text-sm text-slate-400">Loading…</div> : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Prefix">
                <TextInput value={settings.invoice_prefix} onChange={(e) => setSettings({ ...settings, invoice_prefix: e.target.value })} placeholder="INV" />
              </Field>
              <Field label="Number padding">
                <TextInput type="number" value={String(settings.invoice_number_pad)} onChange={(e) => setSettings({ ...settings, invoice_number_pad: Math.max(1, Math.min(Number(e.target.value) || 4, 10)) })} />
              </Field>
            </div>
            <Field label="Format">
              <TextInput value={settings.invoice_number_format} onChange={(e) => setSettings({ ...settings, invoice_number_format: e.target.value })} placeholder="{prefix}-{year}-{seq}" />
            </Field>
            <p className="text-[11px] text-slate-500">
              Tokens: <code className="text-slate-300">{'{prefix}'}</code> <code className="text-slate-300">{'{year}'}</code> <code className="text-slate-300">{'{yy}'}</code> <code className="text-slate-300">{'{month}'}</code> <code className="text-slate-300">{'{seq}'}</code> (the running number). Must include <code className="text-slate-300">{'{seq}'}</code>.
            </p>
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2 text-sm">
              Next invoice will be: <span className="font-mono font-semibold text-emerald-300">{previewNumber(settings)}</span>
            </div>
            <Field label="Template">
              <SelectInput value={settings.invoice_template} onChange={(e) => setSettings({ ...settings, invoice_template: e.target.value })}>
                <option value="classic">Classic</option>
                <option value="modern">Modern</option>
              </SelectInput>
            </Field>
            <Field label="Invoice footer (terms / thank-you note)">
              <textarea value={settings.invoice_footer} onChange={(e) => setSettings({ ...settings, invoice_footer: e.target.value })} rows={3}
                className="w-full resize-none rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-emerald-500/40"
                placeholder="e.g. Payment due within 30 days. Thank you for your business." />
            </Field>
            <p className="text-[11px] text-slate-500">Numbering changes apply to the next invoice; existing numbers are unchanged. The logo on the PDF comes from your business branding (or the agency’s, for agency-issued documents).</p>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setSetOpen2(false)} className="rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-white/[0.03]">Cancel</button>
              <PrimaryButton onClick={saveSettings} disabled={savingSet}>{savingSet ? 'Saving…' : 'Save settings'}</PrimaryButton>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
