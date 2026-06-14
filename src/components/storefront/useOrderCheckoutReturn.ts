"use client";

import { useEffect, useState } from "react";
import { confirmOrderCheckout } from "@/lib/storefront/storefrontPublicApi";

export type OrderCheckoutReturn =
  | null
  | { status: "confirming" | "done" | "error"; orderNumber?: string; error?: string };

/**
 * Shared Stripe-return handling for storefront order checkout. When the page
 * loads with `?order_session=<id>` (Stripe success-URL), confirm the session
 * (idempotent) and report the outcome. Used by every storefront client so the
 * paid-return behaviour is identical across verticals.
 */
export function useOrderCheckoutReturn(slug: string): OrderCheckoutReturn {
  const [state, setState] = useState<OrderCheckoutReturn>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const sessionId = sp.get("order_session");
    if (!sessionId) return;
    // Strip the param so a refresh won't re-run (confirm is idempotent anyway).
    sp.delete("order_session");
    window.history.replaceState({}, "", window.location.pathname + (sp.toString() ? `?${sp}` : ""));
    setState({ status: "confirming" });
    (async () => {
      try {
        const r = await confirmOrderCheckout(slug, sessionId);
        setState({ status: "done", orderNumber: r.orderNumber });
      } catch (e) {
        setState({ status: "error", error: e instanceof Error ? e.message : "Could not confirm your payment." });
      }
    })();
  }, [slug]);
  return state;
}
