'use client';

import { useCallback, useEffect, useState, use as reactUse } from 'react';
import Link from 'next/link';
import { businessCurrency } from '@/lib/currency';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { LoyaltyService, type MembershipPlanRow } from '@/services/loyalty.service';
import { MarketplaceService, type StorefrontSettingsRow } from '@/services/marketplace.service';
import { AgentsService } from '@/services/agents.service';
import { ShieldCheck, AlertTriangle, QrCode, Copy, Check, ArrowRight, ExternalLink, Lock, Sparkles, Loader2 } from 'lucide-react';
import {
  PageHeader, AddButton, ErrorBox, Card, TableShell, EmptyRow,
  Modal, Field, TextInput, SelectInput, PrimaryButton, Pill, money, useList, apiError, LoyaltyTabs,
} from '@/components/loyalty/kit';
import { membershipReadiness } from '@/lib/membershipReadiness';

const empty = { name: '', price: '0', currency: businessCurrency(), interval: 'monthly', benefits: '', perks: '', member_discount_percent: '0', description: '', is_active: true, is_public: false };
// "What you get" lines → a clean string[] (and a legacy one-line summary for any
// storefront client still reading the old free-text benefits field).
const perksToArray = (s: string) => s.split('\n').map((p) => p.trim()).filter(Boolean).slice(0, 20);

export default function MembershipPlansPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard service="loyalty" required="loyalty.view" workspaceId={wsId} skeleton="list">
      <Inner wsId={wsId} />
    </PermissionGuard>
  );
}

