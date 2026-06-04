'use client';

import { useCallback, useEffect, useState, use as reactUse } from 'react';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { ExpensesService, type ExpenseRow, type ExpenseCategoryRow } from '@/services/expenses.service';
import {
  PageHeader, AddButton, ErrorBox, Card, TableShell, EmptyRow,
  Modal, Field, TextInput, SelectInput, PrimaryButton, Pill, money, useList, apiError, ExpensesTabs,
} from '@/components/expenses/kit';

const today = () => new Date().toISOString().slice(0, 10);
const empty = { title: '', category: '', date: today(), payment_method: 'personal_card', subtotal: '0', tax_total: '0', submitted_by: '', notes: '' };

export default function ExpensesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard service="expenses" required="expenses.view" workspaceId={wsId} skeleton="list">
      <Inner wsId={wsId} />
    </PermissionGuard>
  );
}

function Inner({ wsId }: { wsId: string }) {
  const fetcher = useCallback(() => ExpensesService.expenses.list(wsId), [wsId]);
  const { rows, loading, error, reload } = useList<ExpenseRow>(fetcher);
  const [cats, setCats] = useState<ExpenseCategoryRow[]>([]);
  useEffect(() => { ExpensesService.categories.list(wsId).then((r) => setCats(r.data ?? [])).catch(() => {}); }, [wsId]);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault(); setSaving(true); setFormError(null);
    try {
      const payload = { ...form, category: form.category ? Number(form.category) : null };
      const res = await ExpensesService.expenses.create(wsId, payload);
      if (!res.success) { setFormError(res.message || 'Could not save.'); return; }
      setOpen(false); setForm(empty); reload();
    } catch (err) { setFormError(apiError(err, 'Could not save.')); }
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
      <PageHeader title="Expenses" subtitle="Record spend; approving posts it to the ledger." action={<AddButton label="New expense" onClick={() => { setForm(empty); setFormError(null); setOpen(true); }} />} />
      <ExpensesTabs wsId={wsId} />
      {loading ? <PageSkeleton kind="list" /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
        <Card>
          <TableShell head={<tr><th className="px-3 py-2">#</th><th className="px-3 py-2">Title</th><th className="px-3 py-2">Category</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Method</th><th className="px-3 py-2 text-right">Total</th><th className="px-3 py-2 text-center">Status</th><th className="px-3 py-2 text-right">Actions</th></tr>}>
            {rows.map((e) => (
              <tr key={e.id} className="text-slate-300">
                <td className="px-3 py-2 text-slate-400">{e.expense_no}</td>
                <td className="px-3 py-2 font-medium text-white">{e.title}</td>
                <td className="px-3 py-2">{e.category_name || '—'}</td>
                <td className="px-3 py-2">{e.date}</td>
                <td className="px-3 py-2">{e.payment_method.replace('_', ' ')}</td>
                <td className="px-3 py-2 text-right">{money(e.total, 'NPR')}</td>
                <td className="px-3 py-2 text-center"><Pill>{e.status}</Pill>{e.posted_journal_no && <span className="ml-1 text-[10px] text-emerald-300">{e.posted_journal_no}</span>}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {['draft', 'submitted'].includes(e.status) ? (
                    <button disabled={busyId === e.id} onClick={() => act(e.id, () => ExpensesService.expenses.approve(wsId, e.id))} className="text-xs font-semibold text-emerald-300 hover:text-emerald-200 disabled:opacity-50">Approve &amp; post</button>
                  ) : e.status === 'approved' ? (
                    <button disabled={busyId === e.id} onClick={() => act(e.id, () => ExpensesService.expenses.reject(wsId, e.id))} className="text-xs font-medium text-amber-300 hover:text-amber-200 disabled:opacity-50">Reverse</button>
                  ) : <span className="text-slate-600">—</span>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={8} label="No expenses yet." />}
          </TableShell>
        </Card>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="New expense">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><Field label="Title"><TextInput required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field></div>
            <Field label="Category"><SelectInput value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}><option value="">— None —</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</SelectInput></Field>
            <Field label="Date"><TextInput type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            <Field label="Payment method"><SelectInput value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}><option value="cash">Cash</option><option value="company_card">Company Card</option><option value="personal_card">Personal Card (reimbursable)</option></SelectInput></Field>
            <Field label="Submitted by"><TextInput value={form.submitted_by} onChange={(e) => setForm({ ...form, submitted_by: e.target.value })} /></Field>
            <Field label="Amount (net)"><TextInput type="number" step="0.01" value={form.subtotal} onChange={(e) => setForm({ ...form, subtotal: e.target.value })} /></Field>
            <Field label="Tax"><TextInput type="number" step="0.01" value={form.tax_total} onChange={(e) => setForm({ ...form, tax_total: e.target.value })} /></Field>
          </div>
          <Field label="Notes"><TextInput value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
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
