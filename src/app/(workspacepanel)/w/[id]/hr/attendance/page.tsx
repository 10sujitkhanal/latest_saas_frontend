'use client';

import { useCallback, useEffect, useState, use as reactUse } from 'react';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { HRService, type AttendanceRow, type EmployeeRow } from '@/services/hr.service';
import {
  PageHeader, AddButton, ErrorBox, Card, TableShell, EmptyRow,
  Modal, Field, TextInput, SelectInput, PrimaryButton, Pill, useList, apiError, HRTabs,
} from '@/components/hr/kit';

const today = () => new Date().toISOString().slice(0, 10);
const empty = { employee: '', date: today(), status: 'present', check_in: '', check_out: '', hours: '0', notes: '' };

export default function HRAttendancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard service="hr" required="hr.view" workspaceId={wsId} skeleton="list">
      <Inner wsId={wsId} />
    </PermissionGuard>
  );
}

function Inner({ wsId }: { wsId: string }) {
  const fetcher = useCallback(() => HRService.attendance.list(wsId), [wsId]);
  const { rows, loading, error, reload } = useList<AttendanceRow>(fetcher);
  const [emps, setEmps] = useState<EmployeeRow[]>([]);
  useEffect(() => { HRService.employees.list(wsId).then((r) => setEmps(r.data ?? [])).catch(() => {}); }, [wsId]);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault(); setSaving(true); setFormError(null);
    try {
      const payload = {
        ...form, employee: Number(form.employee),
        check_in: form.check_in || null, check_out: form.check_out || null,
      };
      const res = await HRService.attendance.create(wsId, payload);
      if (!res.success) { setFormError(res.message || 'Could not record.'); return; }
      setOpen(false); setForm(empty); reload();
    } catch (err) { setFormError(apiError(err, 'Could not record.')); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Attendance" subtitle="Daily attendance log." action={<AddButton label="Record attendance" onClick={() => { setForm(empty); setFormError(null); setOpen(true); }} />} />
      <HRTabs wsId={wsId} />
      {loading ? <PageSkeleton kind="list" /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
        <Card>
          <TableShell head={<tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Employee</th><th className="px-3 py-2 text-center">Status</th><th className="px-3 py-2">In</th><th className="px-3 py-2">Out</th><th className="px-3 py-2 text-right">Hours</th></tr>}>
            {rows.map((a) => (
              <tr key={a.id} className="text-slate-300">
                <td className="px-3 py-2">{a.date}</td>
                <td className="px-3 py-2 font-medium text-white">{a.employee_name || a.employee}</td>
                <td className="px-3 py-2 text-center"><Pill>{a.status.replace('_', ' ')}</Pill></td>
                <td className="px-3 py-2">{a.check_in || '—'}</td>
                <td className="px-3 py-2">{a.check_out || '—'}</td>
                <td className="px-3 py-2 text-right">{a.hours}</td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={6} label="No attendance recorded yet." />}
          </TableShell>
        </Card>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Record attendance">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Employee"><SelectInput required value={form.employee} onChange={(e) => setForm({ ...form, employee: e.target.value })}><option value="">— Select —</option>{emps.map((e) => <option key={e.id} value={e.id}>{e.full_name || e.first_name}</option>)}</SelectInput></Field>
            <Field label="Date"><TextInput type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            <Field label="Status"><SelectInput value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="present">Present</option><option value="absent">Absent</option><option value="late">Late</option><option value="half_day">Half Day</option><option value="holiday">Holiday</option></SelectInput></Field>
            <Field label="Hours"><TextInput type="number" step="0.01" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} /></Field>
            <Field label="Check in"><TextInput type="time" value={form.check_in} onChange={(e) => setForm({ ...form, check_in: e.target.value })} /></Field>
            <Field label="Check out"><TextInput type="time" value={form.check_out} onChange={(e) => setForm({ ...form, check_out: e.target.value })} /></Field>
          </div>
          {formError && <p className="text-xs text-red-300">{formError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10">Cancel</button>
            <PrimaryButton type="submit" disabled={saving}>{saving ? 'Saving…' : 'Record'}</PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
