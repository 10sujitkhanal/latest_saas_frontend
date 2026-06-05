"use client";

import { useState } from "react";
import Link from "next/link";
import { Crown, CheckCircle2, Users, X, ArrowRight, Sparkles } from "lucide-react";
import type { MdxBusiness } from "@/lib/moredealsx/types";

interface Tier {
  name: string;
  price: number;
  highlight: string;
  benefits: string[];
  badge: string;
  textColor: string;
  border: string;
  bg: string;
}

const TIERS_BY_INDUSTRY: Record<string, Tier[]> = {
  Hotel: [
    { name: "Bronze", price: 0, highlight: "5% off F&B + birthday dessert", badge: "bg-amber-100 text-amber-700", textColor: "text-amber-700", border: "border-amber-200", bg: "bg-amber-50", benefits: ["5% off food & beverages", "Birthday dessert", "Early check-in request", "Member newsletter"] },
    { name: "Silver", price: 8, highlight: "5% off rooms + priority check-in", badge: "bg-slate-100 text-slate-600", textColor: "text-slate-600", border: "border-slate-200", bg: "bg-slate-50", benefits: ["5% off room bookings", "Priority check-in", "Breakfast 20% off", "Late checkout 1 PM"] },
    { name: "Gold", price: 18, highlight: "10% off + free breakfast + spa credit", badge: "bg-yellow-100 text-yellow-700", textColor: "text-yellow-700", border: "border-yellow-200", bg: "bg-yellow-50", benefits: ["10% off all bookings", "Free breakfast daily", "Late checkout 2 PM", "$20 spa credit/month", "Room upgrade when available"] },
  ],
  Restaurant: [
    { name: "Bronze", price: 0, highlight: "Birthday month discount + news", badge: "bg-amber-100 text-amber-700", textColor: "text-amber-700", border: "border-amber-200", bg: "bg-amber-50", benefits: ["Birthday month 20% off", "Members newsletter", "New menu previews"] },
    { name: "Silver", price: 5, highlight: "10% off + free delivery always", badge: "bg-slate-100 text-slate-600", textColor: "text-slate-600", border: "border-slate-200", bg: "bg-slate-50", benefits: ["10% off all orders", "Free delivery always", "Priority seating", "2× loyalty points"] },
    { name: "Gold", price: 12, highlight: "15% off + 1 free main dish/month", badge: "bg-yellow-100 text-yellow-700", textColor: "text-yellow-700", border: "border-yellow-200", bg: "bg-yellow-50", benefits: ["15% off all orders", "Free delivery always", "1 free main dish/month", "Chef's table access", "Invite-only tasting events"] },
  ],
  "Salon / Spa": [
    { name: "Bronze", price: 0, highlight: "5% off + birthday bonus treatment", badge: "bg-amber-100 text-amber-700", textColor: "text-amber-700", border: "border-amber-200", bg: "bg-amber-50", benefits: ["5% off all services", "Birthday bonus treatment", "Member newsletter"] },
    { name: "Silver", price: 8, highlight: "10% off + priority booking slots", badge: "bg-slate-100 text-slate-600", textColor: "text-slate-600", border: "border-slate-200", bg: "bg-slate-50", benefits: ["10% off all services", "Priority booking slots", "SMS appointment reminders", "Product discounts 10%"] },
    { name: "Gold", price: 18, highlight: "20% off + 1 free treatment/month", badge: "bg-yellow-100 text-yellow-700", textColor: "text-yellow-700", border: "border-yellow-200", bg: "bg-yellow-50", benefits: ["20% off all services", "1 free treatment/month", "Skip-the-queue priority", "Dedicated stylist", "Exclusive Gold events"] },
  ],
  "Trekking / Travel": [
    { name: "Bronze", price: 0, highlight: "Trail newsletter + 5% gear discount", badge: "bg-amber-100 text-amber-700", textColor: "text-amber-700", border: "border-amber-200", bg: "bg-amber-50", benefits: ["Trail condition newsletter", "5% off gear rentals", "Community trek invites"] },
    { name: "Silver", price: 10, highlight: "10% off packages + free gear", badge: "bg-slate-100 text-slate-600", textColor: "text-slate-600", border: "border-slate-200", bg: "bg-slate-50", benefits: ["10% off all packages", "Free walking sticks", "Priority group spot booking"] },
    { name: "Gold", price: 20, highlight: "15% off + guide upgrade + custom routes", badge: "bg-yellow-100 text-yellow-700", textColor: "text-yellow-700", border: "border-yellow-200", bg: "bg-yellow-50", benefits: ["15% off all packages", "Free guide upgrade", "Custom route planning", "Emergency support priority", "Members-only trails"] },
  ],
  Retail: [
    { name: "Bronze", price: 0, highlight: "5% off + early access to arrivals", badge: "bg-amber-100 text-amber-700", textColor: "text-amber-700", border: "border-amber-200", bg: "bg-amber-50", benefits: ["5% off all purchases", "New arrivals newsletter", "Birthday bonus voucher"] },
    { name: "Silver", price: 6, highlight: "15% off + early sale access", badge: "bg-slate-100 text-slate-600", textColor: "text-slate-600", border: "border-slate-200", bg: "bg-slate-50", benefits: ["15% off all clothing", "Early sale access 48 hrs", "Free alterations", "Trek gear bundle deals"] },
  ],
};

