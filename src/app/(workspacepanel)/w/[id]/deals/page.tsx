'use client';

import { useCallback, useEffect, useState, use as reactUse } from 'react';
import Link from 'next/link';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { DealsService, type CouponRow } from '@/services/deals.service';
import { MarketplaceService, type StorefrontSettingsRow } from '@/services/marketplace.service';
import { ShieldCheck, AlertTriangle, ArrowRight, ExternalLink, Copy, Check } from 'lucide-react';
import {
  PageHeader, AddButton, ErrorBox, Card, TableShell, EmptyRow,
  Modal, Field, TextInput, SelectInput, PrimaryButton, Pill, money, numberValue, useList, apiError,
} from '@/components/accounting/kit';

const TYPES = [{ v: 'percent', l: 'Percent % off' }, { v: 'flat', l: 'Flat amount off' }, { v: 'free_delivery', l: 'Free delivery' }, { v: 'buy_x_get_y', l: 'Buy X get Y (BOGO)' }];
const STATUSES = ['active', 'scheduled', 'paused', 'expired'];
const today = () => new Date().toISOString().slice(0, 10);
const plus = (d: number) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
const emptyForm = { code: '', description: '', type: 'percent', value: '10', min_order_amount: '0', max_discount: '', usage_limit: '', start_date: today(), end_date: plus(30), status: 'active', first_time_only: false, stackable: false };

export default function DealsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard service="deals" required="deals.view" workspaceId={wsId} skeleton="list">
      <Inner wsId={wsId} />
    </PermissionGuard>
  );
}

