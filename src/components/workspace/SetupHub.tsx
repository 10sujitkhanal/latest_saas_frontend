'use client';

/**
 * Owner-facing "Get started" Setup Hub.
 *
 * Renders the real-data setup cards returned by
 * `GET /organization/workspaces/<id>/setup-hub/` — each card is Live / Action
 * needed / Optional, lists the SPECIFIC missing requirements, and deep-links to
 * the one-click fix. Nothing here writes or fabricates progress; it only mirrors
 * actual tenant data and points the owner at the right page.
 *
 * The goal picker is a client-side emphasis layer (persisted per workspace in
 * localStorage): the owner declares what they're here to do, and the hub
 * surfaces the matching cards first. It never changes server state.
 *
 * MVP = wellness (Layer 1). The card engine is industry-configured on the
 * backend, so other verticals reuse this exact component later.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  MapPin, Store, Package, BadgeCheck, CalendarClock, Ticket,
  Wallet, Users, Building2, Circle, CheckCircle2, AlertTriangle,
  Sparkles, ArrowRight, Target, ShoppingCart, CalendarDays, Boxes, PlusCircle,
} from 'lucide-react';
import { Skeleton } from '@/components/workspace/Skeleton';
import { useAuthStore, hasPermission } from '@/store/authStore';

// Per-card permission gate. A setup card is only shown to a staff member whose
// workspace role grants the matching permission — so a Front-Desk or Accountant
// doesn't see "set up your storefront / products". Admins/owners carry the '*'
// wildcard, so they see everything. Keys with no entry here are always shown
// (safe default for future foundational cards). Codes are real rbac codes.
const CARD_PERMISSION: Record<string, string> = {
  store_address: 'marketplace.storefront',
  storefront: 'marketplace.storefront',
  products: 'inventory.view',
  inventory: 'inventory.view',
  orders: 'orders.view',
  wholesale: 'orders.view',
  memberships: 'loyalty.view',
  coupons_loyalty: 'deals.view',
  bookings: 'scheduling.view',
  events: 'marketplace.view',
  payments: 'accounting.view',
  team: 'staff.view',
  upsells: 'marketplace.edit',
  addons: 'marketplace.edit',
};

export interface SetupCardData {
  key: string;
  label: string;
  status: 'live' | 'not_live' | 'optional';
  missing: string[];
  primary_action: { label: string; href: string } | null;
}

export interface SetupHubData {
  industry: string;
  items: SetupCardData[];
  live: number;
  total: number;
  all_live: boolean;
}

// Per-card icon. Falls back to a circle for any future card key.
const CARD_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  store_address: MapPin,
  storefront: Store,
  products: Package,
  memberships: BadgeCheck,
  bookings: CalendarClock,
  coupons_loyalty: Ticket,
  payments: Wallet,
  team: Users,
  wholesale: Building2,
  orders: ShoppingCart,
  events: CalendarDays,
  inventory: Boxes,
  upsells: PlusCircle,
  addons: PlusCircle,
};

// Goals the owner can declare. Each maps to the card keys it depends on, so we
// can surface "the cards for what you're trying to do" first. Foundational
// cards (store_address, storefront, payments) always show regardless.
interface Goal { id: string; label: string; cards: string[] }
const WELLNESS_GOALS: Goal[] = [
  { id: 'retail', label: 'Sell products online', cards: ['storefront', 'products', 'payments'] },
  { id: 'memberships', label: 'Offer memberships & packages', cards: ['memberships', 'payments'] },
  { id: 'consults', label: 'Offer 1:1 consultations', cards: ['bookings', 'payments'] },
  { id: 'loyalty', label: 'Reward & retain clients', cards: ['coupons_loyalty'] },
  { id: 'wholesale', label: 'Sell wholesale (B2B)', cards: ['wholesale'] },
  { id: 'team', label: 'Grow my team', cards: ['team'] },
];
const ALWAYS_SHOW = new Set(['store_address', 'storefront', 'payments']);

function goalsForIndustry(industry: string): Goal[] {
  // The goal chips are tuned for wellness; other industries show the cards
  // without a (mismatched) goal picker until their own goals are defined.
  return (industry || '').toLowerCase().startsWith('wellness') ? WELLNESS_GOALS : [];
}

const STATUS_BADGE: Record<SetupCardData['status'], { label: string; cls: string }> = {
  live: { label: 'Live', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  not_live: { label: 'Action needed', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  optional: { label: 'Optional', cls: 'bg-white/[0.04] text-slate-400 border-white/10' },
};

export function SetupCard({ card, workspaceId, dimmed }: {
  card: SetupCardData; workspaceId: string; dimmed?: boolean;
}) {
  const CardIcon = CARD_ICONS[card.key] ?? Circle;
  const badge = STATUS_BADGE[card.status];
  const isLive = card.status === 'live';

  return (
    <div
      className={`relative rounded-2xl border p-4 transition-colors ${
        isLive
          ? 'border-emerald-500/20 bg-emerald-500/[0.03]'
          : card.status === 'not_live'
            ? 'border-amber-500/25 bg-amber-500/[0.03]'
            : 'border-white/5 bg-white/[0.02]'
      } ${dimmed ? 'opacity-45' : ''}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            isLive ? 'bg-emerald-500/15 text-emerald-300'
              : card.status === 'not_live' ? 'bg-amber-500/15 text-amber-300'
              : 'bg-white/[0.04] text-slate-400'
          }`}
        >
          <CardIcon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white truncate">{card.label}</h3>
            {isLive && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300 shrink-0" />}
          </div>
          <span className={`mt-1 inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-semibold uppercase tracking-wide ${badge.cls}`}>
            {badge.label}
          </span>
        </div>
      </div>

      {/* What's missing — only when there's something to fix/know. */}
      {card.missing.length > 0 && (
        <ul className="mt-3 space-y-1">
          {card.missing.map((m, i) => (
            <li key={i} className="flex items-start gap-1.5 text-[12px] text-slate-400">
              <AlertTriangle className={`w-3 h-3 mt-0.5 shrink-0 ${card.status === 'optional' ? 'text-slate-500' : 'text-amber-400'}`} />
              <span>{m}</span>
            </li>
          ))}
        </ul>
      )}

      {/* One-click fix / deep-link. */}
      {card.primary_action && (
        <Link
          href={`/w/${workspaceId}${card.primary_action.href}`}
          className={`mt-3 inline-flex items-center gap-1 text-[12px] font-semibold ${
            isLive ? 'text-slate-300 hover:text-white' : 'text-emerald-300 hover:text-emerald-200'
          }`}
        >
          {card.primary_action.label} <ArrowRight className="w-3 h-3" />
        </Link>
      )}
    </div>
  );
}

