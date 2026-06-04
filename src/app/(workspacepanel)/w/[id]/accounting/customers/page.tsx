'use client';

import { useCallback, useState, use as reactUse } from 'react';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { AccountingService, type CustomerRow } from '@/services/accounting.service';
import {
  AccountingTabs, PageHeader, AddButton, ErrorBox, Card, TableShell, EmptyRow,
  Modal, Field, TextInput, SelectInput, PrimaryButton, Pill, useList, apiError,
} from '@/components/accounting/kit';

const TERMS = ['cod', 'net_7', 'net_15', 'net_30', 'net_60'];
const emptyForm = { name: '', email: '', phone: '', tax_id: '', currency: 'NPR', payment_terms: 'net_30' };

export default function CustomersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard service="accounting" required="accounting.view" workspaceId={wsId} skeleton="list">
      <Inner wsId={wsId} />
    </PermissionGuard>
  );
}

function Inner({ wsId }: { wsId: string }) {
  const fetcher = useCallback(() => AccountingService.customers.list(wsId), [wsId]);
  const { rows, loading, error, reload } = useList<CustomerRow>(fetcher);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setFormError(null); setOpen(true); };
  const openEdit = (c: CustomerRow) => {
    setEditing(c);
    setForm({ name: c.name, email: c.email || '', phone: c.phone || '', tax_id: c.tax_id || '', currency: c.currency || 'NPR', payment_terms: c.payment_terms || 'net_30' });
    setFormError(null); setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setFormError(null);
    try {
      const res = editing
        ? await AccountingService.customers.update(wsId, editing.id, form)
        : await AccountingService.customers.create(wsId, form);
      if (!res.success) { setFormError(res.message || 'Could not save customer.'); return; }
      setOpen(false); setForm(emptyForm); setEditing(null); reload();
    } catch (err) { setFormError(apiError(err, 'Could not save customer.')); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Customers" subtitle="People and businesses you invoice." action={<AddButton label="New customer" onClick={openCreate} />} />
      <AccountingTabs wsId={wsId} />
      {loading ? <PageSkeleton kind="list" /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
        <Card>
          <TableShell head={<tr><th className="px-3 py-2">Name</th><th className="px-3 py-2">Email</th><th className="px-3 py-2">Phone</th><th className="px-3 py-2">Terms</th><th className="px-3 py-2 text-center">Status</th><th className="px-3 py-2 text-right">Actions</th></tr>}>
            {rows.map((c) => (
              <tr key={c.id} className="text-slate-300">
                <td className="px-3 py-2 font-medium text-white">{c.name}</td>
                <td className="px-3 py-2">{c.email || '—'}</td>
                <td className="px-3 py-2">{c.phone || '—'}</td>
                <td className="px-3 py-2 uppercase">{c.payment_terms}</td>
                <td className="px-3 py-2 text-center"><Pill>{c.is_active ? 'active' : 'inactive'}</Pill></td>
                <td className="px-3 py-2 text-right"><button onClick={() => openEdit(c)} className="text-xs font-medium text-cyan-300 hover:text-cyan-200">Edit</button></td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={6} label="No customers yet." />}
          </TableShell>
        </Card>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit customer' : 'New customer'}>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name"><TextInput required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Email"><TextInput type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Phone"><TextInput value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="Tax ID"><TextInput value={form.tax_id} onChange={(e) => setForm({ ...form, tax_id: e.target.value })} /></Field>
            <Field label="Currency"><TextInput value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></Field>
            <Field label="Payment terms"><SelectInput value={form.payment_terms} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })}>{TERMS.map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}</SelectInput></Field>
          </div>
          {formError && <p className="text-xs text-red-300">{formError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10">Cancel</button>
            <PrimaryButton type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create customer'}</PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
