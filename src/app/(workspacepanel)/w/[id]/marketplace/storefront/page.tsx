'use client';

import { useCallback, useEffect, useState, use as reactUse } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Globe, Package, Ticket, Gift, Star, CalendarDays, CalendarCheck, Users, ShoppingCart, Sparkles,
  QrCode, Download, Copy, Check,
} from 'lucide-react';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { MarketplaceService, type StorefrontSettingsRow, type IndustryCapabilities } from '@/services/marketplace.service';
import { PageHeader, Card, ErrorBox, Field, TextInput, apiError } from '@/components/accounting/kit';

function MarketplaceTabs({ wsId }: { wsId: string }) {
  const pathname = usePathname();
  const base = `/w/${wsId}/marketplace`;
  const tabs = [{ label: 'Listings', seg: '' }, { label: 'Storefront setup', seg: 'storefront' }];
  return (
    <nav className="flex flex-wrap gap-1 rounded-xl border border-white/5 bg-white/[0.02] p-1">
      {tabs.map((t) => {
        const href = t.seg ? `${base}/${t.seg}` : base;
        const active = t.seg ? pathname.startsWith(href) : pathname === base;
        return <Link key={t.label} href={href} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${active ? 'bg-pink-600 text-white' : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-200'}`}>{t.label}</Link>;
      })}
    </nav>
  );
}

const BOOKING_LABEL: Record<string, string> = {
  table: 'table reservations', room: 'room bookings', appointment: 'appointments',
  slot: 'time-slot bookings', inquiry: 'service inquiries', none: 'no bookings (cart checkout)',
};

export default function StorefrontSetupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard service="marketplace" required="marketplace.view" workspaceId={wsId} skeleton="form">
      <Inner wsId={wsId} />
    </PermissionGuard>
  );
}

