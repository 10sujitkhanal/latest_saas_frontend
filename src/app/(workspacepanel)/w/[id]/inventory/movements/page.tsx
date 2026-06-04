'use client';

import { useCallback, useEffect, useState, use as reactUse } from 'react';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { InventoryService, type MovementRow, type ItemRow } from '@/services/inventory.service';
import {
  InventoryTabs, PageHeader, AddButton, ErrorBox, Card, TableShell, EmptyRow,
  Modal, Field, TextInput, SelectInput, PrimaryButton, Pill, numberValue, useList, apiError,
} from '@/components/inventory/kit';

const TYPES = [{ v: 'in', l: 'Stock in (+)' }, { v: 'out', l: 'Stock out (−)' }, { v: 'adjust', l: 'Adjust (set to)' }];

export default function MovementsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard service="inventory" required="inventory.view" workspaceId={wsId} skeleton="list">
      <Inner wsId={wsId} />
    </PermissionGuard>
  );
}

function Inner({ wsId }: { wsId: string }) {
  const fetcher = useCallback(() => InventoryService.listMovements(wsId), [wsId]);
  const { rows, loading, error, reload } = useList<MovementRow>(fetcher);
  const [items, setItems] = useState<ItemRow[]>([]);
  useEffect(() => { InventoryService.items.list(wsId).then((r) => setItems((r.data ?? []).filter((i) => i.is_active))).catch(() => {}); }, [wsId]);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ item: '', type: 'in', qty: '', reference: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openCreate = () => { setForm({ item: '', type: 'in', qty: '', reference: '', notes: '' }); setFormError(null); setOpen(true); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setFormError(null);
    try {
      const res = await InventoryService.recordMovement(wsId, { item: Number(form.item), type: form.type, qty: numberValue(form.qty), reference: form.reference, notes: form.notes });
      if (!res.success) { setFormError(res.message || 'Could not record movement.'); return; }
      setOpen(false); reload();
      InventoryService.items.list(wsId).then((r) => setItems((r.data ?? []).filter((i) => i.is_active))).catch(() => {});
    } catch (err) { setFormError(apiError(err, 'Could not record movement.')); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Stock Movements" subtitle="Stock in, stock out, and adjustments. Each updates the item's quantity on hand." action={<AddButton label="Record movement" onClick={openCreate} />} />
      <InventoryTabs wsId={wsId} />
      {loading ? <PageSkeleton kind="list" /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
        <Card>
          <TableShell head={<tr><th className="px-3 py-2">When</th><th className="px-3 py-2">Item</th><th className="px-3 py-2 text-center">Type</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Before</th><th className="px-3 py-2 text-right">After</th><th className="px-3 py-2">Reference</th></tr>}>
            {rows.map((m) => (
              <tr key={m.id} className="text-slate-300">
                <td className="px-3 py-2">{new Date(m.created_at).toLocaleDateString()}</td>
                <td className="px-3 py-2"><span className="font-mono text-white">{m.item_sku}</span> {m.item_name}</td>
                <td className="px-3 py-2 text-center"><Pill>{m.type}</Pill></td>
                <td className="px-3 py-2 text-right">{m.qty}</td>
                <td className="px-3 py-2 text-right text-slate-500">{m.qty_before}</td>
                <td className="px-3 py-2 text-right font-semibold text-white">{m.qty_after}</td>
                <td className="px-3 py-2">{m.reference || '—'}</td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={7} label="No stock movements yet." />}
          </TableShell>
        </Card>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Record stock movement">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Item"><SelectInput required value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })}><option value="">Select…</option>{items.map((i) => <option key={i.id} value={i.id}>{i.sku} — {i.name} (on hand {i.qty_on_hand})</option>)}</SelectInput></Field>
            <Field label="Type"><SelectInput value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}</SelectInput></Field>
            <Field label="Quantity"><TextInput type="number" step="0.0001" required value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} /></Field>
            <Field label="Reference"><TextInput value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="GRN-001 / Sale #12" /></Field>
            <div className="sm:col-span-2"><Field label="Notes"><TextInput value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field></div>
          </div>
          {items.length === 0 && <p className="text-xs text-amber-300">No items yet — add one on the Items tab first.</p>}
          {formError && <p className="text-xs text-red-300">{formError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10">Cancel</button>
            <PrimaryButton type="submit" disabled={saving}>{saving ? 'Saving…' : 'Record movement'}</PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