function SetupGoalPicker({ goals, selected, onToggle }: {
  goals: Goal[]; selected: Set<string>; onToggle: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-500 font-semibold mr-1">
        <Target className="w-3.5 h-3.5" /> I want to
      </span>
      {goals.map((g) => {
        const on = selected.has(g.id);
        return (
          <button
            key={g.id}
            type="button"
            onClick={() => onToggle(g.id)}
            className={`px-3 py-1.5 rounded-full border text-[12px] font-medium transition-colors ${
              on
                ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
                : 'border-white/10 bg-white/[0.02] text-slate-300 hover:bg-white/[0.05]'
            }`}
          >
            {g.label}
          </button>
        );
      })}
    </div>
  );
}

export function SetupHub({ data, workspaceId }: { data: SetupHubData | null; workspaceId: string }) {
  const storageKey = `setupGoals:${workspaceId}`;
  const permissionCodes = useAuthStore((s) => s.permissionCodes);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setSelected(new Set(JSON.parse(raw)));
    } catch { /* ignore */ }
    setHydrated(true);
  }, [storageKey]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      try { localStorage.setItem(storageKey, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  };

  const goals = data ? goalsForIndustry(data.industry) : [];

  // Cards relevant to the picked goals (+ always-show foundations). With no
  // goal picked, every card is "relevant" so nothing is dimmed.
  const relevant = useMemo(() => {
    if (selected.size === 0) return null;
    const keys = new Set<string>(ALWAYS_SHOW);
    for (const g of goals) if (selected.has(g.id)) g.cards.forEach((c) => keys.add(c));
    return keys;
  }, [selected, goals]);

  if (!data) {
    return (
      <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
        <Skeleton height={14} width={200} className="mb-3" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} height={92} />)}
        </div>
      </div>
    );
  }

  const pct = data.total > 0 ? Math.round((data.live / data.total) * 100) : 100;

  // Render in the backend's deliberate JOURNEY order (address → storefront →
  // products → payments → memberships → coupons → consults → team → wholesale).
  // We do NOT re-sort by status: a stable, predictable sequence reads better
  // than cards jumping around as things go live. Status stays obvious through
  // color + checkmark, and the goal picker only DIMS non-relevant cards.
  //
  // Permission gate: a staff member only sees the setup cards their workspace
  // role can actually act on (owners/admins carry '*', so they see all). If a
  // role grants none of them, the whole hub is hidden rather than teasing
  // features they can't touch.
  const items = data.items.filter((card) => {
    const code = CARD_PERMISSION[card.key];
    return !code || hasPermission(permissionCodes, code);
  });
  if (items.length === 0) return null;

  return (
    <section className={`rounded-2xl border p-5 ${
      data.all_live
        ? 'border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 via-cyan-500/5 to-transparent'
        : 'border-emerald-500/15 bg-gradient-to-br from-emerald-500/[0.05] via-white/[0.01] to-transparent'
    }`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
            data.all_live
              ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
              : 'bg-emerald-500/15 border-emerald-500/25 text-emerald-300'
          }`}>
            {data.all_live ? <CheckCircle2 className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">
              {data.all_live ? 'Your store is fully set up' : 'Get your store ready'}
            </h2>
            <p className="text-[12px] text-slate-300 mt-0.5">
              {data.all_live
                ? 'Every essential is live. Optional add-ons below whenever you want them.'
                : <>{data.live} of {data.total} essentials live — finish the rest to start selling.</>}
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-2xl font-bold text-white tabular-nums">{pct}%</div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Ready</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden mb-4">
        <div className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all" style={{ width: `${pct}%` }} />
      </div>

      {/* Goal picker — emphasis only, persisted per workspace. */}
      {hydrated && goals.length > 0 && (
        <div className="mb-4">
          <SetupGoalPicker goals={goals} selected={selected} onToggle={toggle} />
        </div>
      )}

      {/* Card grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((card) => (
          <SetupCard
            key={card.key}
            card={card}
            workspaceId={workspaceId}
            dimmed={!!relevant && !relevant.has(card.key)}
          />
        ))}
      </div>
    </section>
  );
}
