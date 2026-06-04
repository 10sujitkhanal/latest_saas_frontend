'use client';

import { useCallback, useState, use as reactUse } from 'react';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { ReviewsService, type FeedbackRow } from '@/services/reviews.service';
import {
  PageHeader, AddButton, ErrorBox, Card, TableShell, EmptyRow,
  Modal, Field, TextInput, SelectInput, PrimaryButton, Pill, useList, apiError, ReviewsTabs,
} from '@/components/reviews/kit';

const today = () => new Date().toISOString().slice(0, 10);
const empty = { customer_name: '', category: 'service', rating: '5', comment: '', date: today() };

export default function FeedbackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard service="reviews" required="reviews.view" workspaceId={wsId} skeleton="list">
      <Inner wsId={wsId} />
    </PermissionGuard>
  );
}

function Inner({ wsId }: { wsId: string }) {
  const fetcher = useCallback(() => ReviewsService.feedback.list(wsId), [wsId]);
  const { rows, loading, error, reload } = useList<FeedbackRow>(fetcher);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault(); setSaving(true); setFormError(null);
    try {
      const res = await ReviewsService.feedback.create(wsId, { ...form, rating: Number(form.rating) });
      if (!res.success) { setFormError(res.message || 'Could not save.'); return; }
      setOpen(false); setForm(empty); reload();
    } catch (err) { setFormError(apiError(err, 'Could not save.')); }
    finally { setSaving(false); }
  };

  const toggleResolved = async (f: FeedbackRow) => {
    setBusyId(f.id);
    try { const res = await ReviewsService.feedback.update(wsId, f.id, { resolved: !f.resolved }); if (!res.success) alert(res.message || 'Failed.'); reload(); }
    catch (err) { alert(apiError(err, 'Failed.')); }
    finally { setBusyId(null); }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Feedback" subtitle="Internal customer feedback to act on." action={<AddButton label="Add feedback" onClick={() => { setForm(empty); setFormError(null); setOpen(true); }} />} />
      <ReviewsTabs wsId={wsId} />
      {loading ? <PageSkeleton kind="list" /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
        <Card>
          <TableShell head={<tr><th className="px-3 py-2">Customer</th><th className="px-3 py-2">Category</th><th className="px-3 py-2 text-center">Rating</th><th className="px-3 py-2">Comment</th><th className="px-3 py-2 text-center">Resolved</th><th className="px-3 py-2 text-right">Actions</th></tr>}>
            {rows.map((f) => (
              <tr key={f.id} className="text-slate-300">
                <td className="px-3 py-2 font-medium text-white">{f.customer_name || '—'}</td>
                <td className="px-3 py-2">{f.category}</td>
                <td className="px-3 py-2 text-center">{f.rating} ★</td>
                <td className="px-3 py-2 max-w-md">{f.comment}</td>
                <td className="px-3 py-2 text-center"><Pill>{f.resolved ? 'resolved' : 'open'}</Pill></td>
                <td className="px-3 py-2 text-right"><button disabled={busyId === f.id} onClick={() => toggleResolved(f)} className="text-xs font-semibold text-cyan-300 hover:text-cyan-200 disabled:opacity-50">{f.resolved ? 'Reopen' : 'Resolve'}</button></td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={6} label="No feedback yet." />}
          </TableShell>
        </Card>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Add feedback">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Customer (optional)"><TextInput value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} /></Field>
            <Field label="Category"><SelectInput value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}><option value="product">Product</option><option value="service">Service</option><option value="food">Food</option><option value="ambience">Ambience</option><option value="cleanliness">Cleanliness</option><option value="value">Value</option><option value="other">Other</option></SelectInput></Field>
            <Field label="Rating"><SelectInput value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} ★</option>)}</SelectInput></Field>
            <Field label="Date"><TextInput type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          </div>
          <Field label="Comment"><TextInput value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} /></Field>
          {formError && <p className="text-xs text-red-300">{formError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10">Cancel</button>
            <PrimaryButton type="submit" disabled={saving}>{saving ? 'Saving…' : 'Add'}</PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
