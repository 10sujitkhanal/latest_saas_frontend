"use client";

import { useState } from "react";
import { Star, Check, Loader2, Copy, Gift } from "lucide-react";
import { checkLoyaltyPoints, redeemReward, type PublicLoyaltyReward } from "@/lib/storefront/storefrontPublicApi";

/**
 * Public storefront loyalty rewards. Shows the earn rate + the rewards catalogue;
 * a shopper checks their points by email, then redeems for a reward. The backend
 * deducts points and issues a single-use coupon / gift-card code — this component
 * never computes points, it only collects the choice and shows the issued code.
 */
export default function LoyaltyRewardsSection({
  slug,
  currency,
  earnRate,
  rewards,
}: {
  slug: string;
  currency: string;
  earnRate?: number;
  rewards: PublicLoyaltyReward[];
}) {
  const [email, setEmail] = useState("");
  const [points, setPoints] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ code: string; reward: string; remaining: number } | null>(null);
  const [copied, setCopied] = useState(false);

  if (!rewards || rewards.length === 0) return null;

  const rewardLabel = (r: PublicLoyaltyReward) => {
    const v = Number(r.value);
    if (r.rewardType === "discount_percent") return `${v}% off`;
    if (r.rewardType === "discount_amount") return `${currency} ${v} off`;
    return `${currency} ${v} gift card`;
  };

  const check = async () => {
    if (!email.trim()) { setError("Enter your email to see your points."); return; }
    setChecking(true); setError(null);
    try {
      const r = await checkLoyaltyPoints(slug, email.trim());
      setPoints(r.points);
      if (!r.found) setError("No points yet for that email — place an order to start earning.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not check points."); }
    finally { setChecking(false); }
  };

  const redeem = async (r: PublicLoyaltyReward) => {
    if (!email.trim()) { setError("Enter your email first, then redeem."); return; }
    setRedeemingId(r.id); setError(null);
    try {
      const res = await redeemReward(slug, email.trim(), r.id);
      setDone({ code: res.code, reward: res.reward, remaining: res.pointsRemaining });
      setPoints(res.pointsRemaining);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not redeem."); }
    finally { setRedeemingId(null); }
  };

  const copy = async () => {
    if (!done) return;
    try { await navigator.clipboard.writeText(done.code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* no clipboard */ }
  };

  return (
    <div className="scroll-mt-24">
      <p className="mb-1 flex items-center gap-2 font-bold text-slate-900">
        <Star className="h-4 w-4 text-amber-500" /> Rewards
      </p>
      <p className="mb-3 text-sm text-slate-500">
        {earnRate && earnRate > 0 ? `Earn ${earnRate % 1 === 0 ? earnRate : earnRate.toFixed(2)} point${earnRate === 1 ? "" : "s"} per ${currency} spent, then redeem for these rewards.` : "Earn points when you shop, then redeem for these rewards."}
      </p>

      {/* Check points */}
      <div className="mb-4 flex max-w-md flex-wrap items-center gap-2">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email"
          className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400" />
        <button type="button" onClick={check} disabled={checking}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300 disabled:opacity-50">
          {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4 text-amber-500" />} Check points
        </button>
        {points !== null && <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-700">{points} points</span>}
      </div>

      {error && <p className="mb-3 text-xs text-rose-600">{error}</p>}

      {done && (
        <div className="mb-4 max-w-md rounded-xl bg-emerald-50 p-4 text-emerald-800">
          <p className="flex items-center gap-1.5 font-semibold"><Check className="h-4 w-4" /> Redeemed: {done.reward}</p>
          <p className="mt-1 text-[13px] text-emerald-700/90">Use this code at checkout — {done.remaining} points left:</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-center font-mono text-sm font-bold tracking-wide text-slate-900">{done.code}</code>
            <button type="button" onClick={copy} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rewards.map((r) => {
          const affordable = points !== null && points >= r.pointsCost;
          return (
            <div key={r.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2">
                {r.rewardType === "gift_card" ? <Gift className="h-4 w-4 text-pink-600" /> : <Star className="h-4 w-4 text-amber-500" />}
                <span className="font-semibold text-slate-900">{r.name}</span>
              </div>
              <p className="mt-1 text-[13px] text-slate-500">{r.description || rewardLabel(r)}</p>
              <div className="mt-2 inline-flex w-fit items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[12px] font-semibold text-amber-700">
                {r.pointsCost} points
              </div>
              <div className="mt-auto pt-3">
                <button type="button" onClick={() => redeem(r)} disabled={redeemingId === r.id || (points !== null && !affordable)}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50">
                  {redeemingId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {points !== null && !affordable ? `Need ${r.pointsCost - (points ?? 0)} more` : `Redeem · ${rewardLabel(r)}`}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
