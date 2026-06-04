'use client';

import { useCallback, useEffect, useState, use as reactUse } from 'react';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { LoyaltyService, type MembershipRow, type MembershipPlanRow } from '@/services/loyalty.service';
import { AccountingService } from '@/services/accounting.service';
import {
  PageHeader, AddButton, ErrorBox, Card, TableShell, EmptyRow,
  Modal, Field, TextInput, SelectInput, PrimaryButton, Pill, useList, apiError, LoyaltyTabs,
} from '@/components/loyalty/kit';

interface Cust { id: number; name: string }
const today = () => new Date().toISOString().slice(0, 10);

export default function MembershipsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard service="loyalty" required="loyalty.view" workspaceId={wsId} skeleton="list">
      <Inner wsId={wsId} />
    </PermissionGuard>
  );
}

function Inner({ wsId }: { wsId: string }) {
  const fetcher = useCallback(() => LoyaltyService.memberships.list(wsId), [wsId]);
  const { rows, loading, error, reload } = useList<MembershipRow>(fetcher);
  const [custs, setCusts] = useState<Cust[]>([]);
  const [plans, setPlans] = useState<MembershipPlanRow[]>([]);
  useEffect(() => {
    AccountingService.customers?.list?.(wsId).then((r: { data?: Cust[] }) => setCusts(r.data ?? [])).catch(() => {});
    LoyaltyService.plans.list(wsId).then((r) => setPlans((r.data ?? []).filter((p) => p.is_active))).catch(() => {});
  }, [wsId]);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ customer: '', plan: '', start_date: today(), end_date: '', auto_renew: false });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const renew = async (m: MembershipRow) => {
    if (!confirm(`Renew ${m.member_no} one more period and post the revenue to Accounting?`)) return;
    const collect = confirm('Mark it paid now? OK = record payment (paid), Cancel = leave as an open invoice.');
    setBusyId(m.id);
    try {
      const res = await LoyaltyService.memberships.renew(wsId, m.id, collect);
      alert(res.success ? (res.message || 'Renewed.') : (res.message || 'Could not renew.'));
      reload();
    } catch (err) { alert(apiError(err, 'Could not renew.')); }
    finally { setBusyId(null); }
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault(); setSaving(true); setFormError(null);
    try {
      const payload = { ...form, customer: Number(form.customer), plan: Number(form.plan), end_date: form.end_date || null };
      const res = await LoyaltyService.memberships.create(wsId, payload);
      if (!res.success) { setFormError(res.message || 'Could not save.'); return; }
      setOpen(false); setForm({ customer: '', plan: '', start_date: today(), end_date: '', auto_renew: false }); reload();
    } catch (err) { setFormError(apiError(err, 'Could not save.')); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Memberships" subtitle="Customer subscriptions to your plans." action={<AddButton label="New membership" onClick={() => { setFormError(null); setOpen(true); }} />} />
      <LoyaltyTabs wsId={wsId} />
      {loading ? <PageSkeleton kind="list" /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
        <Card>
          <TableShell head={<tr><th className="px-3 py-2">#</th><th className="px-3 py-2">Customer</th><th className="px-3 py-2">Plan</th><th className="px-3 py-2">From</th><th className="px-3 py-2">To</th><th className="px-3 py-2 text-center">Status</th><th className="px-3 py-2 text-right">Actions</th></tr>}>
            {rows.map((m) => (
              <tr key={m.id} className="text-slate-300">
                <td className="px-3 py-2 text-slate-400">{m.member_no}</td>
                <td className="px-3 py-2 font-medium text-white">{m.customer_name || m.customer}</td>
                <td className="px-3 py-2">{m.plan_name || m.plan}</td>
                <td className="px-3 py-2">{m.start_date}</td>
                <td className="px-3 py-2">{m.end_date || '—'}</td>
                <td className="px-3 py-2 text-center"><Pill>{m.status}</Pill></td>
                <td className="px-3 py-2 text-right">
                  {m.status !== 'cancelled' && (
                    <button disabled={busyId === m.id} onClick={() => renew(m)} className="text-xs font-semibold text-emerald-300 hover:text-emerald-200 disabled:opacity-50">
                      {busyId === m.id ? 'Renewing…' : 'Renew + bill'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={7} label="No memberships yet." />}
          </TableShell>
        </Card>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="New membership">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Customer"><SelectInput required value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })}><option value="">— Select —</option>{custs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</SelectInput></Field>
            <Field label="Plan"><SelectInput required value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}><option value="">— Select —</option>{plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</SelectInput></Field>
            <Field label="Start"><TextInput type="date" required value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></Field>
            <Field label="End (optional)"><TextInput type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></Field>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={form.auto_renew} onChange={(e) => setForm({ ...form, auto_renew: e.target.checked })} className="h-4 w-4 accent-pink-500" /> Auto-renew</label>
          {formError && <p className="text-xs text-red-300">{formError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10">Cancel</button>
            <PrimaryButton type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create'}</PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