const DEFAULT_TIERS: Tier[] = [
  { name: "Bronze", price: 0, highlight: "Member discounts + exclusive offers", badge: "bg-amber-100 text-amber-700", textColor: "text-amber-700", border: "border-amber-200", bg: "bg-amber-50", benefits: ["Member discounts", "Exclusive offers", "Birthday bonus"] },
  { name: "Gold", price: 10, highlight: "Full benefits + priority service", badge: "bg-yellow-100 text-yellow-700", textColor: "text-yellow-700", border: "border-yellow-200", bg: "bg-yellow-50", benefits: ["Priority service", "10% off everything", "Monthly reward", "Exclusive events"] },
];

const MOCK_MEMBER_COUNT: Record<string, number> = {
  "lakeside-grand-hotel": 234,
  "pokhara-food-house": 312,
  "glow-beauty-salon": 189,
  "himalayan-trekking-nepal": 143,
  "urban-style-clothing": 97,
};

interface JoinForm { name: string; email: string; }

export function BusinessMembershipPanel({ business }: { business: MdxBusiness }) {
  const tiers = TIERS_BY_INDUSTRY[business.industry] ?? DEFAULT_TIERS;
  const memberCount = MOCK_MEMBER_COUNT[business.slug] ?? 74;

  const [selectedTier, setSelectedTier] = useState(0);
  const [showJoin, setShowJoin] = useState(false);
  const [joinDone, setJoinDone] = useState(false);
  const [joinedTier, setJoinedTier] = useState<Tier | null>(null);
  const [form, setForm] = useState<JoinForm>({ name: "", email: "" });

  const canJoin = form.name.trim().length >= 2 && form.email.includes("@");

  const confirmJoin = () => {
    setJoinedTier(tiers[selectedTier]);
    setJoinDone(true);
    setShowJoin(false);
  };

  if (joinDone && joinedTier) {
    return (
      <div className="rounded-2xl border border-purple-200 bg-purple-50 p-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-purple-100">
          <Crown className="h-6 w-6 text-purple-600" />
        </div>
        <h3 className="font-bold text-slate-900">You're a {joinedTier.name} member!</h3>
        <p className="text-sm text-slate-500 mt-1">Your membership at <strong>{business.name}</strong> is now active.</p>
        <div className="mt-3 flex gap-2 justify-center">
          <Link href="/moredealsx/memberships/my"
            className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-700">
            <Crown className="h-3.5 w-3.5" /> My Memberships
          </Link>
          <Link href="/moredealsx/memberships"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:border-purple-300">
            Discover more
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-2xl border border-purple-200 bg-gradient-to-br from-slate-900 to-purple-950 p-6 text-white">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Crown className="h-5 w-5 text-yellow-400" />
              <span className="font-bold text-lg">Join {business.name} Club</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-400">
              <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{memberCount} members</span>
              <span>{tiers.length} tiers available</span>
            </div>
          </div>
          <Link href="/moredealsx/memberships" className="text-xs text-purple-300 hover:text-white flex items-center gap-1">
            Browse all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Tier selector */}
        <div className="flex gap-2 mb-4">
          {tiers.map((tier, i) => (
            <button key={tier.name} onClick={() => setSelectedTier(i)}
              className={`flex-1 rounded-xl border-2 py-2 text-xs font-bold transition-all ${selectedTier === i ? "border-yellow-400 bg-yellow-400/10 text-yellow-300" : "border-white/10 text-white/60 hover:border-white/30"}`}>
              {tier.name}
              <div className="font-normal opacity-80">{tier.price === 0 ? "Free" : `$${tier.price}/mo`}</div>
            </button>
          ))}
        </div>

        {/* Selected tier card */}
        <div className={`rounded-xl border p-4 mb-4 ${tiers[selectedTier].border} ${tiers[selectedTier].bg}`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-bold ${tiers[selectedTier].textColor}`}>{tiers[selectedTier].name} — {tiers[selectedTier].highlight}</span>
            {tiers[selectedTier].price === 0
              ? <span className="text-xs font-bold text-emerald-600">Free forever</span>
              : <span className={`text-sm font-extrabold ${tiers[selectedTier].textColor}`}>${tiers[selectedTier].price}/mo</span>}
          </div>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {tiers[selectedTier].benefits.map((b) => (
              <div key={b} className="flex items-center gap-1.5 text-xs text-slate-700">
                <CheckCircle2 className={`h-3.5 w-3.5 flex-shrink-0 ${tiers[selectedTier].textColor}`} />{b}
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={() => setShowJoin(true)}
            className="flex-1 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-500 py-3 text-sm font-extrabold text-slate-900 hover:from-yellow-300">
            {tiers[selectedTier].price === 0 ? "Join Free — Instant" : `Start Free Trial`}
          </button>
          <Link href="/moredealsx/memberships/my"
            className="rounded-xl border border-white/20 px-4 py-3 text-xs font-semibold text-white hover:bg-white/10">
            My memberships
          </Link>
        </div>

        {tiers[selectedTier].price > 0 && (
          <p className="mt-2 text-center text-xs text-slate-400">First month free · Cancel anytime from MoreDealsX</p>
        )}
      </div>

      {/* Join modal */}
      {showJoin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowJoin(false); }}>
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-slate-800 to-purple-900 px-5 py-4 text-white flex items-center justify-between">
              <div>
                <h2 className="font-bold">Join {business.name}</h2>
                <p className="text-xs text-purple-300">{tiers[selectedTier].name} tier · {tiers[selectedTier].price === 0 ? "Free" : `$${tiers[selectedTier].price}/mo`}</p>
              </div>
              <button onClick={() => setShowJoin(false)}><X className="h-5 w-5 text-purple-300" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className={`rounded-xl border p-3 ${tiers[selectedTier].border} ${tiers[selectedTier].bg}`}>
                <p className={`text-xs font-bold mb-1.5 ${tiers[selectedTier].textColor}`}>{tiers[selectedTier].name} benefits</p>
                {tiers[selectedTier].benefits.slice(0, 3).map((b) => (
                  <div key={b} className="flex items-center gap-1.5 text-xs text-slate-700">
                    <CheckCircle2 className={`h-3 w-3 flex-shrink-0 ${tiers[selectedTier].textColor}`} />{b}
                  </div>
                ))}
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Full name *</label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="Your name" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Email *</label>
                <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="you@email.com" />
              </div>
              <button onClick={confirmJoin} disabled={!canJoin}
                className="w-full rounded-xl bg-purple-600 py-3 font-bold text-white hover:bg-purple-700 disabled:opacity-40">
                {tiers[selectedTier].price === 0 ? "Join Free Now" : "Start Free Trial"}
              </button>
              <p className="text-center text-xs text-slate-400">Managed from <Link href="/moredealsx/memberships/my" className="underline">MoreDealsX Memberships</Link> · Cancel anytime</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
