'use client';

import { useCallback, useState, use as reactUse } from 'react';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { LoyaltyService, type LoyaltyRewardRow, type RewardType } from '@/services/loyalty.service';
import { AgentsService } from '@/services/agents.service';
import { Sparkles, Loader2 } from 'lucide-react';
import {
  PageHeader, AddButton, ErrorBox, Card, TableShell, EmptyRow,
  Modal, Field, TextInput, SelectInput, PrimaryButton, Pill, money, useList, apiError, LoyaltyTabs,
} from '@/components/loyalty/kit';

const TYPES: { v: RewardType; l: string }[] = [
  { v: 'discount_percent', l: 'Percent off (%)' },
  { v: 'discount_amount', l: 'Amount off' },
  { v: 'gift_card', l: 'Gift card' },
];
const empty = { name: '', description: '', points_cost: '100', reward_type: 'discount_percent' as RewardType, value: '10', is_active: true, is_public: true };

export default function RewardsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard service="loyalty" required="loyalty.view" workspaceId={wsId} skeleton="list">
      <Inner wsId={wsId} />
    </PermissionGuard>
  );
}

function Inner({ wsId }: { wsId: string }) {
  const fetcher = useCallback(() => LoyaltyService.rewards.list(wsId), [wsId]);
  const { rows, loading, error, reload } = useList<LoyaltyRewardRow>(fetcher);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LoyaltyRewardRow | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const rewardSummary = () => form.reward_type === 'discount_percent' ? `${form.value}% off` : form.reward_type === 'discount_amount' ? `${form.value} off` : `${form.value} gift card`;
  const suggestDescription = async () => {
    if (suggesting) return;
    if (!form.name.trim()) { setFormError('Name the reward first.'); return; }
    setSuggesting(true); setFormError(null);
    try {
      const r = await AgentsService.suggestRewardDescription(wsId, { name: form.name, reward: rewardSummary() });
      if (r.success && r.data?.text) setForm((f) => ({ ...f, description: r.data.text }));
      else setFormError(r.message || 'Could not draft a description.');
    } catch (e) { setFormError(apiError(e, 'Could not draft a description.')); }
    finally { setSuggesting(false); }
  };

  const openCreate = () => { setEditing(null); setForm(empty); setFormError(null); setOpen(true); };
  const openEdit = (r: LoyaltyRewardRow) => {
    setEditing(r);
    setForm({ name: r.name, description: r.description || '', points_cost: String(r.points_cost), reward_type: r.reward_type, value: String(r.value), is_active: r.is_active, is_public: r.is_public });
    setFormError(null); setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setFormError(null);
    try {
      const payload = { ...form, points_cost: Number(form.points_cost) || 0, value: Number(form.value) || 0 };
      const res = editing ? await LoyaltyService.rewards.update(wsId, editing.id, payload) : await LoyaltyService.rewards.create(wsId, payload);
      if (!res.success) { setFormError(res.message || 'Could not save reward.'); return; }
      setOpen(false); reload();
    } catch (err) { setFormError(apiError(err, 'Could not save reward.')); }
    finally { setSaving(false); }
  };

  const remove = async (r: LoyaltyRewardRow) => {
    if (!confirm(`Delete reward "${r.name}"?`)) return;
    try { await LoyaltyService.rewards.remove(wsId, r.id); reload(); } catch (err) { alert(apiError(err, 'Could not delete.')); }
  };

  const rewardValue = (r: LoyaltyRewardRow) => r.reward_type === 'discount_percent' ? `${r.value}% off` : r.reward_type === 'discount_amount' ? `${money(r.value)} off` : `${money(r.value)} gift card`;

  return (
    <div className="space-y-5">
      <PageHeader title="Rewards" subtitle="What customers can redeem their points for. Redeeming issues a coupon or gift-card code." action={<AddButton label="New reward" onClick={openCreate} />} />
      <LoyaltyTabs wsId={wsId} />
      {loading ? <PageSkeleton kind="list" /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
        <Card>
          <TableShell head={<tr><th className="px-3 py-2">Reward</th><th className="px-3 py-2 text-right">Points</th><th className="px-3 py-2">Gives</th><th className="px-3 py-2 text-center">Status</th><th className="px-3 py-2 text-right">Actions</th></tr>}>
            {rows.map((r) => (
              <tr key={r.id} className="text-slate-300">
                <td className="px-3 py-2 font-medium text-white">{r.name}</td>
                <td className="px-3 py-2 text-right">{r.points_cost}</td>
                <td className="px-3 py-2">{rewardValue(r)}</td>
                <td className="px-3 py-2 text-center"><Pill>{r.is_active ? 'active' : 'inactive'}</Pill>{r.is_public && <span className="ml-1 text-[10px] text-pink-300">public</span>}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button onClick={() => openEdit(r)} className="text-xs font-medium text-cyan-300 hover:text-cyan-200">Edit</button>
                  <button onClick={() => remove(r)} className="ml-3 text-xs font-medium text-red-300 hover:text-red-200">Delete</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={5} label="No rewards yet. Add what points can buy." />}
          </TableShell>
        </Card>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit reward' : 'New reward'}>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name"><TextInput required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="10% off coupon" /></Field>
            <Field label="Points cost"><TextInput type="number" min="1" value={form.points_cost} onChange={(e) => setForm({ ...form, points_cost: e.target.value })} /></Field>
            <Field label="Reward type"><SelectInput value={form.reward_type} onChange={(e) => setForm({ ...form, reward_type: e.target.value as RewardType })}>{TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}</SelectInput></Field>
            <Field label={form.reward_type === 'discount_percent' ? 'Percent (%)' : 'Amount'}><TextInput type="number" step="0.01" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></Field>
          </div>
          <Field label="Description (optional)">
            <div className="flex gap-2">
              <TextInput value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Shown on your store" />
              <button type="button" onClick={suggestDescription} disabled={suggesting} title="Suggest with AI"
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-violet-500/40 bg-violet-500/10 px-2.5 text-[11px] font-semibold text-violet-200 hover:bg-violet-500/20 disabled:opacity-50">
                {suggesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} AI
              </button>
            </div>
          </Field>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="h-4 w-4 accent-pink-500" /> Active</label>
            <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={form.is_public} onChange={(e) => setForm({ ...form, is_public: e.target.checked })} className="h-4 w-4 accent-pink-500" /> Show on storefront</label>
          </div>
          {formError && <p className="text-xs text-red-300">{formError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10">Cancel</button>
            <PrimaryButton type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save reward' : 'Create reward'}</PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
