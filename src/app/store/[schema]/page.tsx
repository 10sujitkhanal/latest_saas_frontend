'use client';

import { useCallback, useEffect, useMemo, useState, use as reactUse } from 'react';
import {
  ShoppingBag, Plus, Minus, Tag, CheckCircle2, AlertTriangle,
  Store, Trash2, Sparkles, Gift, Star, CalendarCheck, CalendarDays, Briefcase,
} from 'lucide-react';
import { toast } from 'sonner';

/**
 * Public storefront — what a shopper sees at /store/<tenant-schema>. No auth.
 *
 * Loads the tenant's published listings + advertised coupons, lets the shopper
 * build a cart and place an order. The order POST runs the full internal loop
 * server-side (stock deduction → invoice → posted journal → payment), so the
 * business's books update the moment the shopper checks out.
 *
 * Mirrors the public booking page's conventions: 'use client', reactUse(params),
 * a plain publicFetch (no auth header, no 401-redirect interceptor) against the
 * shared per-tenant API base.
 */

import { resolveApiV1Base } from '@/lib/apiBase';

interface Listing {
  id: number;
  title: string;
  description: string;
  category: string;
  price: string;
  currency: string;
  image_url: string;
  is_featured: boolean;
  in_stock: boolean;
  workspace_id?: number;
}

interface Coupon {
  code: string;
  description: string;
  type: string;
  value: string;
  min_order_amount: string;
  max_discount: string | null;
  end_date: string | null;
}

interface OrderResult {
  order_no?: string;
  member_no?: string;
  plan?: string;
  booking_no?: string;
  service?: string;
  booking_type?: string;
  date?: string;
  is_inquiry?: boolean;
  rsvp_id?: number;
  event?: string;
  quantity?: number;
  free?: boolean;
  total?: string;
  amount?: string;
  subtotal?: string;
  discount?: string;
  gift_card_applied?: string;
  currency: string;
  invoice_no: string | null;
  payment_no: string | null;
  paid: boolean;
  on_account?: boolean;
  trade_account?: string | null;
  loyalty_points_awarded?: number;
}

interface MembershipPlan {
  id: number;
  name: string;
  description: string;
  price: string;
  currency: string;
  interval: string;
  benefits: string;
  workspace_id?: number;
}

interface StoreEvent {
  id: number;
  title: string;
  description: string;
  venue: string;
  starts_at: string | null;
  price: string;
  currency: string;
  seats_left: number | null;
  free: boolean;
}

interface Capabilities {
  industry: string;
  show_cart: boolean;
  booking_type: string;
  order_types: string[];
  mdx_search_filters: string[];
  requires_date_range?: boolean;
  requires_guest_count?: boolean;
}

const BOOKING_CTA: Record<string, string> = {
  table: 'Reserve a table', room: 'Check availability', appointment: 'Book appointment',
  slot: 'Book a slot', inquiry: 'Request a quote', none: '',
};

type View = 'loading' | 'shop' | 'success' | 'error';

async function publicFetch(path: string, init?: RequestInit) {
  const base = resolveApiV1Base();
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, ...data } as {
    status: number; ok: boolean; success?: boolean; data?: unknown; message?: string;
  };
}

