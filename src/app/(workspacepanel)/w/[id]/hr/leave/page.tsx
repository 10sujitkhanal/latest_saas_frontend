'use client';

import { useCallback, useEffect, useState, use as reactUse } from 'react';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { HRService, type LeaveRow, type EmployeeRow } from '@/services/hr.service';
import {
  PageHeader, AddButton, ErrorBox, Card, TableShell, EmptyRow,
  Modal, Field, TextInput, SelectInput, PrimaryButton, Pill, useList, apiError, HRTabs,
} from '@/components/hr/kit';

const today = () => new Date().toISOString().slice(0, 10);
const empty = { employee: '', type: 'annual', start_date: today(), end_date: today(), days: '1', reason: '' };

export default function HRLeavePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard service="hr" required="hr.view" workspaceId={wsId} skeleton="list">
      <Inner wsId={wsId} />
    </PermissionGuard>
  );
}

function Inner({ wsId }: { wsId: string }) {
  const fetcher = useCallback(() => HRService.leave.list(wsId), [wsId]);
  const { rows, loading, error, reload } = useList<LeaveRow>(fetcher);
  const [emps, setEmps] = useState<EmployeeRow[]>([]);
  useEffect(() => { HRService.employees.list(wsId).then((r) => setEmps(r.data ?? [])).catch(() => {}); }, [wsId]);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault(); setSaving(true); setFormError(null);
    try {
      const res = await HRService.leave.create(wsId, { ...form, employee: Number(form.employee) });
      if (!res.success) { setFormError(res.message || 'Could not submit.'); return; }
      setOpen(false); setForm(empty); reload();
    } catch (err) { setFormError(apiError(err, 'Could not submit.')); }
    finally { setSaving(false); }
  };

  const decide = async (l: LeaveRow, decision: 'approved' | 'rejected') => {
    setBusyId(l.id);
    try { const res = await HRService.leave.decide(wsId, l.id, decision); if (!res.success) alert(res.message || 'Failed.'); reload(); }
    catch (err) { alert(apiError(err, 'Failed.')); }
    finally { setBusyId(null); }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Leave Requests" subtitle="Review and approve time off." action={<AddButton label="New request" onClick={() => { setForm(empty); setFormError(null); setOpen(true); }} />} />
      <HRTabs wsId={wsId} />
      {loading ? <PageSkeleton kind="list" /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
        <Card>
          <TableShell head={<tr><th className="px-3 py-2">Employee</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">From</th><th className="px-3 py-2">To</th><th className="px-3 py-2 text-right">Days</th><th className="px-3 py-2 text-center">Status</th><th className="px-3 py-2 text-right">Actions</th></tr>}>
            {rows.map((l) => (
              <tr key={l.id} className="text-slate-300">
                <td className="px-3 py-2 font-medium text-white">{l.employee_name || l.employee}</td>
                <td className="px-3 py-2">{l.type}</td>
                <td className="px-3 py-2">{l.start_date}</td>
                <td className="px-3 py-2">{l.end_date}</td>
                <td className="px-3 py-2 text-right">{l.days}</td>
                <td className="px-3 py-2 text-center"><Pill>{l.status}</Pill></td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {l.status === 'pending' ? (
                    <>
                      <button disabled={busyId === l.id} onClick={() => decide(l, 'approved')} className="text-xs font-semibold text-emerald-300 hover:text-emerald-200 disabled:opacity-50">Approve</button>
                      <button disabled={busyId === l.id} onClick={() => decide(l, 'rejected')} className="ml-3 text-xs font-medium text-red-300 hover:text-red-200 disabled:opacity-50">Reject</button>
                    </>
                  ) : <span className="text-slate-600">—</span>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={7} label="No leave requests yet." />}
          </TableShell>
        </Card>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="New leave request">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Employee"><SelectInput required value={form.employee} onChange={(e) => setForm({ ...form, employee: e.target.value })}><option value="">— Select —</option>{emps.map((e) => <option key={e.id} value={e.id}>{e.full_name || e.first_name}</option>)}</SelectInput></Field>
            <Field label="Type"><SelectInput value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="annual">Annual</option><option value="sick">Sick</option><option value="maternity">Maternity</option><option value="paternity">Paternity</option><option value="unpaid">Unpaid</option><option value="other">Other</option></SelectInput></Field>
            <Field label="From"><TextInput type="date" required value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></Field>
            <Field label="To"><TextInput type="date" required value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></Field>
            <Field label="Days"><TextInput type="number" step="0.5" value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} /></Field>
          </div>
          <Field label="Reason"><TextInput value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></Field>
          {formError && <p className="text-xs text-red-300">{formError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10">Cancel</button>
            <PrimaryButton type="submit" disabled={saving}>{saving ? 'Submitting…' : 'Submit'}</PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