function Inner({ wsId }: { wsId: string }) {
  const fetcher = useCallback(() => LoyaltyService.plans.list(wsId), [wsId]);
  const { rows, loading, error, reload } = useList<MembershipPlanRow>(fetcher);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MembershipPlanRow | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Copilot: draft perks from the plan name/price so the owner starts from
  // something, not a blank box. Merges with whatever they've already typed.
  const suggestPerks = async () => {
    if (suggesting) return;
    setSuggesting(true);
    try {
      const r = await AgentsService.suggestPerks(wsId, { name: form.name, price: form.price, interval: form.interval });
      if (r.success && r.data?.perks?.length) {
        const existing = perksToArray(form.perks);
        const merged = Array.from(new Set([...existing, ...r.data.perks])).slice(0, 20);
        setForm((f) => ({ ...f, perks: merged.join('\n') }));
      } else {
        setFormError(r.message || 'The assistant could not draft perks just now.');
      }
    } catch (e) { setFormError(apiError(e, 'Could not draft perks.')); }
    finally { setSuggesting(false); }
  };
  const [settings, setSettings] = useState<StorefrontSettingsRow | null>(null);
  const loadSettings = useCallback(() => {
    MarketplaceService.getStorefront(wsId).then((r) => { if (r.success) setSettings(r.data); }).catch(() => {});
  }, [wsId]);
  useEffect(() => { loadSettings(); }, [loadSettings]);

  const openCreate = () => { setEditing(null); setForm(empty); setFormError(null); setOpen(true); };
  const openEdit = (p: MembershipPlanRow) => { setEditing(p); setForm({ name: p.name, price: String(p.price), currency: p.currency, interval: p.interval, benefits: p.benefits || '', perks: (p.perks || []).join('\n'), member_discount_percent: String(p.member_discount_percent ?? '0'), description: p.description || '', is_active: p.is_active, is_public: Boolean(p.is_public) }); setFormError(null); setOpen(true); };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault(); setSaving(true); setFormError(null);
    try {
      const perks = perksToArray(form.perks);
      const payload = { ...form, perks, benefits: perks.join(' • ') || form.benefits };
      const res = editing ? await LoyaltyService.plans.update(wsId, editing.id, payload) : await LoyaltyService.plans.create(wsId, payload);
      if (!res.success) { setFormError(res.message || 'Could not save.'); return; }
      setOpen(false); reload();
    } catch (err) { setFormError(apiError(err, 'Could not save.')); }
    finally { setSaving(false); }
  };

  const remove = async (p: MembershipPlanRow) => {
    if (!confirm(`Delete plan "${p.name}"?`)) return;
    try { await LoyaltyService.plans.remove(wsId, p.id); reload(); } catch (err) { alert(apiError(err, 'Could not delete.')); }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Membership Plans" subtitle="Tiers customers can subscribe to." action={<AddButton label="New plan" onClick={openCreate} />} />
      <LoyaltyTabs wsId={wsId} />
      <MembershipStorefrontPanel wsId={wsId} plans={rows} settings={settings} refreshSettings={loadSettings} reloadPlans={reload} onCreatePlan={openCreate} />
      {loading ? <PageSkeleton kind="list" /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
        <Card>
          <TableShell head={<tr><th className="px-3 py-2">Name</th><th className="px-3 py-2">Interval</th><th className="px-3 py-2 text-right">Price</th><th className="px-3 py-2 text-center">Status</th><th className="px-3 py-2 text-right">Actions</th></tr>}>
            {rows.map((p) => (
              <tr key={p.id} className="text-slate-300">
                <td className="px-3 py-2 font-medium text-white">{p.name}</td>
                <td className="px-3 py-2">{p.interval.replace('_', ' ')}{Number(p.member_discount_percent ?? 0) > 0 && <span className="ml-2 text-[10px] text-emerald-300">−{Number(p.member_discount_percent)}% members</span>}</td>
                <td className="px-3 py-2 text-right">{money(p.price, p.currency)}</td>
                <td className="px-3 py-2 text-center"><Pill>{p.is_active ? 'active' : 'inactive'}</Pill>{p.is_public && <span className="ml-1 text-[10px] text-pink-300">public</span>}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button onClick={() => openEdit(p)} className="text-xs font-medium text-cyan-300 hover:text-cyan-200">Edit</button>
                  <button onClick={() => remove(p)} className="ml-3 text-xs font-medium text-red-300 hover:text-red-200">Delete</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={5} label="No plans yet." />}
          </TableShell>
        </Card>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit plan' : 'New plan'}>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name"><TextInput required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Interval"><SelectInput value={form.interval} onChange={(e) => setForm({ ...form, interval: e.target.value })}><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option><option value="one_time">One-time</option></SelectInput></Field>
            <Field label="Price"><TextInput type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></Field>
            <Field label="Currency"><TextInput value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></Field>
          </div>
          <Field label="What members get">
            <div className="mb-2 flex justify-end">
              <button type="button" onClick={suggestPerks} disabled={suggesting}
                className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/40 bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold text-violet-200 hover:bg-violet-500/20 disabled:opacity-50">
                {suggesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {suggesting ? 'Drafting…' : 'Suggest with AI'}
              </button>
            </div>
            <textarea
              value={form.perks}
              onChange={(e) => setForm({ ...form, perks: e.target.value })}
              rows={5}
              placeholder={"One perk per line, e.g.\n15% off every order\nFree delivery\nEarly access to new drops\nBirthday gift"}
              className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-pink-500/40"
            />
            <span className="mt-1 block text-[11px] text-slate-500">One per line — these show as a checklist on the membership card customers see.</span>
            {perksToArray(form.perks).length > 0 && (
              <ul className="mt-2 space-y-1">
                {perksToArray(form.perks).map((p, i) => (
                  <li key={i} className="flex items-center gap-2 text-[12px] text-slate-300"><Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" /> {p}</li>
                ))}
              </ul>
            )}
          </Field>
          <Field label="Member discount %">
            <TextInput type="number" step="0.01" min="0" max="100" value={form.member_discount_percent} onChange={(e) => setForm({ ...form, member_discount_percent: e.target.value })} />
            <span className="mt-1 block text-[11px] text-slate-500">Automatic % off storefront orders for active members (0 = none).</span>
          </Field>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="h-4 w-4 accent-pink-500" /> Active</label>
            <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={form.is_public} onChange={(e) => setForm({ ...form, is_public: e.target.checked })} className="h-4 w-4 accent-pink-500" /> Sell on storefront (public)</label>
          </div>
          {formError && <p className="text-xs text-red-300">{formError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10">Cancel</button>
            <PrimaryButton type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create'}</PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}

/**
 * Membership-on-storefront status + QR. Turns the otherwise-invisible 4-flag gate
 * (plan is_active + is_public, storefront is_open + sell_memberships) into a single
 * "Live / Not live yet" status with the exact missing items and safe one-click fixes.
 */
function MembershipStorefrontPanel({ wsId, plans, settings, refreshSettings, reloadPlans, onCreatePlan }: {
  wsId: string;
  plans: MembershipPlanRow[];
  settings: StorefrontSettingsRow | null;
  refreshSettings: () => void;
  reloadPlans: () => void;
  onCreatePlan: () => void;
}) {
  const [busy, setBusy] = useState<'public' | 'sell' | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // One shared readiness check (see lib/membershipReadiness) — the QR card, this
  // panel and the Setup Hub all derive Live/Not-live from the same gates so they
  // can never disagree. `missing` is already in dependency order.
  const readiness = membershipReadiness(plans, settings);
  const { hasPlan, live, missing: missingGates } = readiness;

  // Public store URL — derived from the tenant subdomain; null on localhost/dev.
  const storeHref = (() => {
    if (typeof window === 'undefined') return null;
    const label = window.location.hostname.split('.')[0];
    if (!label || ['localhost', 'www', 'app', '127'].includes(label) || /^\d+$/.test(label)) return null;
    return `${window.location.origin}/store/${label}`;
  })();
  const joinUrl = storeHref ? `${storeHref}?join=1` : null;

  useEffect(() => {
    // Only mint a real QR once every gate passes — never generate a scannable
    // code that would land a customer on a closed "coming soon" store.
    if (!joinUrl || !live) { setQr(null); return; }
    let alive = true;
    MarketplaceService.storefrontQr(wsId, joinUrl)
      .then((r) => { if (alive && r.success) setQr(r.data.qr_data_url); })
      .catch(() => {});
    return () => { alive = false; };
  }, [wsId, joinUrl, live]);

  const makePublic = async () => {
    const target = plans.find((p) => p.is_active) ?? plans[0];
    if (!target) { onCreatePlan(); return; }
    setBusy('public');
    try { await LoyaltyService.plans.update(wsId, target.id, { is_public: true, is_active: true }); reloadPlans(); }
    catch (e) { alert(apiError(e, 'Could not update the plan.')); }
    finally { setBusy(null); }
  };

  const enableSell = async () => {
    setBusy('sell');
    try { const r = await MarketplaceService.updateStorefront(wsId, { sell_memberships: true }); if (r.success) refreshSettings(); }
    catch (e) { alert(apiError(e, 'Could not update the storefront.')); }
    finally { setBusy(null); }
  };

  const copyLink = async () => {
    if (!joinUrl) return;
    try { await navigator.clipboard.writeText(joinUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { prompt('Copy this membership link:', joinUrl); }
  };

  // Map each unmet gate (already in dependency order) to this surface's
  // one-click fix. The gate list + order live in the shared helper; only the
  // actions are local.
  type Fix = { label: string; onClick?: () => void; href?: string; pending?: boolean };
  const fixForGate = (key: 'plan' | 'sell' | 'store'): Fix => {
    if (key === 'plan') return hasPlan
      ? { label: 'Make plan public', onClick: makePublic, pending: busy === 'public' }
      : { label: 'Create a plan', onClick: onCreatePlan };
    if (key === 'sell') return { label: 'Enable selling memberships', onClick: enableSell, pending: busy === 'sell' };
    return { label: 'Go live', href: `/w/${wsId}/marketplace/storefront` };
  };
  const missing = missingGates.map((g) => ({ text: g.text, fix: fixForGate(g.key) }));

  const FixButton = ({ fix }: { fix: Fix }) => fix.href ? (
    <Link href={fix.href} className="inline-flex items-center gap-1 rounded-lg bg-pink-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-pink-500">
      {fix.label} <ArrowRight className="h-3 w-3" />
    </Link>
  ) : (
    <button onClick={fix.onClick} disabled={fix.pending} className="inline-flex items-center gap-1 rounded-lg bg-pink-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-pink-500 disabled:opacity-50">
      {fix.pending ? 'Working…' : fix.label}
    </button>
  );

  return (
    <Card>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          {live
            ? <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300"><ShieldCheck className="h-3.5 w-3.5" /> Live on storefront</span>
            : <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-300"><AlertTriangle className="h-3.5 w-3.5" /> Not live yet</span>}
          <p className="mt-2 text-sm text-slate-300">
            {live
              ? 'Customers can scan your QR or open your store and join a plan in a tap.'
              : 'Your membership won’t appear on the public store until these are done:'}
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
            <Link href={`/w/${wsId}/marketplace/storefront`} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:bg-white/10">
              <ExternalLink className="h-3.5 w-3.5" /> Open storefront setup
            </Link>
            {/* Copy link only once live — never let the owner share a dead link. */}
            {live && joinUrl && (
              <button onClick={copyLink} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:bg-white/10">
                {copied ? <><Check className="h-3.5 w-3.5 text-emerald-300" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy membership link</>}
              </button>
            )}
          </div>
        </div>
        <div className="shrink-0">
          {live && joinUrl ? (
            // Live: a real, scannable QR.
            <div className="mx-auto flex h-[132px] w-[132px] items-center justify-center rounded-xl bg-white p-2.5 sm:mx-0">
              {qr ? <img src={qr} alt="Membership QR" className="h-[112px] w-[112px]" /> : <QrCode className="h-8 w-8 text-slate-300" />}
            </div>
          ) : (
            // Not live: a locked placeholder — NO scannable code until the gates
            // above pass, so a scan can never hit a "coming soon" store.
            <div className="mx-auto w-[160px] rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-4 text-center sm:mx-0">
              <Lock className="mx-auto h-6 w-6 text-slate-500" />
              <p className="mt-2 text-[11px] font-semibold text-slate-400">Membership QR not live yet</p>
              <p className="mt-1 text-[10px] text-slate-500">
                {joinUrl
                  ? 'Finish the steps on the left and your QR + link go live here.'
                  : 'Your membership QR appears on your live store domain.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