function money(amount: string | number, currency: string) {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function StorefrontPage({ params }: { params: Promise<{ schema: string }> }) {
  const { schema } = reactUse(params);
  const [view, setView] = useState<View>('loading');
  const [error, setError] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState('');
  const [title, setTitle] = useState('');
  const [tagline, setTagline] = useState('');
  const [currency, setCurrency] = useState('NPR');
  const [workspaceId, setWorkspaceId] = useState<number | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [memberships, setMemberships] = useState<MembershipPlan[]>([]);
  const [events, setEvents] = useState<StoreEvent[]>([]);
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [accent, setAccent] = useState('#10b981');
  const [query, setQuery] = useState('');
  const [rsvpFor, setRsvpFor] = useState<StoreEvent | null>(null);
  const [rsvpQty, setRsvpQty] = useState('1');

  // Cart: listingId -> qty.
  const [cart, setCart] = useState<Record<number, number>>({});
  const [coupon, setCoupon] = useState('');
  const [giftCard, setGiftCard] = useState('');
  const [tradeCode, setTradeCode] = useState('');
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<OrderResult | null>(null);
  const [bookingFor, setBookingFor] = useState<Listing | null>(null);
  const [tableMode, setTableMode] = useState(false);
  const [bform, setBform] = useState({ date: '', end_date: '', start_time: '', party_size: '1', notes: '' });
  const [joinHighlight, setJoinHighlight] = useState(false);
  const [recs, setRecs] = useState<Listing[]>([]);

  // Deep link from the Membership QR: ?join=1 scrolls to + highlights the plans
  // once they've loaded so a scan lands the customer straight on memberships.
  useEffect(() => {
    if (typeof window === 'undefined' || memberships.length === 0) return;
    if (new URLSearchParams(window.location.search).get('join') !== '1') return;
    const el = document.getElementById('memberships');
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setJoinHighlight(true);
    const t = setTimeout(() => setJoinHighlight(false), 2400);
    return () => clearTimeout(t);
  }, [memberships.length]);

  // Load storefront + deals.
  useEffect(() => {
    let alive = true;
    (async () => {
      // Forward an owner ?preview=<token> so a draft/closed store renders.
      const previewToken = typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('preview') : null;
      const qs = previewToken ? `?preview=${encodeURIComponent(previewToken)}` : '';
      const r = await publicFetch(`/public/storefront/${encodeURIComponent(schema)}/${qs}`);
      if (!alive) return;
      if (r.ok && r.success && r.data) {
        const d = r.data as {
          tenant_name: string; storefronts: { workspace_id: number; title: string; tagline: string; currency: string }[];
          listings: Listing[]; memberships?: MembershipPlan[]; events?: StoreEvent[]; capabilities?: Capabilities;
          theme?: { accent?: string };
        };
        setTenantName(d.tenant_name);
        setListings(d.listings || []);
        setMemberships(d.memberships || []);
        setEvents(d.events || []);
        setCaps(d.capabilities || null);
        if (d.theme?.accent) setAccent(d.theme.accent);
        const sf = d.storefronts?.[0];
        if (sf) {
          setTitle(sf.title); setTagline(sf.tagline); setCurrency(sf.currency || 'NPR');
          setWorkspaceId(sf.workspace_id);
        }
        setView('shop');
      } else {
        setError(r.message || 'Storefront not found.');
        setView('error');
      }
    })().catch(() => { setError('Network error.'); setView('error'); });
    return () => { alive = false; };
  }, [schema]);

  useEffect(() => {
    publicFetch(`/public/storefront/${encodeURIComponent(schema)}/deals/`).then((r) => {
      if (r.ok && r.success && Array.isArray(r.data)) setCoupons(r.data as Coupon[]);
    }).catch(() => {});
  }, [schema]);

  const byId = useMemo(() => Object.fromEntries(listings.map((l) => [l.id, l])), [listings]);

  const subtotal = useMemo(
    () => Object.entries(cart).reduce((sum, [id, qty]) => {
      const l = byId[Number(id)];
      return sum + (l ? parseFloat(l.price) * qty : 0);
    }, 0),
    [cart, byId],
  );

  const cartCount = useMemo(() => Object.values(cart).reduce((a, b) => a + b, 0), [cart]);

  const showCart = caps?.show_cart ?? true;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return listings;
    return listings.filter((l) => l.title.toLowerCase().includes(q) || (l.category || '').toLowerCase().includes(q) || (l.description || '').toLowerCase().includes(q));
  }, [listings, query]);
  const bookingCta = caps && !showCart ? (BOOKING_CTA[caps.booking_type] || 'Enquire') : '';

  const add = useCallback((l: Listing) => {
    if (!l.in_stock) { toast.error('Out of stock.'); return; }
    setCart((c) => ({ ...c, [l.id]: (c[l.id] || 0) + 1 }));
  }, []);
  const dec = useCallback((id: number) => {
    setCart((c) => {
      const next = { ...c };
      const q = (next[id] || 0) - 1;
      if (q <= 0) delete next[id]; else next[id] = q;
      return next;
    });
  }, []);

  // Cross-sell: fetch recommendations as the cart changes (debounced). Empty
  // cart → "you may also like"; non-empty → "frequently bought together".
  const cartKey = useMemo(() => Object.keys(cart).map(Number).sort((a, b) => a - b).join(','), [cart]);
  useEffect(() => {
    if (!showCart) { setRecs([]); return; }
    let alive = true;
    const t = setTimeout(async () => {
      const qs = cartKey ? `?cart=${cartKey}` : '';
      const r = await publicFetch(`/public/storefront/${encodeURIComponent(schema)}/recommendations/${qs}`);
      if (alive && r.ok && r.success && r.data) setRecs(((r.data as { recommendations: Listing[] }).recommendations) || []);
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [cartKey, schema, showCart]);

  const checkout = useCallback(async () => {
    if (cartCount === 0) { toast.error('Your cart is empty.'); return; }
    if (!form.name.trim()) { toast.error('Please enter your name.'); return; }
    if (!form.email.trim() && !form.phone.trim()) { toast.error('Enter an email or phone.'); return; }
    const items = Object.entries(cart).map(([id, qty]) => ({ listing_id: Number(id), qty }));
    setSubmitting(true);
    try {
      const r = await publicFetch(`/public/storefront/${encodeURIComponent(schema)}/order/`, {
        method: 'POST',
        body: JSON.stringify({
          workspace_id: workspaceId || undefined,
          items,
          coupon_code: coupon.trim() || undefined,
          gift_card_code: giftCard.trim() || undefined,
          trade_account_code: tradeCode.trim() || undefined,
          customer: { name: form.name.trim(), email: form.email.trim() || undefined, phone: form.phone.trim() || undefined },
        }),
      });
      if (r.ok && r.success && r.data) {
        setResult(r.data as OrderResult);
        setView('success');
      } else {
        toast.error(r.message || 'Could not place the order.');
      }
    } finally { setSubmitting(false); }
  }, [cart, cartCount, form, coupon, giftCard, tradeCode, schema, workspaceId]);

  const subscribe = useCallback(async (plan: MembershipPlan) => {
    if (!form.name.trim()) { toast.error('Enter your name in the order panel first.'); return; }
    if (!form.email.trim() && !form.phone.trim()) { toast.error('Enter an email or phone in the order panel first.'); return; }
    if (!confirm(`Subscribe to ${plan.name} for ${money(plan.price, plan.currency)} (${plan.interval})?`)) return;
    setSubmitting(true);
    try {
      const r = await publicFetch(`/public/storefront/${encodeURIComponent(schema)}/subscribe/`, {
        method: 'POST',
        body: JSON.stringify({
          plan_id: plan.id,
          customer: { name: form.name.trim(), email: form.email.trim() || undefined, phone: form.phone.trim() || undefined },
        }),
      });
      if (r.ok && r.success && r.data) {
        setResult(r.data as OrderResult);
        setView('success');
      } else {
        toast.error(r.message || 'Could not subscribe.');
      }
    } finally { setSubmitting(false); }
  }, [form, schema]);

  const openBooking = useCallback((l: Listing) => {
    setBform({ date: '', end_date: '', start_time: '', party_size: '1', notes: '' });
    setTableMode(false);
    setBookingFor(l);
  }, []);

  const openTable = useCallback(() => {
    setBform({ date: '', end_date: '', start_time: '', party_size: '2', notes: '' });
    setBookingFor(null);
    setTableMode(true);
  }, []);

  const closeBooking = useCallback(() => { setBookingFor(null); setTableMode(false); }, []);

  const submitBooking = useCallback(async () => {
    if (!bookingFor && !tableMode) return;
    if (!form.name.trim()) { toast.error('Please enter your name.'); return; }
    if (!form.email.trim() && !form.phone.trim()) { toast.error('Enter an email or phone.'); return; }
    if (!bform.date) { toast.error('Pick a date.'); return; }
    setSubmitting(true);
    try {
      const r = await publicFetch(`/public/storefront/${encodeURIComponent(schema)}/book/`, {
        method: 'POST',
        body: JSON.stringify({
          workspace_id: workspaceId || undefined,
          listing_id: tableMode ? undefined : bookingFor?.id,
          booking: {
            booking_type: tableMode ? 'table' : caps?.booking_type,
            date: bform.date, end_date: bform.end_date || undefined,
            start_time: bform.start_time || undefined,
            party_size: Number(bform.party_size) || 1,
            service_name: tableMode ? 'Table reservation' : bookingFor?.title, notes: bform.notes || undefined,
          },
          customer: { name: form.name.trim(), email: form.email.trim() || undefined, phone: form.phone.trim() || undefined },
        }),
      });
      if (r.ok && r.success && r.data) { closeBooking(); setResult(r.data as OrderResult); setView('success'); }
      else toast.error(r.message || 'Could not book.');
    } finally { setSubmitting(false); }
  }, [bookingFor, tableMode, bform, form, caps, schema, workspaceId, closeBooking]);

  const openRsvp = useCallback((e: StoreEvent) => { setRsvpQty('1'); setRsvpFor(e); }, []);

  const submitRsvp = useCallback(async () => {
    if (!rsvpFor) return;
    if (!form.name.trim()) { toast.error('Please enter your name.'); return; }
    if (!form.email.trim() && !form.phone.trim()) { toast.error('Enter an email or phone.'); return; }
    setSubmitting(true);
    try {
      const r = await publicFetch(`/public/storefront/${encodeURIComponent(schema)}/rsvp/`, {
        method: 'POST',
        body: JSON.stringify({
          event_id: rsvpFor.id, quantity: Number(rsvpQty) || 1,
          customer: { name: form.name.trim(), email: form.email.trim() || undefined, phone: form.phone.trim() || undefined },
        }),
      });
      if (r.ok && r.success && r.data) { setRsvpFor(null); setResult(r.data as OrderResult); setView('success'); }
      else toast.error(r.message || 'Could not RSVP.');
    } finally { setSubmitting(false); }
  }, [rsvpFor, rsvpQty, form, schema]);

  if (view === 'loading') {
    return (
      <div className="min-h-screen bg-[#030712] text-slate-200 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-4 border-slate-700 border-t-emerald-500 animate-spin" />
          <span className="text-sm text-slate-500">Loading store…</span>
        </div>
      </div>
    );
  }
  if (view === 'error') {
    return (
      <div className="min-h-screen bg-[#030712] text-slate-200 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
          <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-red-300" />
          <h1 className="text-lg font-bold text-white">Store not available</h1>
          <p className="text-sm text-slate-400 mt-1">{error}</p>
        </div>
      </div>
    );
  }
  if (view === 'success' && result) {
    return (
      <div className="min-h-screen bg-[#06090f] text-slate-200 flex items-center justify-center p-6">
        <div className="max-w-lg w-full rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.04] p-8 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-white">{result.member_no ? 'You’re a member!' : result.rsvp_id ? (result.free ? 'You’re on the list!' : 'Tickets booked!') : result.booking_no ? (result.is_inquiry ? 'Request received!' : 'Booking confirmed!') : 'Order placed!'}</h1>
          <p className="text-sm text-slate-300 mt-1">Thank you for shopping with {title || tenantName}.</p>
          <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-left space-y-2 text-[13px]">
            {result.member_no && <Row label="Membership" value={`${result.member_no} (${result.plan})`} />}
            {result.rsvp_id && result.event && <Row label="Event" value={result.event} />}
            {result.rsvp_id && result.quantity !== undefined && <Row label="Tickets" value={String(result.quantity)} />}
            {result.booking_no && <Row label="Booking" value={result.booking_no} />}
            {result.booking_no && result.service && <Row label="Service" value={result.service} />}
            {result.booking_no && result.date && <Row label="Date" value={result.date} />}
            {result.order_no && <Row label="Order" value={result.order_no} />}
            {result.subtotal !== undefined && <Row label="Subtotal" value={money(result.subtotal, result.currency)} />}
            {result.discount !== undefined && parseFloat(result.discount) > 0 && <Row label="Discount" value={`- ${money(result.discount, result.currency)}`} />}
            {result.gift_card_applied !== undefined && parseFloat(result.gift_card_applied) > 0 && <Row label="Gift card" value={`- ${money(result.gift_card_applied, result.currency)}`} />}
            {(result.total ?? result.amount) !== undefined && parseFloat((result.total ?? result.amount) as string) > 0 && <Row label="Total" value={money((result.total ?? result.amount) as string, result.currency)} strong />}
            {result.invoice_no && <Row label="Invoice" value={result.invoice_no} />}
            {result.paid && result.payment_no && <Row label="Payment" value={`${result.payment_no} (recorded)`} />}
            {result.on_account && <Row label="Account" value={`On account ${result.trade_account || ''} — net terms`} />}
            {result.booking_no && result.is_inquiry && <Row label="Status" value="The business will contact you" />}
            {!!result.loyalty_points_awarded && <Row label="Points earned" value={`+${result.loyalty_points_awarded} ⭐`} />}
          </div>
          <button
            onClick={() => { setCart({}); setCoupon(''); setGiftCard(''); setResult(null); setView('shop'); }}
            className="mt-6 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold"
          >
            Continue shopping
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#06090f] text-slate-200">
      <div className="absolute inset-x-0 top-0 h-72" style={{ background: `radial-gradient(ellipse at top, ${accent}22, transparent 60%)` }} />
      <div className="relative max-w-6xl mx-auto px-4 py-10">
        {/* Themed hero */}
        <header className="mb-8 flex items-start gap-4 rounded-3xl border p-6"
          style={{ background: `linear-gradient(135deg, ${accent}1f, transparent 70%)`, borderColor: `${accent}33` }}>
          <div className="w-14 h-14 rounded-2xl border flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${accent}26`, borderColor: `${accent}55`, color: accent }}>
            <Store className="w-7 h-7" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white tracking-tight">{title || tenantName}</h1>
            {tagline && <p className="text-sm text-slate-300 mt-0.5">{tagline}</p>}
            {caps && <span className="mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
              style={{ backgroundColor: `${accent}1f`, border: `1px solid ${accent}55`, color: accent }}>{caps.industry}</span>}
          </div>
        </header>

        {listings.length > 0 && (
          <div className="mb-6">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products…"
              className="w-full max-w-md rounded-xl bg-[#0a1020] border border-white/[0.06] px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-400/60" />
            {caps && caps.mdx_search_filters.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {caps.mdx_search_filters.map((f) => (
                  <span key={f} className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-slate-400">{f.replace(/_/g, ' ')}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {caps?.booking_type === 'table' && (
          <button onClick={openTable} className="mb-6 inline-flex items-center gap-2 rounded-full bg-cyan-500 hover:bg-cyan-400 text-white text-sm font-semibold px-5 py-2.5">
            <CalendarCheck className="w-4 h-4" /> Reserve a table
          </button>
        )}

        {/* Coupons strip */}
        {coupons.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {coupons.map((c) => (
              <button
                key={c.code}
                onClick={() => { setCoupon(c.code); toast.success(`Coupon ${c.code} added.`); }}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/[0.06] px-3 py-1.5 text-[12.5px] text-emerald-200 hover:bg-emerald-500/[0.12]"
                title={c.description}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span className="font-semibold">{c.code}</span>
                <span className="text-emerald-300/70">{c.type === 'percent' ? `${c.value}% off` : `${money(c.value, currency)} off`}</span>
              </button>
            ))}
          </div>
        )}

        {/* Memberships */}
        {memberships.length > 0 && (
          <div id="memberships" className={`mb-8 scroll-mt-6 rounded-2xl transition-all duration-500 ${joinHighlight ? 'ring-2 ring-pink-400/70 ring-offset-4 ring-offset-[#06090f] p-3 -m-3' : ''}`}>
            <h2 className="text-sm font-semibold text-white mb-3 inline-flex items-center gap-2"><Star className="w-4 h-4 text-pink-300" /> Memberships</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {memberships.map((m) => (
                <div key={m.id} className="rounded-2xl border border-pink-400/20 bg-pink-500/[0.04] p-4 flex flex-col">
                  <div className="font-semibold text-white">{m.name}</div>
                  {m.description && <p className="text-[12px] text-slate-400 mt-1 line-clamp-2">{m.description}</p>}
                  {m.benefits && <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{m.benefits}</p>}
                  <div className="mt-auto pt-3 flex items-center justify-between">
                    <span className="text-base font-bold text-white">{money(m.price, m.currency)}<span className="text-[11px] font-normal text-slate-500">/{m.interval.replace('_', ' ')}</span></span>
                    <button onClick={() => subscribe(m)} disabled={submitting}
                      className="inline-flex items-center gap-1.5 rounded-full bg-pink-500 hover:bg-pink-400 disabled:opacity-50 text-white text-[13px] font-semibold px-4 py-2">
                      Subscribe
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-600 mt-2">Enter your name + email in the order panel, then Subscribe.</p>
          </div>
        )}

        {/* Events */}
        {events.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-white mb-3 inline-flex items-center gap-2"><CalendarDays className="w-4 h-4 text-amber-300" /> Upcoming events</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {events.map((e) => (
                <div key={e.id} className="rounded-2xl border border-amber-400/20 bg-amber-500/[0.04] p-4 flex flex-col">
                  <div className="font-semibold text-white">{e.title}</div>
                  <div className="text-[11px] text-amber-200/80 mt-0.5">{e.starts_at ? new Date(e.starts_at).toLocaleString() : ''}{e.venue ? ` · ${e.venue}` : ''}</div>
                  {e.description && <p className="text-[12px] text-slate-400 mt-1 line-clamp-2">{e.description}</p>}
                  <div className="mt-auto pt-3 flex items-center justify-between">
                    <span className="text-base font-bold text-white">{e.free ? 'Free' : money(e.price, e.currency)}{e.seats_left != null && <span className="text-[11px] font-normal text-slate-500"> · {e.seats_left} left</span>}</span>
                    <button onClick={() => openRsvp(e)} disabled={submitting || e.seats_left === 0}
                      className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white text-[13px] font-semibold px-4 py-2">
                      {e.seats_left === 0 ? 'Sold out' : e.free ? 'RSVP' : 'Get tickets'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {caps && !showCart && (
          <div className="mb-6 rounded-xl border border-cyan-400/20 bg-cyan-500/[0.05] px-4 py-3 text-[13px] text-cyan-200">
            This business takes <strong>{(BOOKING_CTA[caps.booking_type] || 'enquiries').toLowerCase()}</strong>. Browse below and reach out to book.
          </div>
        )}

        <div className={`grid grid-cols-1 gap-8 ${showCart ? 'lg:grid-cols-[1fr_340px]' : ''}`}>
          {/* Product grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filtered.length === 0 && (
              <div className="col-span-full text-center text-slate-500 py-16 text-sm">{listings.length === 0 ? 'No products available right now.' : 'No matches for your search.'}</div>
            )}
            {filtered.map((l) => (
              <div key={l.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-white">{l.title}</div>
                    {l.category && <div className="text-[11px] uppercase tracking-wider text-slate-500 mt-0.5">{l.category}</div>}
                  </div>
                  {l.is_featured && <span className="text-[10px] rounded-full bg-amber-400/15 text-amber-300 px-2 py-0.5 border border-amber-400/30">Featured</span>}
                </div>
                {l.description && <p className="text-[13px] text-slate-400 mt-2 line-clamp-2">{l.description}</p>}
                <div className="mt-auto pt-4 flex items-center justify-between">
                  <span className="text-lg font-bold text-white">{money(l.price, l.currency)}</span>
                  {!showCart ? (
                    <button onClick={() => openBooking(l)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500 hover:bg-cyan-400 text-white text-[13px] font-semibold px-4 py-2">
                      {bookingCta}
                    </button>
                  ) : cart[l.id] ? (
                    <div className="inline-flex items-center gap-2">
                      <button onClick={() => dec(l.id)} className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center"><Minus className="w-4 h-4" /></button>
                      <span className="w-6 text-center font-semibold">{cart[l.id]}</span>
                      <button onClick={() => add(l)} className="w-8 h-8 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center"><Plus className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <button
                      onClick={() => add(l)}
                      disabled={!l.in_stock}
                      style={l.in_stock ? { backgroundColor: accent } : undefined}
                      className="inline-flex items-center gap-1.5 rounded-full hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-slate-600 text-white text-[13px] font-semibold px-4 py-2"
                    >
                      <Plus className="w-4 h-4" /> {l.in_stock ? 'Add' : 'Sold out'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Cart / checkout */}
          {showCart && (
          <aside className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 h-fit lg:sticky lg:top-6">
            <div className="flex items-center gap-2 mb-4 text-white font-semibold">
              <ShoppingBag className="w-5 h-5 text-emerald-300" /> Your order
              {cartCount > 0 && <span className="ml-auto text-[12px] rounded-full bg-emerald-500/15 text-emerald-200 px-2 py-0.5">{cartCount} item{cartCount > 1 ? 's' : ''}</span>}
            </div>

            {cartCount === 0 ? (
              <p className="text-[13px] text-slate-500 py-6 text-center">Add products to get started.</p>
            ) : (
              <div className="space-y-2 mb-4">
                {Object.entries(cart).map(([id, qty]) => {
                  const l = byId[Number(id)];
                  if (!l) return null;
                  return (
                    <div key={id} className="flex items-center justify-between gap-2 text-[13px]">
                      <span className="text-slate-300 flex-1 truncate">{l.title} × {qty}</span>
                      <span className="text-slate-200">{money(parseFloat(l.price) * qty, l.currency)}</span>
                      <button onClick={() => dec(Number(id))} className="text-slate-500 hover:text-red-300"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="border-t border-white/[0.06] pt-4 space-y-3">
              <div className="relative">
                <Tag className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={coupon}
                  onChange={(e) => setCoupon(e.target.value)}
                  placeholder="Coupon code"
                  className="w-full rounded-xl bg-[#0a1020] border border-white/[0.06] pl-9 pr-3 py-2.5 text-[13.5px] text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-400/60"
                />
              </div>
              <div className="relative">
                <Gift className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={giftCard}
                  onChange={(e) => setGiftCard(e.target.value)}
                  placeholder="Gift card code"
                  className="w-full rounded-xl bg-[#0a1020] border border-white/[0.06] pl-9 pr-3 py-2.5 text-[13.5px] text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-400/60"
                />
              </div>
              {caps?.industry === 'Supplier / Wholesale' && (
                <div className="relative">
                  <Briefcase className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    value={tradeCode}
                    onChange={(e) => setTradeCode(e.target.value)}
                    placeholder="Trade account code (wholesale)"
                    className="w-full rounded-xl bg-[#0a1020] border border-white/[0.06] pl-9 pr-3 py-2.5 text-[13.5px] text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-400/60"
                  />
                </div>
              )}
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name *" className={ipt} />
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className={ipt} />
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone" className={ipt} />

              <div className="flex items-center justify-between text-[13px] pt-1">
                <span className="text-slate-400">Subtotal</span>
                <span className="text-white font-semibold">{money(subtotal, currency)}</span>
              </div>
              {coupon && <p className="text-[11px] text-emerald-300/80">Coupon {coupon} will be validated at checkout.</p>}

              <button
                onClick={checkout}
                disabled={submitting || cartCount === 0}
                style={{ backgroundColor: accent }}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full hover:opacity-90 text-white text-sm font-semibold disabled:opacity-50"
              >
                {submitting ? 'Placing order…' : 'Place order'}
              </button>
            </div>
          </aside>
          )}
        </div>

        {/* Cross-sell rail */}
        {showCart && recs.filter((r) => !cart[r.id]).length > 0 && (
          <div className="mt-12">
            <h2 className="text-sm font-semibold text-white mb-3 inline-flex items-center gap-2">
              <Sparkles className="w-4 h-4" style={{ color: accent }} />
              {cartCount > 0 ? 'Frequently bought together' : 'You may also like'}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {recs.filter((r) => !cart[r.id]).slice(0, 4).map((l) => (
                <div key={l.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 flex flex-col">
                  <div className="font-semibold text-white text-sm line-clamp-1">{l.title}</div>
                  {l.category && <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-0.5">{l.category}</div>}
                  {l.description && <p className="text-[12px] text-slate-400 mt-1 line-clamp-2">{l.description}</p>}
                  <div className="mt-auto pt-3 flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-white">{money(l.price, l.currency)}</span>
                    <button
                      onClick={() => add(l)}
                      disabled={!l.in_stock}
                      style={l.in_stock ? { backgroundColor: accent } : undefined}
                      className="inline-flex items-center gap-1 rounded-full hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-slate-600 text-white text-[12px] font-semibold px-3 py-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" /> {l.in_stock ? 'Add' : 'Sold out'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-10 text-center text-[10px] text-slate-600">Powered by Merkoll Storefront</div>
      </div>

      {/* Booking modal (booking industries + restaurant table reservations) */}
      {(bookingFor || tableMode) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={closeBooking}>
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0b1322] p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white">{tableMode ? 'Reserve a table' : (bookingCta || 'Book')}</h3>
            <p className="text-sm text-slate-300 mt-0.5">
              {tableMode ? 'Pick a date, time & party size.' : <>{bookingFor?.title}{bookingFor && parseFloat(bookingFor.price) > 0 && <> · <span className="font-semibold">{money(bookingFor.price, bookingFor.currency)}</span></>}</>}
            </p>
            <div className="mt-4 space-y-3">
              <label className="block text-[11px] text-slate-400">{!tableMode && caps?.requires_date_range ? 'Check-in date' : 'Date'}
                <input type="date" value={bform.date} onChange={(e) => setBform({ ...bform, date: e.target.value })} className={ipt} />
              </label>
              {!tableMode && caps?.requires_date_range && (
                <label className="block text-[11px] text-slate-400">Check-out date
                  <input type="date" value={bform.end_date} onChange={(e) => setBform({ ...bform, end_date: e.target.value })} className={ipt} />
                </label>
              )}
              {(tableMode || caps?.booking_type === 'appointment' || caps?.booking_type === 'slot') && (
                <label className="block text-[11px] text-slate-400">Time
                  <input type="time" value={bform.start_time} onChange={(e) => setBform({ ...bform, start_time: e.target.value })} className={ipt} />
                </label>
              )}
              {(tableMode || caps?.requires_guest_count) && (
                <label className="block text-[11px] text-slate-400">Guests / party size
                  <input type="number" min={1} value={bform.party_size} onChange={(e) => setBform({ ...bform, party_size: e.target.value })} className={ipt} />
                </label>
              )}
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name *" className={ipt} />
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className={ipt} />
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone" className={ipt} />
              <textarea value={bform.notes} onChange={(e) => setBform({ ...bform, notes: e.target.value })} placeholder="Notes (optional)" rows={2} className={`${ipt} resize-none`} />
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={closeBooking} className="rounded-full border border-white/10 px-4 py-2 text-[13px] text-slate-300 hover:bg-white/10">Cancel</button>
                <button onClick={submitBooking} disabled={submitting} className="rounded-full bg-cyan-500 hover:bg-cyan-400 text-white text-[13px] font-semibold px-5 py-2 disabled:opacity-50">{submitting ? 'Booking…' : (tableMode ? 'Reserve table' : `Confirm ${bookingCta || 'booking'}`)}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Event RSVP modal */}
      {rsvpFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setRsvpFor(null)}>
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0b1322] p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white">{rsvpFor.free ? 'RSVP' : 'Get tickets'}</h3>
            <p className="text-sm text-slate-300 mt-0.5">{rsvpFor.title}{!rsvpFor.free && <> · <span className="font-semibold">{money(rsvpFor.price, rsvpFor.currency)}</span> each</>}</p>
            {rsvpFor.starts_at && <p className="text-[11px] text-amber-200/80 mt-0.5">{new Date(rsvpFor.starts_at).toLocaleString()}{rsvpFor.venue ? ` · ${rsvpFor.venue}` : ''}</p>}
            <div className="mt-4 space-y-3">
              <label className="block text-[11px] text-slate-400">Quantity
                <input type="number" min={1} value={rsvpQty} onChange={(e) => setRsvpQty(e.target.value)} className={ipt} />
              </label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name *" className={ipt} />
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className={ipt} />
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone" className={ipt} />
              {!rsvpFor.free && <p className="text-[12px] text-slate-400">Total: <span className="font-semibold text-white">{money((parseFloat(rsvpFor.price) * (Number(rsvpQty) || 1)).toFixed(2), rsvpFor.currency)}</span></p>}
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setRsvpFor(null)} className="rounded-full border border-white/10 px-4 py-2 text-[13px] text-slate-300 hover:bg-white/10">Cancel</button>
                <button onClick={submitRsvp} disabled={submitting} className="rounded-full bg-amber-500 hover:bg-amber-400 text-white text-[13px] font-semibold px-5 py-2 disabled:opacity-50">{submitting ? 'Confirming…' : (rsvpFor.free ? 'Confirm RSVP' : 'Buy tickets')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const ipt = 'w-full rounded-xl bg-[#0a1020] border border-white/[0.06] px-3 py-2.5 text-[13.5px] text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-400/60';

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] uppercase tracking-wider text-slate-500">{label}</span>
      <span className={strong ? 'text-white font-bold' : 'text-slate-200 font-semibold'}>{value}</span>
    </div>
  );
}
