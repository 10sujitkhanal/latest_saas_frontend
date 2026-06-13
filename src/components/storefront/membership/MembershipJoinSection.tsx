"use client";

import { useEffect, useState } from "react";
import { Shield, Check, Loader2, Sparkles } from "lucide-react";
import {
  startMembershipCheckout,
  confirmMembershipCheckout,
  type PublicMembershipPlan,
} from "@/lib/storefront/storefrontPublicApi";
import { useMembershipJoinIntent } from "./useMembershipJoinIntent";

/**
 * Public storefront membership join (the scan-QR → become-a-member flow).
 *
 * Reusable across ALL industry storefront clients — each one drops in
 * `<MembershipJoinSection slug=… memberships={storefront.memberships} joinIntent=… />`
 * after its hero; the per-industry layout keeps its own design around it.
 *
 * Workspace-scoped by construction: it only joins plans belonging to THIS
 * business's storefront, via the public `/subscribe/` endpoint. The backend is
 * the source of truth — it decides eligibility, is idempotent (one active
 * membership per customer+workspace+plan), and applies the member discount at
 * checkout. This component never computes a price; it only displays the benefit
 * the plan advertises and collects who is joining.
 *
 * `joinIntent` (from the QR `?join=1` deep-link) scrolls this section into view.
 * `planId` (from a future `?join=1&plan=<id>` plan-QR) pre-opens that plan.
 */
export default function MembershipJoinSection({
  slug,
  memberships,
  joinIntent = false,
  planId,
}: {
  slug: string;
  memberships: PublicMembershipPlan[];
  joinIntent?: boolean;
  planId?: string;
}) {
  const sectionRef = useMembershipJoinIntent(joinIntent);
  const [openPlanId, setOpenPlanId] = useState<string | null>(planId ?? null);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // planId -> member number, once joined (or already a member).
  const [joined, setJoined] = useState<Record<string, { memberNo: string; already: boolean }>>({});
  // Return from Stripe Checkout (?membership_session=…): confirm + show outcome.
  const [returning, setReturning] = useState<
    null | { status: "confirming" | "done" | "error"; memberNo?: string; already?: boolean; error?: string }
  >(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const sessionId = sp.get("membership_session");
    if (!sessionId) return;
    // Strip the param so a refresh won't re-run (confirm is idempotent regardless).
    sp.delete("membership_session");
    window.history.replaceState({}, "", window.location.pathname + (sp.toString() ? `?${sp}` : ""));
    setReturning({ status: "confirming" });
    (async () => {
      try {
        const r = await confirmMembershipCheckout(slug, sessionId);
        setReturning({ status: "done", memberNo: r.memberNo, already: r.alreadyMember });
        setTimeout(() => sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
      } catch (e) {
        setReturning({ status: "error", error: e instanceof Error ? e.message : "Could not confirm your payment." });
      }
    })();
  }, [slug, sectionRef]);

  if (!memberships || memberships.length === 0) return null;

  const money = (price: string, currency: string) => {
    const n = parseFloat(price);
    if (!n) return "Free";
    return `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const submit = async (plan: PublicMembershipPlan, ev: React.FormEvent) => {
    ev.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await startMembershipCheckout(slug, {
        planId: plan.id,
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        // Stripe returns here; the backend appends ?membership_session=<id>.
        returnUrl: window.location.origin + window.location.pathname,
      });
      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl; // paid plan → Stripe-hosted payment
        return;
      }
      // free plan → activated immediately
      setJoined((j) => ({ ...j, [plan.id]: { memberNo: res.memberNo ?? "", already: Boolean(res.alreadyMember) } }));
      setOpenPlanId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not complete sign-up. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div ref={sectionRef} className="scroll-mt-24">
      <p className="mb-1 flex items-center gap-2 font-bold text-slate-900">
        <Shield className="h-4 w-4 text-emerald-600" /> Become a member
      </p>
      <p className="mb-3 text-sm text-slate-500">
        Join this business&apos;s membership and your benefits apply automatically when you shop.
      </p>

      {returning && (
        <div
          className={`mb-3 rounded-xl border p-3 text-[13px] ${
            returning.status === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {returning.status === "confirming" && (
            <p className="flex items-center gap-1.5"><Loader2 className="h-4 w-4 animate-spin" /> Confirming your payment…</p>
          )}
          {returning.status === "done" && (
            <p className="flex items-center gap-1.5 font-semibold">
              <Check className="h-4 w-4" />
              {returning.already ? "You're already a member" : "Payment received — you're a member!"}
              {returning.memberNo ? ` · ${returning.memberNo}` : ""}
            </p>
          )}
          {returning.status === "error" && <p>{returning.error}</p>}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {memberships.map((plan) => {
          const done = joined[plan.id];
          const isOpen = openPlanId === plan.id;
          const discount = Number(plan.memberDiscountPercent) || 0;
          return (
            <div
              key={plan.id}
              className={`flex flex-col rounded-2xl border bg-white p-4 transition-colors ${
                joinIntent ? "border-emerald-300 ring-1 ring-emerald-200" : "border-slate-200"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold text-slate-900">{plan.name}</div>
                <div className="text-right text-sm font-bold text-slate-900">
                  {money(plan.price, plan.currency)}
                  {parseFloat(plan.price) > 0 && (
                    <span className="block text-[10px] font-normal text-slate-400">
                      /{plan.interval.replace("_", " ")}
                    </span>
                  )}
                </div>
              </div>

              {discount > 0 && (
                <div className="mt-2 inline-flex items-center gap-1.5 self-start rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-semibold text-emerald-700">
                  <Sparkles className="h-3.5 w-3.5" /> Members get {discount}% off eligible orders here
                </div>
              )}

              {plan.perks && plan.perks.length > 0 ? (
                <ul className="mt-3 space-y-1.5">
                  {plan.perks.map((perk, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13px] text-slate-700">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> <span>{perk}</span>
                    </li>
                  ))}
                </ul>
              ) : plan.benefits ? (
                <p className="mt-2 whitespace-pre-line text-[13px] text-slate-600">{plan.benefits}</p>
              ) : null}

              <div className="mt-auto pt-3">
                {done ? (
                  <div className="rounded-xl bg-emerald-50 p-3 text-[13px] text-emerald-800">
                    <p className="flex items-center gap-1.5 font-semibold">
                      <Check className="h-4 w-4" /> {done.already ? "You're already a member" : "You're a member!"}
                    </p>
                    {done.memberNo && <p className="mt-0.5 text-emerald-700/80">Member no. {done.memberNo}</p>}
                    {discount > 0 && (
                      <p className="mt-1 text-emerald-700/80">
                        Your {discount}% discount now applies at checkout.
                      </p>
                    )}
                  </div>
                ) : isOpen ? (
                  <form onSubmit={(e) => submit(plan, e)} className="space-y-2">
                    <input
                      required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Your name"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400"
                    />
                    <input
                      required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="Email"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400"
                    />
                    <input
                      value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="Phone (optional)"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400"
                    />
                    {error && <p className="text-[12px] text-red-600">{error}</p>}
                    <div className="flex gap-2">
                      <button
                        type="submit" disabled={submitting}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                      >
                        {submitting
                          ? <><Loader2 className="h-4 w-4 animate-spin" /> {parseFloat(plan.price) > 0 ? "Redirecting…" : "Joining…"}</>
                          : (parseFloat(plan.price) > 0 ? "Continue to payment" : "Join now")}
                      </button>
                      <button
                        type="button" onClick={() => { setOpenPlanId(null); setError(null); }}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    onClick={() => { setOpenPlanId(plan.id); setError(null); }}
                    className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    Join {plan.name}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
