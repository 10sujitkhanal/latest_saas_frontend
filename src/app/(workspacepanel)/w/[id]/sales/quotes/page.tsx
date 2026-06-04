'use client';

import { useCallback, useMemo, useState, use as reactUse } from 'react';
import Link from 'next/link';
import { Trash2, Plus, FileSignature } from 'lucide-react';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { SalesService, type QuoteRow, type QuoteStatus } from '@/services/sales.service';
import {
  PageHeader, AddButton, ErrorBox, Card, TableShell, EmptyRow,
  Modal, Field, TextInput, SelectInput, PrimaryButton, Pill, money, numberValue, useList, apiError,
} from '@/components/accounting/kit';

type LineDraft = { description: string; quantity: string; unit_price: string; discount_amount: string; tax_amount: string };
const blankLine = (): LineDraft => ({ description: '', quantity: '1', unit_price: '', discount_amount: '', tax_amount: '' });
const today = () => new Date().toISOString().slice(0, 10);
const plus = (d: number) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);

export default function QuotesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard service="sales" required="quotes.view" workspaceId={wsId} skeleton="list">
      <Inner wsId={wsId} />
    </PermissionGuard>
  );
}

function Inner({ wsId }: { wsId: string }) {
  const fetcher = useCallback(() => SalesService.list(wsId), [wsId]);
  const { rows, loading, error, reload } = useList<QuoteRow>(fetcher);

  const [open, setOpen] = useState(false);
  const [head, setHead] = useState({ customer_name: '', customer_email: '', issue_date: today(), valid_until: plus(30), currency: 'NPR', system_description: '', terms: '', notes: '' });
  const [lines, setLines] = useState<LineDraft[]>([blankLine()]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const act = async (id: number, fn: () => Promise<{ success: boolean; message?: string }>) => {
    setBusyId(id);
    try { const res = await fn(); if (!res.success) alert(res.message || 'Action failed.'); else if (res.message) alert(res.message); reload(); }
    catch (err) { alert(apiError(err, 'Action failed.')); }
    finally { setBusyId(null); }
  };

  const total = useMemo(
    () => lines.reduce((s, l) => s + (numberValue(l.quantity) * numberValue(l.unit_price) - numberValue(l.discount_amount) + numberValue(l.tax_amount)), 0),
    [lines],
  );

  const openModal = () => {
    setHead({ customer_name: '', customer_email: '', issue_date: today(), valid_until: plus(30), currency: 'NPR', system_description: '', terms: '', notes: '' });
    setLines([blankLine()]); setFormError(null); setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setFormError(null);
    try {
      const payloadLines = lines.filter((l) => l.description && numberValue(l.unit_price) >= 0).map((l) => ({
        description: l.description, quantity: numberValue(l.quantity) || 1, unit_price: numberValue(l.unit_price),
        discount_amount: numberValue(l.discount_amount), tax_amount: numberValue(l.tax_amount),
      }));
      if (payloadLines.length === 0) { setFormError('Add at least one line item.'); setSaving(false); return; }
      const res = await SalesService.create(wsId, { ...head, lines: payloadLines });
      if (!res.success) { setFormError(res.message || 'Could not create quote.'); return; }
      setOpen(false); reload();
    } catch (err) { setFormError(apiError(err, 'Could not create quote.')); }
    finally { setSaving(false); }
  };

  const setStatus = (id: number, status: QuoteStatus) => act(id, () => SalesService.setStatus(wsId, id, status));

  // The public accept link resolves the tenant by its schema (the host's first
  // label, e.g. "demo" of demo.localhost) plus the quote's unguessable token.
  const shareLink = (token: string) => {
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    const schema = host.split('.')[0] || '';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/quote/${schema}/${token}`;
  };
  const copyLink = async (token: string) => {
    try { await navigator.clipboard.writeText(shareLink(token)); alert('Customer link copied to clipboard.'); }
    catch { prompt('Copy this customer link:', shareLink(token)); }
  };

  const downloadPdf = async (q: QuoteRow) => {
    setBusyId(q.id);
    try {
      const res = await SalesService.pdf(wsId, q.id);
      if (!res.success || !res.data) { alert(res.message || 'Could not generate the PDF.'); return; }
      const a = document.createElement('a');
      a.href = res.data.pdf_data_url; a.download = res.data.filename || `${q.quote_no}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
    } catch (err) { alert(apiError(err, 'Could not generate the PDF.')); }
    finally { setBusyId(null); }
  };

  const emailQuote = (q: QuoteRow) => act(q.id, () => SalesService.email(wsId, q.id, shareLink(q.public_token)));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Quotes"
        subtitle="Priced offers to customers. Accept a quote, then convert it to a draft invoice in Accounting."
        action={<AddButton label="New quote" onClick={openModal} />}
      />
      {loading ? <PageSkeleton kind="list" /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
        <Card>
          <TableShell head={<tr><th className="px-3 py-2">No.</th><th className="px-3 py-2">Customer</th><th className="px-3 py-2">Issued</th><th className="px-3 py-2">Valid until</th><th className="px-3 py-2 text-right">Total</th><th className="px-3 py-2 text-center">Status</th><th className="px-3 py-2 text-right">Actions</th></tr>}>
            {rows.map((q) => (
              <tr key={q.id} className="text-slate-300">
                <td className="px-3 py-2 font-mono text-cyan-300">{q.quote_no}</td>
                <td className="px-3 py-2">
                  {q.customer_name}
                  {q.lead_name ? <span className="ml-1 text-[11px] text-slate-500">· {q.lead_name}</span> : null}
                </td>
                <td className="px-3 py-2">{q.issue_date}</td>
                <td className="px-3 py-2">{q.valid_until || '—'}</td>
                <td className="px-3 py-2 text-right">{money(q.total, q.currency)}</td>
                <td className="px-3 py-2 text-center"><Pill>{q.status}</Pill></td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button disabled={busyId === q.id} onClick={() => downloadPdf(q)} className="text-xs font-medium text-slate-300 hover:text-white disabled:opacity-50">PDF</button>
                  {q.status !== 'converted' && q.customer_email && <button disabled={busyId === q.id} onClick={() => emailQuote(q)} className="ml-3 text-xs font-semibold text-cyan-300 hover:text-cyan-200 disabled:opacity-50">Email</button>}
                  {q.status === 'draft' && <button disabled={busyId === q.id} onClick={() => setStatus(q.id, 'sent')} className="ml-3 text-xs font-semibold text-cyan-300 hover:text-cyan-200 disabled:opacity-50">Mark sent</button>}
                  {(q.status === 'sent' || q.status === 'viewed') && <button onClick={() => copyLink(q.public_token)} className="ml-3 text-xs font-medium text-slate-300 hover:text-white">Copy link</button>}
                  {(q.status === 'sent' || q.status === 'viewed') && <button disabled={busyId === q.id} onClick={() => setStatus(q.id, 'accepted')} className="ml-3 text-xs font-semibold text-emerald-300 hover:text-emerald-200 disabled:opacity-50">Accept</button>}
                  {q.status !== 'converted' && !['cancelled', 'rejected', 'expired'].includes(q.status) && (
                    <button disabled={busyId === q.id} onClick={() => act(q.id, () => SalesService.convert(wsId, q.id))} className="ml-3 text-xs font-semibold text-amber-300 hover:text-amber-200 disabled:opacity-50">Convert → invoice</button>
                  )}
                  {q.status === 'converted' && q.converted_invoice && (
                    <Link href={`/w/${wsId}/accounting/invoices/${q.converted_invoice}`} className="text-xs font-semibold text-cyan-300 hover:text-cyan-200">{q.converted_invoice_no} ↗</Link>
                  )}
                  {q.status !== 'converted' && (
                    <button disabled={busyId === q.id} onClick={() => { if (confirm(`Delete quote ${q.quote_no}?`)) act(q.id, () => SalesService.remove(wsId, q.id)); }} className="ml-3 text-xs font-medium text-red-300 hover:text-red-200 disabled:opacity-50">Delete</button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={7} label="No quotes yet. Create your first quote to send a priced offer." />}
          </TableShell>
        </Card>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New quote">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Customer name"><TextInput required value={head.customer_name} onChange={(e) => setHead({ ...head, customer_name: e.target.value })} placeholder="e.g. Acme Corp" /></Field>
            <Field label="Customer email"><TextInput type="email" value={head.customer_email} onChange={(e) => setHead({ ...head, customer_email: e.target.value })} placeholder="ap@acme.com" /></Field>
            <Field label="Issue date"><TextInput type="date" required value={head.issue_date} onChange={(e) => setHead({ ...head, issue_date: e.target.value })} /></Field>
            <Field label="Valid until"><TextInput type="date" value={head.valid_until} onChange={(e) => setHead({ ...head, valid_until: e.target.value })} /></Field>
            <Field label="Currency"><SelectInput value={head.currency} onChange={(e) => setHead({ ...head, currency: e.target.value })}><option>NPR</option><option>USD</option><option>EUR</option><option>INR</option></SelectInput></Field>
          </div>
          <Field label="Scope of work (optional)"><TextInput value={head.system_description} onChange={(e) => setHead({ ...head, system_description: e.target.value })} placeholder="What you're quoting for" /></Field>

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

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Terms (customer-facing)"><TextInput value={head.terms} onChange={(e) => setHead({ ...head, terms: e.target.value })} placeholder="e.g. 50% advance" /></Field>
            <Field label="Notes (customer-facing)"><TextInput value={head.notes} onChange={(e) => setHead({ ...head, notes: e.target.value })} /></Field>
          </div>

          {formError && <p className="text-xs text-red-300">{formError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10">Cancel</button>
            <PrimaryButton type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create quote'}</PrimaryButton>
          </div>
        </form>
      </Modal>

      <p className="flex items-center gap-1.5 text-[11px] text-slate-600"><FileSignature className="h-3.5 w-3.5" /> Converting a quote creates a draft invoice in Accounting — review and post it there to hit your ledger.</p>
    </div>
  );
}
