'use client';

import { useCallback, useEffect, useState, use as reactUse } from 'react';
import Link from 'next/link';
import { businessCurrency } from '@/lib/currency';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { LoyaltyService, type GiftCardRow } from '@/services/loyalty.service';
import { MarketplaceService, type StorefrontSettingsRow } from '@/services/marketplace.service';
import { AccountingService } from '@/services/accounting.service';
import { ShieldCheck, AlertTriangle, ArrowRight, ExternalLink } from 'lucide-react';
import {
  PageHeader, AddButton, ErrorBox, Card, TableShell, EmptyRow,
  Modal, Field, TextInput, SelectInput, PrimaryButton, Pill, money, useList, apiError, LoyaltyTabs,
} from '@/components/loyalty/kit';

interface Cust { id: number; name: string }

export default function GiftCardsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard service="loyalty" required="loyalty.view" workspaceId={wsId} skeleton="list">
      <Inner wsId={wsId} />
    </PermissionGuard>
  );
}

function Inner({ wsId }: { wsId: string }) {
  const fetcher = useCallback(() => LoyaltyService.giftCards.list(wsId), [wsId]);
  const { rows, loading, error, reload } = useList<GiftCardRow>(fetcher);
  const [custs, setCusts] = useState<Cust[]>([]);
  useEffect(() => { AccountingService.customers?.list?.(wsId).then((r: { data?: Cust[] }) => setCusts(r.data ?? [])).catch(() => {}); }, [wsId]);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ initial_value: '0', currency: businessCurrency(), customer: '', expiry_date: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [settings, setSettings] = useState<StorefrontSettingsRow | null>(null);
  const loadSettings = useCallback(() => {
    MarketplaceService.getStorefront(wsId).then((r) => { if (r.success) setSettings(r.data); }).catch(() => {});
  }, [wsId]);
  useEffect(() => { loadSettings(); }, [loadSettings]);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault(); setSaving(true); setFormError(null);
    try {
      const payload = { ...form, customer: form.customer ? Number(form.customer) : null, expiry_date: form.expiry_date || null };
      const res = await LoyaltyService.giftCards.create(wsId, payload);
      if (!res.success) { setFormError(res.message || 'Could not issue.'); return; }
      setOpen(false); setForm({ initial_value: '0', currency: businessCurrency(), customer: '', expiry_date: '', notes: '' }); reload();
    } catch (err) { setFormError(apiError(err, 'Could not issue.')); }
    finally { setSaving(false); }
  };

  const redeem = async (c: GiftCardRow) => {
    const amt = prompt(`Redeem amount from ${c.code} (balance ${c.balance}):`);
    if (!amt) return;
    setBusyId(c.id);
    try { const res = await LoyaltyService.giftCards.redeem(wsId, c.id, amt); if (!res.success) alert(res.message || 'Failed.'); reload(); }
    catch (err) { alert(apiError(err, 'Failed.')); }
    finally { setBusyId(null); }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Gift Cards" subtitle="Issue and redeem prepaid balances." action={<AddButton label="Issue gift card" onClick={() => { setFormError(null); setOpen(true); }} />} />
      <LoyaltyTabs wsId={wsId} />
      <GiftCardStorefrontPanel wsId={wsId} cards={rows} settings={settings} refreshSettings={loadSettings} onIssue={() => { setFormError(null); setOpen(true); }} />
      {loading ? <PageSkeleton kind="list" /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
        <Card>
          <TableShell head={<tr><th className="px-3 py-2">Code</th><th className="px-3 py-2">Customer</th><th className="px-3 py-2 text-right">Initial</th><th className="px-3 py-2 text-right">Balance</th><th className="px-3 py-2 text-center">Status</th><th className="px-3 py-2 text-right">Actions</th></tr>}>
            {rows.map((c) => (
              <tr key={c.id} className="text-slate-300">
                <td className="px-3 py-2 font-medium text-white">{c.code}</td>
                <td className="px-3 py-2">{c.customer_name || '—'}</td>
                <td className="px-3 py-2 text-right">{money(c.initial_value, c.currency)}</td>
                <td className="px-3 py-2 text-right">{money(c.balance, c.currency)}</td>
                <td className="px-3 py-2 text-center"><Pill>{c.status}</Pill></td>
                <td className="px-3 py-2 text-right">
                  {c.status === 'active' ? <button disabled={busyId === c.id} onClick={() => redeem(c)} className="text-xs font-semibold text-emerald-300 hover:text-emerald-200 disabled:opacity-50">Redeem</button> : <span className="text-slate-600">—</span>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={6} label="No gift cards yet." />}
          </TableShell>
        </Card>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Issue gift card">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Initial value"><TextInput type="number" step="0.01" required value={form.initial_value} onChange={(e) => setForm({ ...form, initial_value: e.target.value })} /></Field>
            <Field label="Currency"><TextInput value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></Field>
            <Field label="Customer (optional)"><SelectInput value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })}><option value="">— None —</option>{custs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</SelectInput></Field>
            <Field label="Expiry (optional)"><TextInput type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} /></Field>
          </div>
          {formError && <p className="text-xs text-red-300">{formError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10">Cancel</button>
            <PrimaryButton type="submit" disabled={saving}>{saving ? 'Issuing…' : 'Issue'}</PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}

/**
 * Gift-cards-on-storefront status. Gift cards are redeemed at checkout, so "live"
 * = the store is open AND it accepts gift cards (accept_gift_cards). Same status /
 * what's-missing / one-click-fix shape as the membership + coupons panels.
 */
function GiftCardStorefrontPanel({ wsId, cards, settings, refreshSettings, onIssue }: {
  wsId: string;
  cards: GiftCardRow[];
  settings: StorefrontSettingsRow | null;
  refreshSettings: () => void;
  onIssue: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const storeOpen = Boolean(settings?.is_open);
  const accept = Boolean(settings?.accept_gift_cards);
  const live = storeOpen && accept;

  const enableAccept = async () => {
    setBusy(true);
    try { const r = await MarketplaceService.updateStorefront(wsId, { accept_gift_cards: true }); if (r.success) refreshSettings(); }
    catch (e) { alert(apiError(e, 'Could not update the storefront.')); }
    finally { setBusy(false); }
  };

  type Fix = { label: string; onClick?: () => void; href?: string; pending?: boolean };
  const missing: { text: string; fix: Fix }[] = [];
  if (!accept) missing.push({ text: 'Gift cards aren’t accepted at checkout', fix: { label: 'Accept gift cards', onClick: enableAccept, pending: busy } });
  if (!storeOpen) missing.push({ text: 'Your storefront is closed', fix: { label: 'Open storefront setup', href: `/w/${wsId}/marketplace/storefront` } });

  const FixButton = ({ fix }: { fix: Fix }) => fix.href ? (
    <Link href={fix.href} className="inline-flex items-center gap-1 rounded-lg bg-pink-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-pink-500">{fix.label} <ArrowRight className="h-3 w-3" /></Link>
  ) : (
    <button onClick={fix.onClick} disabled={fix.pending} className="inline-flex items-center gap-1 rounded-lg bg-pink-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-pink-500 disabled:opacity-50">{fix.pending ? 'Working…' : fix.label}</button>
  );

  return (
    <Card>
      <div className="min-w-0">
        {live
          ? <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300"><ShieldCheck className="h-3.5 w-3.5" /> Live on storefront</span>
          : <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-300"><AlertTriangle className="h-3.5 w-3.5" /> Not live yet</span>}
        <p className="mt-2 text-sm text-slate-300">
          {live ? 'Customers can pay with a gift card at checkout on your public store.' : 'Customers can’t pay with gift cards until these are done:'}
        </p>
        {!live && (
          <ul className="mt-3 space-y-2">
            {missing.map((m, i) => (
              <li key={i} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-xs text-slate-400"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" /> {m.text}</span>
                <FixButton fix={m.fix} />
              </li>
            ))}
          </ul>
        )}
        {live && cards.length === 0 && (
          <p className="mt-3 flex items-center gap-2 text-xs text-slate-400">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" /> You’re accepting gift cards, but haven’t issued any yet.
            <button onClick={onIssue} className="ml-1 font-semibold text-pink-300 hover:text-pink-200">Issue one</button>
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/w/${wsId}/marketplace/storefront`} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:bg-white/10"><ExternalLink className="h-3.5 w-3.5" /> Open storefront setup</Link>
        </div>
      </div>
    </Card>
  );
}