function Inner({ wsId }: { wsId: string }) {
  const fetcher = useCallback(() => DealsService.list(wsId), [wsId]);
  const { rows, loading, error, reload } = useList<CouponRow>(fetcher);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CouponRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [settings, setSettings] = useState<StorefrontSettingsRow | null>(null);
  const loadSettings = useCallback(() => {
    MarketplaceService.getStorefront(wsId).then((r) => { if (r.success) setSettings(r.data); }).catch(() => {});
  }, [wsId]);
  useEffect(() => { loadSettings(); }, [loadSettings]);

  // quick validator
  const [test, setTest] = useState({ code: '', amount: '' });
  const [testResult, setTestResult] = useState<string | null>(null);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setFormError(null); setOpen(true); };
  const openEdit = (c: CouponRow) => {
    setEditing(c);
    setForm({ code: c.code, description: c.description || '', type: c.type, value: String(c.value), min_order_amount: String(c.min_order_amount), max_discount: c.max_discount ? String(c.max_discount) : '', usage_limit: c.usage_limit != null ? String(c.usage_limit) : '', start_date: c.start_date, end_date: c.end_date, status: c.status, first_time_only: c.first_time_only, stackable: c.stackable });
    setFormError(null); setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setFormError(null);
    try {
      const payload: Record<string, unknown> = {
        code: form.code, description: form.description, type: form.type, value: numberValue(form.value),
        min_order_amount: numberValue(form.min_order_amount), start_date: form.start_date, end_date: form.end_date,
        status: form.status, first_time_only: form.first_time_only, stackable: form.stackable,
      };
      payload.max_discount = form.max_discount ? numberValue(form.max_discount) : null;
      payload.usage_limit = form.usage_limit ? Number(form.usage_limit) : null;
      const res = editing ? await DealsService.update(wsId, editing.id, payload) : await DealsService.create(wsId, payload);
      if (!res.success) { setFormError(res.message || 'Could not save coupon.'); return; }
      setOpen(false); setForm(emptyForm); setEditing(null); reload();
    } catch (err) { setFormError(apiError(err, 'Could not save coupon.')); }
    finally { setSaving(false); }
  };

  const remove = async (c: CouponRow) => {
    if (!confirm(`Delete coupon ${c.code}?`)) return;
    try { await DealsService.remove(wsId, c.id); reload(); } catch (err) { alert(apiError(err, 'Could not delete.')); }
  };

  const runTest = async () => {
    setTestResult('…');
    try { const res = await DealsService.validate(wsId, test.code, numberValue(test.amount)); setTestResult(res.data.message); }
    catch (err) { setTestResult(apiError(err, 'Validation failed.')); }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Offers & Coupons" subtitle="Create offers your customers redeem — % off, flat amount, free delivery, or Buy X get Y (BOGO) campaigns." action={<AddButton label="New offer" onClick={openCreate} />} />

      <DealsStorefrontPanel wsId={wsId} coupons={rows} settings={settings} refreshSettings={loadSettings} reloadCoupons={reload} onCreateCoupon={openCreate} onEditCoupon={openEdit} />

      <Card>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Test a coupon</p>
        <div className="flex flex-wrap items-center gap-2">
          <TextInput value={test.code} onChange={(e) => setTest({ ...test, code: e.target.value })} placeholder="CODE" />
          <TextInput type="number" step="0.01" value={test.amount} onChange={(e) => setTest({ ...test, amount: e.target.value })} placeholder="Order amount" />
          <PrimaryButton onClick={runTest}>Validate</PrimaryButton>
          {testResult && <span className="text-xs text-slate-300">{testResult}</span>}
        </div>
      </Card>

      {loading ? <PageSkeleton kind="list" /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
        <Card>
          <TableShell head={<tr><th className="px-3 py-2">Code</th><th className="px-3 py-2">Type</th><th className="px-3 py-2 text-right">Value</th><th className="px-3 py-2 text-right">Min order</th><th className="px-3 py-2 text-center">Used</th><th className="px-3 py-2">Window</th><th className="px-3 py-2 text-center">Status</th><th className="px-3 py-2 text-right">Actions</th></tr>}>
            {rows.map((c) => (
              <tr key={c.id} className="text-slate-300">
                <td className="px-3 py-2 font-mono text-white">{c.code}</td>
                <td className="px-3 py-2">{c.type === 'percent' ? '%' : c.type === 'flat' ? 'Flat' : c.type}</td>
                <td className="px-3 py-2 text-right">{c.type === 'percent' ? `${c.value}%` : money(c.value)}</td>
                <td className="px-3 py-2 text-right">{money(c.min_order_amount)}</td>
                <td className="px-3 py-2 text-center">{c.used_count}{c.usage_limit != null ? `/${c.usage_limit}` : ''}</td>
                <td className="px-3 py-2 text-xs">{c.start_date} → {c.end_date}</td>
                <td className="px-3 py-2 text-center"><Pill>{c.status}</Pill></td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button onClick={() => openEdit(c)} className="text-xs font-medium text-cyan-300 hover:text-cyan-200">Edit</button>
                  <button onClick={() => remove(c)} className="ml-3 text-xs font-medium text-red-300 hover:text-red-200">Delete</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={8} label="No coupons yet." />}
          </TableShell>
        </Card>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit offer' : 'New offer'}>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Code"><TextInput required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="SAVE10" /></Field>
            <Field label="Type"><SelectInput value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}</SelectInput></Field>
            <Field label="Value"><TextInput type="number" step="0.01" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></Field>
            <Field label="Min order amount"><TextInput type="number" step="0.01" value={form.min_order_amount} onChange={(e) => setForm({ ...form, min_order_amount: e.target.value })} /></Field>
            <Field label="Max discount (optional)"><TextInput type="number" step="0.01" value={form.max_discount} onChange={(e) => setForm({ ...form, max_discount: e.target.value })} /></Field>
            <Field label="Usage limit (optional)"><TextInput type="number" value={form.usage_limit} onChange={(e) => setForm({ ...form, usage_limit: e.target.value })} /></Field>
            <Field label="Start date"><TextInput type="date" required value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></Field>
            <Field label="End date"><TextInput type="date" required value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></Field>
            <Field label="Status"><SelectInput value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</SelectInput></Field>
            <Field label="Description"><TextInput value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={form.first_time_only} onChange={(e) => setForm({ ...form, first_time_only: e.target.checked })} className="h-4 w-4 rounded border-white/20 bg-black/20" /> First-time only</label>
            <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={form.stackable} onChange={(e) => setForm({ ...form, stackable: e.target.checked })} className="h-4 w-4 rounded border-white/20 bg-black/20" /> Stackable</label>
          </div>
          {formError && <p className="text-xs text-red-300">{formError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10">Cancel</button>
            <PrimaryButton type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create coupon'}</PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}

/**
 * Coupons-on-storefront status. A coupon is "live" when the store is open AND at
 * least one coupon is status=active and today is within its start/end window —
 * the same gate the public coupons endpoint uses. Turns that into a clear
 * Live / Not-live status with the missing items and safe one-click fixes.
 */
function DealsStorefrontPanel({ wsId, coupons, settings, refreshSettings, reloadCoupons, onCreateCoupon, onEditCoupon }: {
  wsId: string;
  coupons: CouponRow[];
  settings: StorefrontSettingsRow | null;
  refreshSettings: () => void;
  reloadCoupons: () => void;
  onCreateCoupon: () => void;
  onEditCoupon: (c: CouponRow) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const todayStr = new Date().toISOString().slice(0, 10);

  const inWindow = (c: CouponRow) => c.start_date <= todayStr && c.end_date >= todayStr;
  const hasCoupon = coupons.length > 0;
  const hasActive = coupons.some((c) => c.status === 'active');
  const liveCoupon = coupons.find((c) => c.status === 'active' && inWindow(c));
  const storeOpen = Boolean(settings?.is_open);
  const live = storeOpen && Boolean(liveCoupon);

  const storeHref = (() => {
    if (typeof window === 'undefined') return null;
    const label = window.location.hostname.split('.')[0];
    if (!label || ['localhost', 'www', 'app', '127'].includes(label) || /^\d+$/.test(label)) return null;
    return `${window.location.origin}/store/${label}`;
  })();

  const activate = async () => {
    const candidate = coupons.find((c) => inWindow(c) && c.status !== 'active') ?? coupons[0];
    if (!candidate) { onCreateCoupon(); return; }
    setBusy(true);
    try { await DealsService.update(wsId, candidate.id, { status: 'active' }); reloadCoupons(); }
    catch (e) { alert(apiError(e, 'Could not activate the coupon.')); }
    finally { setBusy(false); }
  };

  const copyStore = async () => {
    if (!storeHref) return;
    try { await navigator.clipboard.writeText(storeHref); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { prompt('Copy your store link:', storeHref); }
  };

  type Fix = { label: string; onClick?: () => void; href?: string; pending?: boolean };
  const missing: { text: string; fix: Fix }[] = [];
  if (!hasCoupon) missing.push({ text: 'No coupon yet', fix: { label: 'Create a coupon', onClick: onCreateCoupon } });
  else if (!hasActive) missing.push({ text: 'No active coupon', fix: { label: 'Activate a coupon', onClick: activate, pending: busy } });
  else if (!liveCoupon) {
    const offending = coupons.find((c) => c.status === 'active') ?? coupons[0];
    missing.push({ text: 'Your active coupon isn’t in its date window', fix: { label: 'Review dates', onClick: () => onEditCoupon(offending) } });
  }
  if (!storeOpen) missing.push({ text: 'Your business isn’t public yet', fix: { label: 'Go live', href: `/w/${wsId}/marketplace/storefront` } });

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
          {live ? 'Your active coupons show on your public store and apply at checkout.' : 'Your coupons won’t show on the public store until these are done:'}
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
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/w/${wsId}/marketplace/storefront`} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:bg-white/10"><ExternalLink className="h-3.5 w-3.5" /> Open storefront setup</Link>
          {storeHref && (
            <>
              <a href={storeHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:bg-white/10"><ExternalLink className="h-3.5 w-3.5" /> View store</a>
              <button onClick={copyStore} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:bg-white/10">{copied ? <><Check className="h-3.5 w-3.5 text-emerald-300" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy store link</>}</button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
