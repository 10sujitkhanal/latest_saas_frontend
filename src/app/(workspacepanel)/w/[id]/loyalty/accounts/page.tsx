'use client';

import { useCallback, useEffect, useState, use as reactUse } from 'react';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { LoyaltyService, type LoyaltyAccountRow } from '@/services/loyalty.service';
import { AccountingService } from '@/services/accounting.service';
import {
  PageHeader, AddButton, ErrorBox, Card, TableShell, EmptyRow,
  Modal, Field, SelectInput, PrimaryButton, Pill, useList, apiError, LoyaltyTabs,
} from '@/components/loyalty/kit';

interface Cust { id: number; name: string }

export default function LoyaltyAccountsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard service="loyalty" required="loyalty.view" workspaceId={wsId} skeleton="list">
      <Inner wsId={wsId} />
    </PermissionGuard>
  );
}

function Inner({ wsId }: { wsId: string }) {
  const fetcher = useCallback(() => LoyaltyService.accounts.list(wsId), [wsId]);
  const { rows, loading, error, reload } = useList<LoyaltyAccountRow>(fetcher);
  const [custs, setCusts] = useState<Cust[]>([]);
  useEffect(() => { AccountingService.customers?.list?.(wsId).then((r: { data?: Cust[] }) => setCusts(r.data ?? [])).catch(() => {}); }, [wsId]);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ customer: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault(); setSaving(true); setFormError(null);
    try {
      const res = await LoyaltyService.accounts.create(wsId, { customer: Number(form.customer) });
      if (!res.success) { setFormError(res.message || 'Could not enrol.'); return; }
      setOpen(false); setForm({ customer: '' }); reload();
    } catch (err) { setFormError(apiError(err, 'Could not enrol.')); }
    finally { setSaving(false); }
  };

  const points = async (a: LoyaltyAccountRow, action: 'earn' | 'redeem') => {
    const v = prompt(`${action === 'earn' ? 'Add' : 'Redeem'} how many points for ${a.customer_name}? (have ${a.points})`);
    if (!v) return;
    setBusyId(a.id);
    try { const res = await LoyaltyService.accounts.points(wsId, a.id, action, Number(v)); if (!res.success) alert(res.message || 'Failed.'); reload(); }
    catch (err) { alert(apiError(err, 'Failed.')); }
    finally { setBusyId(null); }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Loyalty Points" subtitle="Points balances and tiers per customer." action={<AddButton label="Enrol customer" onClick={() => { setFormError(null); setOpen(true); }} />} />
      <LoyaltyTabs wsId={wsId} />
      {loading ? <PageSkeleton kind="list" /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
        <Card>
          <TableShell head={<tr><th className="px-3 py-2">Customer</th><th className="px-3 py-2 text-center">Tier</th><th className="px-3 py-2 text-right">Points</th><th className="px-3 py-2 text-right">Lifetime</th><th className="px-3 py-2 text-right">Actions</th></tr>}>
            {rows.map((a) => (
              <tr key={a.id} className="text-slate-300">
                <td className="px-3 py-2 font-medium text-white">{a.customer_name || a.customer}</td>
                <td className="px-3 py-2 text-center"><Pill>{a.tier}</Pill></td>
                <td className="px-3 py-2 text-right font-semibold text-white">{a.points}</td>
                <td className="px-3 py-2 text-right text-slate-400">{a.lifetime_points}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button disabled={busyId === a.id} onClick={() => points(a, 'earn')} className="text-xs font-semibold text-emerald-300 hover:text-emerald-200 disabled:opacity-50">Earn</button>
                  <button disabled={busyId === a.id} onClick={() => points(a, 'redeem')} className="ml-3 text-xs font-medium text-amber-300 hover:text-amber-200 disabled:opacity-50">Redeem</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={5} label="No loyalty accounts yet." />}
          </TableShell>
        </Card>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Enrol customer">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Customer"><SelectInput required value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })}><option value="">— Select —</option>{custs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</SelectInput></Field>
          {formError && <p className="text-xs text-red-300">{formError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10">Cancel</button>
            <PrimaryButton type="submit" disabled={saving}>{saving ? 'Enrolling…' : 'Enrol'}</PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
