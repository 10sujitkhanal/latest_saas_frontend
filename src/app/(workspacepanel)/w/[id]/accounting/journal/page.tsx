'use client';

import { useCallback, useEffect, useMemo, useState, use as reactUse } from 'react';
import { Trash2, Plus } from 'lucide-react';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { AccountingService, type JournalEntryRow, type AccountRow } from '@/services/accounting.service';
import {
  AccountingTabs, PageHeader, AddButton, ErrorBox, Card, TableShell, EmptyRow,
  Modal, Field, TextInput, SelectInput, PrimaryButton, Pill, money, numberValue, useList, apiError,
} from '@/components/accounting/kit';

type LineDraft = { account: string; description: string; debit: string; credit: string };
const blankLine = (): LineDraft => ({ account: '', description: '', debit: '', credit: '' });
const today = () => new Date().toISOString().slice(0, 10);

export default function JournalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard service="accounting" required="accounting.view" workspaceId={wsId} skeleton="list">
      <Inner wsId={wsId} />
    </PermissionGuard>
  );
}

function Inner({ wsId }: { wsId: string }) {
  const fetcher = useCallback(() => AccountingService.journalEntries.list(wsId), [wsId]);
  const { rows, loading, error, reload } = useList<JournalEntryRow>(fetcher);

  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  useEffect(() => { AccountingService.accounts.list(wsId).then((r) => setAccounts((r.data ?? []).filter((a) => a.is_active))).catch(() => {}); }, [wsId]);

  const [open, setOpen] = useState(false);
  const [head, setHead] = useState({ entry_no: '', date: today(), reference: '', description: '' });
  const [lines, setLines] = useState<LineDraft[]>([blankLine(), blankLine()]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const totals = useMemo(() => {
    const d = lines.reduce((s, l) => s + numberValue(l.debit), 0);
    const c = lines.reduce((s, l) => s + numberValue(l.credit), 0);
    return { d, c, balanced: Math.abs(d - c) < 0.01 && d > 0 };
  }, [lines]);

  const openModal = () => {
    setHead({ entry_no: '', date: today(), reference: '', description: '' });
    setLines([blankLine(), blankLine()]);
    setFormError(null);
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setFormError(null);
    try {
      const payloadLines = lines
        .filter((l) => l.account && (numberValue(l.debit) > 0 || numberValue(l.credit) > 0))
        .map((l) => ({ account: Number(l.account), description: l.description, debit: numberValue(l.debit), credit: numberValue(l.credit) }));
      const res = await AccountingService.journalEntries.create(wsId, { ...head, lines: payloadLines });
      if (!res.success) { setFormError(res.message || 'Could not create entry.'); return; }
      setOpen(false); reload();
    } catch (err) { setFormError(apiError(err, 'Could not create entry.')); }
    finally { setSaving(false); }
  };

  const post = async (row: JournalEntryRow) => {
    setBusyId(row.id);
    try {
      const res = await AccountingService.postJournalEntry(wsId, row.id);
      if (!res.success) alert(res.message || 'Could not post entry.');
      reload();
    } catch (err) { alert(apiError(err, 'Could not post entry.')); }
    finally { setBusyId(null); }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Journal Entries" subtitle="Double-entry postings. Entries must balance before they can be posted; posted entries are locked." action={<AddButton label="New entry" onClick={openModal} />} />
      <AccountingTabs wsId={wsId} />

      {loading ? <PageSkeleton kind="list" /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
        <Card>
          <TableShell head={<tr><th className="px-3 py-2">Entry No.</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Description</th><th className="px-3 py-2 text-right">Debit</th><th className="px-3 py-2 text-right">Credit</th><th className="px-3 py-2 text-center">Status</th><th className="px-3 py-2 text-right">Actions</th></tr>}>
            {rows.map((j) => (
              <tr key={j.id} className="text-slate-300">
                <td className="px-3 py-2 font-mono text-white">{j.entry_no}</td>
                <td className="px-3 py-2">{j.date}</td>
                <td className="px-3 py-2">{j.description}</td>
                <td className="px-3 py-2 text-right">{money(j.total_debit)}</td>
                <td className="px-3 py-2 text-right">{money(j.total_credit)}</td>
                <td className="px-3 py-2 text-center"><Pill>{j.status}</Pill></td>
                <td className="px-3 py-2 text-right">
                  {j.status === 'draft'
                    ? <button disabled={busyId === j.id} onClick={() => post(j)} className="text-xs font-semibold text-emerald-300 hover:text-emerald-200 disabled:opacity-50">{busyId === j.id ? 'Posting…' : 'Post'}</button>
                    : <span className="text-xs text-slate-600">locked</span>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={7} label="No journal entries yet." />}
          </TableShell>
        </Card>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New journal entry">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Entry no. (auto)"><TextInput value={head.entry_no} onChange={(e) => setHead({ ...head, entry_no: e.target.value })} placeholder="Auto-generated — leave blank" /></Field>
            <Field label="Date"><TextInput type="date" required value={head.date} onChange={(e) => setHead({ ...head, date: e.target.value })} /></Field>
            <Field label="Reference"><TextInput value={head.reference} onChange={(e) => setHead({ ...head, reference: e.target.value })} /></Field>
            <Field label="Description"><TextInput required value={head.description} onChange={(e) => setHead({ ...head, description: e.target.value })} /></Field>
          </div>

          <div className="rounded-xl border border-white/10">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/[0.03] uppercase tracking-wide text-slate-500">
                <tr><th className="px-2 py-2">Account</th><th className="px-2 py-2">Memo</th><th className="px-2 py-2 text-right">Debit</th><th className="px-2 py-2 text-right">Credit</th><th className="px-2 py-2"></th></tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {lines.map((l, i) => (
                  <tr key={i}>
                    <td className="px-2 py-1.5">
                      <SelectInput value={l.account} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, account: e.target.value } : x))}>
                        <option value="">Select…</option>
                        {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                      </SelectInput>
                    </td>
                    <td className="px-2 py-1.5"><TextInput value={l.description} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} /></td>
                    <td className="px-2 py-1.5"><TextInput type="number" step="0.01" value={l.debit} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, debit: e.target.value, credit: e.target.value ? '' : x.credit } : x))} /></td>
                    <td className="px-2 py-1.5"><TextInput type="number" step="0.01" value={l.credit} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, credit: e.target.value, debit: e.target.value ? '' : x.debit } : x))} /></td>
                    <td className="px-2 py-1.5 text-center">
                      {lines.length > 2 && <button type="button" onClick={() => setLines(lines.filter((_, j) => j !== i))} className="text-slate-500 hover:text-red-300"><Trash2 className="h-3.5 w-3.5" /></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between gap-3 border-t border-white/10 px-3 py-2">
              <button type="button" onClick={() => setLines([...lines, blankLine()])} className="inline-flex items-center gap-1 text-xs font-medium text-emerald-300 hover:text-emerald-200"><Plus className="h-3.5 w-3.5" /> Add line</button>
              <div className="text-xs">
                <span className="text-slate-400">Debit </span><span className="font-semibold text-white">{money(totals.d)}</span>
                <span className="ml-3 text-slate-400">Credit </span><span className="font-semibold text-white">{money(totals.c)}</span>
                <span className={`ml-3 rounded-full border px-2 py-0.5 ${totals.balanced ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' : 'border-red-400/30 bg-red-400/10 text-red-200'}`}>{totals.balanced ? 'Balanced' : 'Out of balance'}</span>
              </div>
            </div>
          </div>

          {formError && <p className="text-xs text-red-300">{formError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10">Cancel</button>
            <PrimaryButton type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create entry'}</PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
