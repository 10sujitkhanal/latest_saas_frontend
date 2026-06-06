'use client';

import { useCallback, useEffect, useState, use as reactUse } from 'react';
import { businessCurrency } from '@/lib/currency';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { LoyaltyService, type GiftCardRow } from '@/services/loyalty.service';
import { AccountingService } from '@/services/accounting.service';
import {
  PageHeader, AddButton, ErrorBox, Card, TableShell, EmptyRow,
  Modal, Field, TextInput, SelectInput, PrimaryButton, Pill, money, useList, apiError, LoyaltyTabs,
} from '@/components/loyalty/kit';

interface Cust { id: number; name: string }

export default function GiftCardsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard service="loyalty" required="loyalty.view" workspaceId={wsId} skeleton="list">
      <Inner wsId={wsId} />
    </PermissionGuard>
  );
}

function Inner({ wsId }: { wsId: string }) {
  const fetcher = useCallback(() => LoyaltyService.giftCards.list(wsId), [wsId]);
  const { rows, loading, error, reload } = useList<GiftCardRow>(fetcher);
  const [custs, setCusts] = useState<Cust[]>([]);
  useEffect(() => { AccountingService.customers?.list?.(wsId).then((r: { data?: Cust[] }) => setCusts(r.data ?? [])).catch(() => {}); }, [wsId]);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ initial_value: '0', currency: businessCurrency(), customer: '', expiry_date: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault(); setSaving(true); setFormError(null);
    try {
      const payload = { ...form, customer: form.customer ? Number(form.customer) : null, expiry_date: form.expiry_date || null };
      const res = await LoyaltyService.giftCards.create(wsId, payload);
      if (!res.success) { setFormError(res.message || 'Could not issue.'); return; }
      setOpen(false); setForm({ initial_value: '0', currency: businessCurrency(), customer: '', expiry_date: '', notes: '' }); reload();
    } catch (err) { setFormError(apiError(err, 'Could not issue.')); }
    finally { setSaving(false); }
  };

  const redeem = async (c: GiftCardRow) => {
    const amt = prompt(`Redeem amount from ${c.code} (balance ${c.balance}):`);
    if (!amt) return;
    setBusyId(c.id);
    try { const res = await LoyaltyService.giftCards.redeem(wsId, c.id, amt); if (!res.success) alert(res.message || 'Failed.'); reload(); }
    catch (err) { alert(apiError(err, 'Failed.')); }
    finally { setBusyId(null); }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Gift Cards" subtitle="Issue and redeem prepaid balances." action={<AddButton label="Issue gift card" onClick={() => { setFormError(null); setOpen(true); }} />} />
      <LoyaltyTabs wsId={wsId} />
      {loading ? <PageSkeleton kind="list" /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
        <Card>
          <TableShell head={<tr><th className="px-3 py-2">Code</th><th className="px-3 py-2">Customer</th><th className="px-3 py-2 text-right">Initial</th><th className="px-3 py-2 text-right">Balance</th><th className="px-3 py-2 text-center">Status</th><th className="px-3 py-2 text-right">Actions</th></tr>}>
            {rows.map((c) => (
              <tr key={c.id} className="text-slate-300">
                <td className="px-3 py-2 font-medium text-white">{c.code}</td>
                <td className="px-3 py-2">{c.customer_name || '—'}</td>
                <td className="px-3 py-2 text-right">{money(c.initial_value, c.currency)}</td>
                <td className="px-3 py-2 text-right">{money(c.balance, c.currency)}</td>
                <td className="px-3 py-2 text-center"><Pill>{c.status}</Pill></td>
                <td className="px-3 py-2 text-right">
                  {c.status === 'active' ? <button disabled={busyId === c.id} onClick={() => redeem(c)} className="text-xs font-semibold text-emerald-300 hover:text-emerald-200 disabled:opacity-50">Redeem</button> : <span className="text-slate-600">—</span>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={6} label="No gift cards yet." />}
          </TableShell>
        </Card>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Issue gift card">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Initial value"><TextInput type="number" step="0.01" required value={form.initial_value} onChange={(e) => setForm({ ...form, initial_value: e.target.value })} /></Field>
            <Field label="Currency"><TextInput value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></Field>
            <Field label="Customer (optional)"><SelectInput value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })}><option value="">— None —</option>{custs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</SelectInput></Field>
            <Field label="Expiry (optional)"><TextInput type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} /></Field>
          </div>
          {formError && <p className="text-xs text-red-300">{formError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10">Cancel</button>
            <PrimaryButton type="submit" disabled={saving}>{saving ? 'Issuing…' : 'Issue'}</PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
