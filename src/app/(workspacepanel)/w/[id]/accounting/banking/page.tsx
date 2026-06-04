'use client';

import { useCallback, useEffect, useState, use as reactUse } from 'react';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { AccountingService, type BankAccountRow, type BankTransactionRow } from '@/services/accounting.service';
import {
  AccountingTabs, PageHeader, AddButton, ErrorBox, Card, TableShell, EmptyRow,
  Modal, Field, TextInput, SelectInput, PrimaryButton, Pill, money, numberValue, useList, apiError,
} from '@/components/accounting/kit';

const ACCT_TYPES = ['checking', 'savings', 'cash', 'credit_card', 'other'];
const today = () => new Date().toISOString().slice(0, 10);
const emptyAcct = { name: '', bank_name: '', account_number: '', account_type: 'checking', currency: 'NPR', opening_balance: '0' };

export default function BankingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard service="accounting" required="accounting.view" workspaceId={wsId} skeleton="list">
      <Inner wsId={wsId} />
    </PermissionGuard>
  );
}

function Inner({ wsId }: { wsId: string }) {
  const fetcher = useCallback(() => AccountingService.bankAccounts.list(wsId), [wsId]);
  const { rows: accounts, loading, error, reload } = useList<BankAccountRow>(fetcher);

  const [selected, setSelected] = useState<number | null>(null);
  const [txns, setTxns] = useState<BankTransactionRow[]>([]);
  const [txnLoading, setTxnLoading] = useState(false);

  const loadTxns = useCallback(async (accountId: number) => {
    setTxnLoading(true);
    try { const res = await AccountingService.listBankTransactions(wsId, { bank_account: accountId }); setTxns(res.data ?? []); }
    catch { setTxns([]); }
    finally { setTxnLoading(false); }
  }, [wsId]);

  useEffect(() => {
    if (selected == null && accounts.length) setSelected(accounts[0].id);
  }, [accounts, selected]);
  useEffect(() => { if (selected != null) loadTxns(selected); }, [selected, loadTxns]);

  // create account
  const [acctOpen, setAcctOpen] = useState(false);
  const [acctForm, setAcctForm] = useState(emptyAcct);
  const [savingAcct, setSavingAcct] = useState(false);
  const [acctErr, setAcctErr] = useState<string | null>(null);
  const submitAcct = async (e: React.FormEvent) => {
    e.preventDefault(); setSavingAcct(true); setAcctErr(null);
    try {
      const res = await AccountingService.bankAccounts.create(wsId, acctForm);
      if (!res.success) { setAcctErr(res.message || 'Could not create account.'); return; }
      setAcctOpen(false); setAcctForm(emptyAcct); reload();
    } catch (err) { setAcctErr(apiError(err, 'Could not create account.')); }
    finally { setSavingAcct(false); }
  };

  // add transaction
  const [txnOpen, setTxnOpen] = useState(false);
  const [txnForm, setTxnForm] = useState({ date: today(), description: '', direction: 'in', amount: '', reference: '' });
  const [savingTxn, setSavingTxn] = useState(false);
  const [txnErr, setTxnErr] = useState<string | null>(null);
  const submitTxn = async (e: React.FormEvent) => {
    e.preventDefault(); if (selected == null) return;
    setSavingTxn(true); setTxnErr(null);
    try {
      const res = await AccountingService.createBankTransaction(wsId, { bank_account: selected, ...txnForm, amount: numberValue(txnForm.amount) });
      if (!res.success) { setTxnErr(res.message || 'Could not record transaction.'); return; }
      setTxnOpen(false); setTxnForm({ date: today(), description: '', direction: 'in', amount: '', reference: '' });
      loadTxns(selected); reload();
    } catch (err) { setTxnErr(apiError(err, 'Could not record transaction.')); }
    finally { setSavingTxn(false); }
  };

  const toggleReconcile = async (t: BankTransactionRow) => {
    try { await AccountingService.reconcileBankTransaction(wsId, t.id); if (selected != null) loadTxns(selected); }
    catch (err) { alert(apiError(err, 'Could not update.')); }
  };

  const acct = accounts.find((a) => a.id === selected) || null;

  return (
    <div className="space-y-5">
      <PageHeader title="Banking" subtitle="Bank & cash accounts and their transactions." action={<AddButton label="New bank account" onClick={() => { setAcctForm(emptyAcct); setAcctErr(null); setAcctOpen(true); }} />} />
      <AccountingTabs wsId={wsId} />

      {loading ? <PageSkeleton kind="list" /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {accounts.map((a) => (
              <button key={a.id} onClick={() => setSelected(a.id)} className={`rounded-2xl border p-4 text-left transition-colors ${selected === a.id ? 'border-emerald-400/40 bg-emerald-400/[0.06]' : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.05]'}`}>
                <p className="text-sm font-semibold text-white">{a.name}</p>
                <p className="text-xs text-slate-500">{a.bank_name || a.account_type} {a.account_number ? `· ${a.account_number}` : ''}</p>
                <p className="mt-2 text-lg font-bold text-white">{money(a.current_balance, a.currency)}</p>
              </button>
            ))}
            {accounts.length === 0 && <Card className="sm:col-span-2 xl:col-span-4"><p className="text-center text-xs text-slate-500">No bank accounts yet. Add one to start tracking transactions.</p></Card>}
          </div>

          {acct && (
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold text-white">{acct.name} — transactions</h2>
                <AddButton label="Add transaction" onClick={() => { setTxnForm({ date: today(), description: '', direction: 'in', amount: '', reference: '' }); setTxnErr(null); setTxnOpen(true); }} />
              </div>
              {txnLoading ? <PageSkeleton kind="list" /> : (
                <TableShell head={<tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Description</th><th className="px-3 py-2">Ref</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2 text-right">Balance</th><th className="px-3 py-2 text-center">Reconciled</th></tr>}>
                  {txns.map((t) => (
                    <tr key={t.id} className="text-slate-300">
                      <td className="px-3 py-2">{t.date}</td>
                      <td className="px-3 py-2 text-white">{t.description}</td>
                      <td className="px-3 py-2">{t.reference || '—'}</td>
                      <td className={`px-3 py-2 text-right font-semibold ${t.direction === 'in' ? 'text-emerald-300' : 'text-red-300'}`}>{t.direction === 'in' ? '+' : '−'}{money(t.amount, acct.currency)}</td>
                      <td className="px-3 py-2 text-right">{money(t.balance_after, acct.currency)}</td>
                      <td className="px-3 py-2 text-center">
                        <button onClick={() => toggleReconcile(t)} className="cursor-pointer">{t.is_reconciled ? <Pill>reconciled</Pill> : <span className="text-xs text-slate-500 hover:text-slate-300">mark…</span>}</button>
                      </td>
                    </tr>
                  ))}
                  {txns.length === 0 && <EmptyRow colSpan={6} label="No transactions yet." />}
                </TableShell>
              )}
            </Card>
          )}
        </>
      )}

      <Modal open={acctOpen} onClose={() => setAcctOpen(false)} title="New bank account">
        <form onSubmit={submitAcct} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Account name"><TextInput required value={acctForm.name} onChange={(e) => setAcctForm({ ...acctForm, name: e.target.value })} placeholder="Operating Account" /></Field>
            <Field label="Bank name"><TextInput value={acctForm.bank_name} onChange={(e) => setAcctForm({ ...acctForm, bank_name: e.target.value })} /></Field>
            <Field label="Account number"><TextInput value={acctForm.account_number} onChange={(e) => setAcctForm({ ...acctForm, account_number: e.target.value })} /></Field>
            <Field label="Type"><SelectInput value={acctForm.account_type} onChange={(e) => setAcctForm({ ...acctForm, account_type: e.target.value })}>{ACCT_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}</SelectInput></Field>
            <Field label="Currency"><TextInput value={acctForm.currency} onChange={(e) => setAcctForm({ ...acctForm, currency: e.target.value })} /></Field>
            <Field label="Opening balance"><TextInput type="number" step="0.01" value={acctForm.opening_balance} onChange={(e) => setAcctForm({ ...acctForm, opening_balance: e.target.value })} /></Field>
          </div>
          {acctErr && <p className="text-xs text-red-300">{acctErr}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAcctOpen(false)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10">Cancel</button>
            <PrimaryButton type="submit" disabled={savingAcct}>{savingAcct ? 'Saving…' : 'Create account'}</PrimaryButton>
          </div>
        </form>
      </Modal>

      <Modal open={txnOpen} onClose={() => setTxnOpen(false)} title={`Transaction · ${acct?.name ?? ''}`}>
        <form onSubmit={submitTxn} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date"><TextInput type="date" required value={txnForm.date} onChange={(e) => setTxnForm({ ...txnForm, date: e.target.value })} /></Field>
            <Field label="Direction"><SelectInput value={txnForm.direction} onChange={(e) => setTxnForm({ ...txnForm, direction: e.target.value })}><option value="in">Money in (+)</option><option value="out">Money out (−)</option></SelectInput></Field>
            <Field label="Amount"><TextInput type="number" step="0.01" required value={txnForm.amount} onChange={(e) => setTxnForm({ ...txnForm, amount: e.target.value })} /></Field>
            <Field label="Reference"><TextInput value={txnForm.reference} onChange={(e) => setTxnForm({ ...txnForm, reference: e.target.value })} /></Field>
            <div className="sm:col-span-2"><Field label="Description"><TextInput required value={txnForm.description} onChange={(e) => setTxnForm({ ...txnForm, description: e.target.value })} /></Field></div>
          </div>
          {txnErr && <p className="text-xs text-red-300">{txnErr}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setTxnOpen(false)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10">Cancel</button>
            <PrimaryButton type="submit" disabled={savingTxn}>{savingTxn ? 'Saving…' : 'Record transaction'}</PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
