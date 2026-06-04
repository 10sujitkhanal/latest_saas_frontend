'use client';

import { useCallback, useState, use as reactUse } from 'react';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { ReviewsService, type ReviewRow } from '@/services/reviews.service';
import {
  PageHeader, AddButton, ErrorBox, Card, TableShell, EmptyRow,
  Modal, Field, TextInput, SelectInput, PrimaryButton, Pill, useList, apiError, ReviewsTabs,
} from '@/components/reviews/kit';

const today = () => new Date().toISOString().slice(0, 10);
const empty = { customer_name: '', rating: '5', text: '', date: today(), source: 'direct', sentiment: 'positive' };

export default function ReviewsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard service="reviews" required="reviews.view" workspaceId={wsId} skeleton="list">
      <Inner wsId={wsId} />
    </PermissionGuard>
  );
}

function Inner({ wsId }: { wsId: string }) {
  const fetcher = useCallback(() => ReviewsService.reviews.list(wsId), [wsId]);
  const { rows, loading, error, reload } = useList<ReviewRow>(fetcher);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault(); setSaving(true); setFormError(null);
    try {
      const res = await ReviewsService.reviews.create(wsId, { ...form, rating: Number(form.rating) });
      if (!res.success) { setFormError(res.message || 'Could not save.'); return; }
      setOpen(false); setForm(empty); reload();
    } catch (err) { setFormError(apiError(err, 'Could not save.')); }
    finally { setSaving(false); }
  };

  const reply = async (r: ReviewRow) => {
    const text = prompt(`Reply to ${r.customer_name}:`, r.reply || '');
    if (!text) return;
    setBusyId(r.id);
    try { const res = await ReviewsService.reviews.reply(wsId, r.id, text); if (!res.success) alert(res.message || 'Failed.'); reload(); }
    catch (err) { alert(apiError(err, 'Failed.')); }
    finally { setBusyId(null); }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Reviews" subtitle="Customer reviews across channels." action={<AddButton label="Add review" onClick={() => { setForm(empty); setFormError(null); setOpen(true); }} />} />
      <ReviewsTabs wsId={wsId} />
      {loading ? <PageSkeleton kind="list" /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
        <Card>
          <TableShell head={<tr><th className="px-3 py-2">Customer</th><th className="px-3 py-2 text-center">Rating</th><th className="px-3 py-2">Review</th><th className="px-3 py-2">Source</th><th className="px-3 py-2 text-center">Sentiment</th><th className="px-3 py-2 text-right">Actions</th></tr>}>
            {rows.map((r) => (
              <tr key={r.id} className="text-slate-300 align-top">
                <td className="px-3 py-2 font-medium text-white">{r.customer_name}</td>
                <td className="px-3 py-2 text-center">{'★'.repeat(r.rating)}<span className="text-slate-600">{'★'.repeat(5 - r.rating)}</span></td>
                <td className="px-3 py-2 max-w-md"><div>{r.text}</div>{r.replied && <div className="mt-1 text-[11px] text-emerald-300">↳ {r.reply}</div>}</td>
                <td className="px-3 py-2">{r.source}</td>
                <td className="px-3 py-2 text-center"><Pill>{r.sentiment}</Pill></td>
                <td className="px-3 py-2 text-right">{!r.replied ? <button disabled={busyId === r.id} onClick={() => reply(r)} className="text-xs font-semibold text-emerald-300 hover:text-emerald-200 disabled:opacity-50">Reply</button> : <span className="text-slate-600">replied</span>}</td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={6} label="No reviews yet." />}
          </TableShell>
        </Card>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Add review">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Customer"><TextInput required value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} /></Field>
            <Field label="Rating"><SelectInput value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} ★</option>)}</SelectInput></Field>
            <Field label="Date"><TextInput type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            <Field label="Source"><SelectInput value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}><option value="direct">Direct</option><option value="moredealsx">MoreDealsX</option><option value="google">Google</option><option value="facebook">Facebook</option></SelectInput></Field>
            <Field label="Sentiment"><SelectInput value={form.sentiment} onChange={(e) => setForm({ ...form, sentiment: e.target.value })}><option value="positive">Positive</option><option value="neutral">Neutral</option><option value="negative">Negative</option></SelectInput></Field>
          </div>
          <Field label="Review text"><TextInput value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} /></Field>
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