function Inner({ wsId }: { wsId: string }) {
  const [s, setS] = useState<StorefrontSettingsRow | null>(null);
  const [caps, setCaps] = useState<IndustryCapabilities | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    MarketplaceService.getStorefront(wsId)
      .then((r) => { if (r.success) { setS(r.data); setCaps(r.data.capabilities ?? null); } else setError(r.message || 'Could not load.'); })
      .catch((e) => setError(apiError(e, 'Could not load storefront settings.')))
      .finally(() => setLoading(false));
  }, [wsId]);
  useEffect(() => { load(); }, [load]);

  const patch = async (changes: Partial<StorefrontSettingsRow>) => {
    if (!s) return;
    setSaving(true); setSaved(false);
    try {
      const r = await MarketplaceService.updateStorefront(wsId, changes);
      if (r.success) { setS(r.data); setCaps(r.data.capabilities ?? caps); setSaved(true); setTimeout(() => setSaved(false), 1500); }
      else alert(r.message || 'Could not save.');
    } catch (e) { alert(apiError(e, 'Could not save.')); }
    finally { setSaving(false); }
  };

  const [previewing, setPreviewing] = useState(false);

  const storeHref = (() => {
    if (typeof window === 'undefined') return null;
    const label = window.location.hostname.split('.')[0];
    if (!label || ['localhost', 'www', 'app', '127'].includes(label) || /^\d+$/.test(label)) return null;
    return `${window.location.origin}/store/${label}`;
  })();

  // Open the public store. When it's live (is_open) just open it; when it's a
  // draft, mint a short-lived signed preview token so the owner can see the
  // closed/draft store (only this workspace, public-safe fields only).
  const openPreview = async () => {
    if (!storeHref) return;
    if (s?.is_open) { window.open(storeHref, '_blank', 'noopener'); return; }
    setPreviewing(true);
    try {
      const r = await MarketplaceService.storefrontPreviewToken(wsId);
      if (r.success && r.data?.token) {
        window.open(`${storeHref}?preview=${encodeURIComponent(r.data.token)}`, '_blank', 'noopener');
      } else {
        alert(r.message || 'Could not start preview.');
      }
    } catch (e) { alert(apiError(e, 'Could not start preview.')); }
    finally { setPreviewing(false); }
  };

  const toggle = (key: keyof StorefrontSettingsRow, label: string, hint: string, recommended?: boolean) => (
    <label className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-3 cursor-pointer hover:bg-white/[0.04]">
      <input type="checkbox" checked={Boolean(s?.[key])} disabled={saving}
        onChange={(e) => patch({ [key]: e.target.checked } as Partial<StorefrontSettingsRow>)}
        className="mt-0.5 h-4 w-4 accent-pink-500" />
      <span>
        <span className="flex items-center gap-1.5 text-xs font-semibold text-white">{label}{recommended && <span className="rounded-full bg-emerald-400/15 text-emerald-300 px-1.5 text-[9px]">recommended</span>}</span>
        <span className="block text-[11px] text-slate-400">{hint}</span>
      </span>
    </label>
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Storefront setup"
        subtitle="Your public store, tailored to your industry."
        action={storeHref ? (
          <button onClick={openPreview} disabled={previewing} className="rounded-lg bg-pink-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-pink-500 disabled:opacity-50">
            {previewing ? 'Opening…' : s?.is_open ? 'Preview store ↗' : 'Preview draft ↗'}
          </button>
        ) : undefined}
      />
      <MarketplaceTabs wsId={wsId} />

      {loading ? <PageSkeleton kind="form" /> : error ? <ErrorBox message={error} onRetry={load} /> : s ? (
        <>
          {/* Industry banner */}
          {caps && (
            <Card>
              <div className="flex flex-wrap items-center gap-3 px-1">
                <span className="inline-flex items-center gap-2 rounded-full bg-pink-500/15 border border-pink-400/30 px-3 py-1 text-xs font-semibold text-pink-200">
                  <Sparkles className="h-3.5 w-3.5" /> {caps.industry}
                </span>
                <span className="text-[12px] text-slate-400">
                  {caps.show_cart ? 'Cart checkout' : 'Quote / booking'} · {BOOKING_LABEL[caps.booking_type] || caps.booking_type}
                  {caps.order_types.length > 0 && <> · {caps.order_types.join(', ')}</>}
                </span>
              </div>
              <p className="px-1 mt-2 text-[11px] text-slate-500">Your storefront features below are tailored to <strong className="text-slate-300">{caps.industry}</strong>. Change your industry in organization settings to retune them.</p>
            </Card>
          )}

          {/* Manage features — industry-aware grid */}
          {caps && (
            <Card>
              <h3 className="text-sm font-semibold text-white px-1 pb-3">Set up your storefront features</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <ManageCard icon={<Package className="h-5 w-5" />} title="Products / Listings" desc="What customers browse & buy." href={`/w/${wsId}/marketplace`} enabled />
                <ManageCard icon={<Ticket className="h-5 w-5" />} title="Deals & coupons" desc="Discount codes shown on the store." href={`/w/${wsId}/deals`} enabled={caps.deals_enabled} />
                <ManageCard icon={<Star className="h-5 w-5" />} title="Memberships" desc="Sell membership plans on the store." href={`/w/${wsId}/loyalty/plans`} enabled={caps.membership_enabled} />
                <ManageCard icon={<Gift className="h-5 w-5" />} title="Gift cards" desc="Issue & redeem prepaid balances." href={`/w/${wsId}/loyalty/gift-cards`} enabled={caps.gift_cards_enabled} />
                <ManageCard icon={<Sparkles className="h-5 w-5" />} title="Loyalty points" desc="Reward repeat customers." href={`/w/${wsId}/loyalty/accounts`} enabled={caps.affiliate_enabled || caps.membership_enabled} />
                <ManageCard icon={<CalendarDays className="h-5 w-5" />} title="Events" desc="Ticketed events & RSVPs." href={null} enabled={caps.events_enabled} planned />
                <ManageCard icon={<CalendarCheck className="h-5 w-5" />} title={`Bookings (${BOOKING_LABEL[caps.booking_type] || caps.booking_type})`} desc="Appointments / reservations." href={caps.booking_type !== 'none' ? `/w/${wsId}/marketplace/bookings` : null} enabled={caps.booking_type !== 'none'} />
                {(caps.booking_type === 'table' || caps.show_table_selection) && <ManageCard icon={<Users className="h-5 w-5" />} title="Tables" desc="Floor & table management." href={`/w/${wsId}/marketplace/tables`} enabled />}
              </div>
            </Card>
          )}

          {/* Visibility & orders */}
          <Card>
            <div className="flex items-center justify-between px-1 pb-3">
              <h3 className="text-sm font-semibold text-white">Visibility &amp; orders</h3>
              {saved && <span className="text-[11px] text-emerald-300">Saved</span>}
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {toggle('is_open', 'Open storefront', 'List this workspace + its published items publicly.')}
              {toggle('accept_orders', 'Accept orders', 'Allow anonymous shoppers to place orders.', caps?.show_cart)}
              {toggle('auto_fulfill', 'Auto-fulfil stock', 'Deduct inventory when an order is placed.')}
              {toggle('auto_invoice', 'Auto-invoice', 'Create + post an invoice to the ledger.')}
              {toggle('collect_payment', 'Collect payment', 'Record a received payment (COD / online).')}
              {(!caps || caps.membership_enabled) && toggle('sell_memberships', 'Sell memberships', 'Offer published membership plans on the storefront.', caps?.membership_enabled)}
              {(!caps || caps.gift_cards_enabled) && toggle('accept_gift_cards', 'Accept gift cards', 'Let shoppers redeem a gift-card code at checkout.')}
              {toggle('award_loyalty', 'Award loyalty points', 'Give points to the customer on each order.')}
            </div>
          </Card>

          {/* Storefront QR — scan to open the public store (+ join membership) */}
          {storeHref && s.is_open && (
            <StorefrontQRCard wsId={wsId} storeHref={storeHref} sellMemberships={Boolean(s.sell_memberships)} storeTitle={s.title} />
          )}

          {/* Presentation */}
          <Card>
            <h3 className="text-sm font-semibold text-white px-1 pb-3">Presentation</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Store title"><TextInput value={s.title} onChange={(e) => setS({ ...s, title: e.target.value })} onBlur={() => patch({ title: s.title })} /></Field>
              <Field label="Tagline"><TextInput value={s.tagline} onChange={(e) => setS({ ...s, tagline: e.target.value })} onBlur={() => patch({ tagline: s.tagline })} /></Field>
              <Field label="Currency"><TextInput value={s.currency} onChange={(e) => setS({ ...s, currency: e.target.value })} onBlur={() => patch({ currency: s.currency })} /></Field>
              <Field label="Loyalty points per 1 currency unit"><TextInput type="number" step="0.01" value={s.loyalty_points_per_unit} onChange={(e) => setS({ ...s, loyalty_points_per_unit: e.target.value })} onBlur={() => patch({ loyalty_points_per_unit: s.loyalty_points_per_unit })} /></Field>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}

function StorefrontQRCard({ wsId, storeHref, sellMemberships, storeTitle }: {
  wsId: string; storeHref: string; sellMemberships: boolean; storeTitle?: string;
}) {
  // When the business sells memberships, the QR deep-links into the store's
  // membership join section so a scan lands the customer straight on the plans.
  const targetUrl = sellMemberships ? `${storeHref}?join=1` : storeHref;
  const [qr, setQr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true); setErr(null);
    MarketplaceService.storefrontQr(wsId, targetUrl)
      .then((r) => { if (!alive) return; if (r.success) setQr(r.data.qr_data_url); else setErr(r.message || 'Could not generate QR.'); })
      .catch((e) => { if (alive) setErr(apiError(e, 'Could not generate QR.')); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [wsId, targetUrl]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(targetUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { prompt('Copy this link:', targetUrl); }
  };

  return (
    <Card>
      <div className="flex items-center gap-2 px-1 pb-3">
        <QrCode className="h-4 w-4 text-pink-300" />
        <h3 className="text-sm font-semibold text-white">{sellMemberships ? 'Membership QR' : 'Storefront QR'}</h3>
      </div>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="shrink-0 rounded-xl bg-white p-3 w-[176px] h-[176px] flex items-center justify-center mx-auto sm:mx-0">
          {loading ? <div className="h-8 w-8 rounded-full border-4 border-slate-200 border-t-pink-500 animate-spin" />
            : err ? <span className="text-[11px] text-red-500 text-center px-2">{err}</span>
            : qr ? <img src={qr} alt="Storefront QR code" width={150} height={150} className="h-[150px] w-[150px]" /> : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-slate-300">
            {sellMemberships
              ? 'Print or share this code. When a customer scans it, your public store opens straight on your membership plans — they can join in a tap.'
              : 'Print or share this code. Scanning it opens your public store on any phone.'}
          </p>
          <p className="mt-2 break-all rounded-lg border border-white/10 bg-white/[0.02] px-2 py-1.5 font-mono text-[11px] text-slate-400">{targetUrl}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={qr ?? '#'}
              download={`${(storeTitle || 'storefront').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-qr.png`}
              aria-disabled={!qr}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${qr ? 'bg-pink-600 text-white hover:bg-pink-500' : 'bg-white/5 text-slate-500 pointer-events-none'}`}
            >
              <Download className="h-3.5 w-3.5" /> Download PNG
            </a>
            <button onClick={copy} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10">
              {copied ? <><Check className="h-3.5 w-3.5 text-emerald-300" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy link</>}
            </button>
            <a href={targetUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10">
              <Globe className="h-3.5 w-3.5" /> Open store
            </a>
          </div>
        </div>
      </div>
    </Card>
  );
}

function ManageCard({ icon, title, desc, href, enabled, planned }: {
  icon: React.ReactNode; title: string; desc: string; href: string | null; enabled?: boolean; planned?: boolean;
}) {
  const body = (
    <div className={`h-full rounded-xl border p-4 transition-colors ${enabled ? 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]' : 'border-white/5 bg-white/[0.01] opacity-60'}`}>
      <div className="flex items-center gap-2 text-pink-300">{icon}<span className="text-sm font-semibold text-white">{title}</span></div>
      <p className="mt-1 text-[11px] text-slate-400">{desc}</p>
      <div className="mt-2 text-[10px]">
        {planned ? <span className="rounded-full bg-amber-400/15 text-amber-300 px-2 py-0.5">{enabled ? 'For your industry · coming soon' : 'planned'}</span>
          : enabled ? <span className="text-cyan-300">Manage →</span>
          : <span className="text-slate-600">Not typical for your industry</span>}
      </div>
    </div>
  );
  if (href && enabled && !planned) return <Link href={href}>{body}</Link>;
  return body;
}
