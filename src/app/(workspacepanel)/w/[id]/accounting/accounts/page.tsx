'use client';

import { useCallback, useState, use as reactUse } from 'react';
import { businessCurrency } from '@/lib/currency';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { AccountingService, type AccountRow } from '@/services/accounting.service';
import {
  AccountingTabs, PageHeader, AddButton, ErrorBox, Card, TableShell, EmptyRow,
  Modal, Field, TextInput, SelectInput, PrimaryButton, Pill, money, useList, apiError,
} from '@/components/accounting/kit';

const ACCOUNT_TYPES = ['asset', 'liability', 'equity', 'income', 'expense'];
const emptyForm = { code: '', name: '', type: 'asset', subtype: '', opening_balance: '0', currency: businessCurrency() };

export default function AccountsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard service="accounting" required="accounting.view" workspaceId={wsId} skeleton="list">
      <Inner wsId={wsId} />
    </PermissionGuard>
  );
}

function Inner({ wsId }: { wsId: string }) {
  const fetcher = useCallback(() => AccountingService.accounts.list(wsId), [wsId]);
  const { rows, loading, error, reload } = useList<AccountRow>(fetcher);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AccountRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setFormError(null); setOpen(true); };
  const openEdit = (a: AccountRow) => {
    setEditing(a);
    setForm({ code: a.code, name: a.name, type: a.type, subtype: a.subtype || '', opening_balance: String(a.opening_balance ?? '0'), currency: a.currency || businessCurrency() });
    setFormError(null); setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const res = editing
        ? await AccountingService.accounts.update(wsId, editing.id, form)
        : await AccountingService.accounts.create(wsId, form);
      if (!res.success) { setFormError(res.message || 'Could not save account.'); return; }
      setOpen(false); setForm(emptyForm); setEditing(null); reload();
    } catch (err) {
      setFormError(apiError(err, 'Could not save account.'));
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (row: AccountRow) => {
    if (!confirm(`Deactivate account ${row.code} - ${row.name}?`)) return;
    try {
      await AccountingService.accounts.remove(wsId, row.id);
      reload();
    } catch (err) {
      alert(apiError(err, 'Could not deactivate account.'));
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Chart of Accounts"
        subtitle="The ledger accounts every journal line and document posts against."
        action={<AddButton label="New account" onClick={openCreate} />}
      />
      <AccountingTabs wsId={wsId} />

      {loading ? <PageSkeleton kind="list" /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
        <Card>
          <TableShell
            head={
              <tr>
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2 text-right">Opening Balance</th>
                <th className="px-3 py-2 text-center">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            }
          >
            {rows.map((a) => (
              <tr key={a.id} className="text-slate-300">
                <td className="px-3 py-2 font-mono text-white">{a.code}</td>
                <td className="px-3 py-2 text-white">{a.name}</td>
                <td className="px-3 py-2 capitalize">{a.type}</td>
                <td className="px-3 py-2 text-right">{money(a.opening_balance, a.currency)}</td>
                <td className="px-3 py-2 text-center"><Pill>{a.is_active ? 'active' : 'inactive'}</Pill></td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button onClick={() => openEdit(a)} className="text-xs font-medium text-cyan-300 hover:text-cyan-200">Edit</button>
                  {a.is_active && (
                    <button onClick={() => deactivate(a)} className="ml-3 text-xs font-medium text-red-300 hover:text-red-200">Deactivate</button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={6} label="No accounts yet. Create your first ledger account." />}
          </TableShell>
        </Card>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit account' : 'New account'}>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Code"><TextInput required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="1000" /></Field>
            <Field label="Name"><TextInput required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Cash" /></Field>
            <Field label="Type">
              <SelectInput value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
              </SelectInput>
            </Field>
            <Field label="Subtype (optional)"><TextInput value={form.subtype} onChange={(e) => setForm({ ...form, subtype: e.target.value })} placeholder="current_asset" /></Field>
            <Field label="Opening balance"><TextInput type="number" step="0.01" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: e.target.value })} /></Field>
            <Field label="Currency"><TextInput value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></Field>
          </div>
          {formError && <p className="text-xs text-red-300">{formError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10">Cancel</button>
            <PrimaryButton type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create account'}</PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
