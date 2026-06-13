"use client";

import { useEffect, useRef } from "react";

/**
 * Shared placement behaviour for the membership join section across every
 * industry storefront. When the QR `?join=1` deep-link sets `joinIntent`, the
 * returned ref's element is smoothly scrolled into view so a scan lands the
 * customer right on the plans.
 *
 * Keeping this in one hook (instead of copy-pasting the effect into each
 * storefront client) means every vertical behaves identically.
 */
export function useMembershipJoinIntent(joinIntent: boolean) {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!joinIntent) return;
    const t = setTimeout(() => {
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 250);
    return () => clearTimeout(t);
  }, [joinIntent]);
  return sectionRef;
}
