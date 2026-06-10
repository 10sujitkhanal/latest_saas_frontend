/**
 * Single source of truth for "is this workspace's membership actually live on
 * the public store?" — the 4-flag gate that decides whether the membership QR /
 * join link works:
 *
 *   1. a public ACTIVE membership plan exists  (plan.is_active && plan.is_public)
 *   2. "Sell memberships" is on                (StorefrontSettings.sell_memberships)
 *   3. the business is public                  (StorefrontSettings.is_open)
 *
 * Every owner-facing membership surface (the plans-page status panel, the QR
 * card, any future panel) MUST derive its Live/Not-live state from this helper
 * so they can never disagree. The public BACKEND gates are unchanged — this only
 * mirrors them on the client so we never hand the owner a dead QR.
 *
 * `missing` is returned in DEPENDENCY ORDER — public active plan → sell
 * memberships → business public — so the owner builds the thing, enables selling
 * it, then goes live, instead of being sent in a circle.
 */

export interface MembershipPlanLike {
  is_active?: boolean;
  is_public?: boolean | null;
}

export interface StorefrontSettingsLike {
  is_open?: boolean;
  sell_memberships?: boolean;
}

/** A gate the owner still has to clear. `key` lets each surface bind its own
 *  one-click fix (create plan / make public / enable selling / go live). */
export interface MembershipGate {
  key: 'plan' | 'sell' | 'store';
  text: string;
}

export interface MembershipReadiness {
  hasPlan: boolean;
  hasActive: boolean;
  hasPublic: boolean;
  sellOn: boolean;
  storePublic: boolean;
  /** All gates pass — the QR / join link is genuinely live. */
  live: boolean;
  /** Unmet gates in dependency order (empty when live). */
  missing: MembershipGate[];
}

export function membershipReadiness(
  plans: MembershipPlanLike[],
  settings: StorefrontSettingsLike | null | undefined,
): MembershipReadiness {
  const hasPlan = plans.length > 0;
  const hasActive = plans.some((p) => p.is_active);
  const hasPublic = plans.some((p) => p.is_active && p.is_public);
  const sellOn = Boolean(settings?.sell_memberships);
  const storePublic = Boolean(settings?.is_open);
  const live = hasPublic && sellOn && storePublic;

  const missing: MembershipGate[] = [];
  // 1) public active plan
  if (!hasPlan) missing.push({ key: 'plan', text: 'No membership plan yet' });
  else if (!hasActive) missing.push({ key: 'plan', text: 'No active plan' });
  else if (!hasPublic) missing.push({ key: 'plan', text: 'Your plan isn’t public' });
  // 2) sell memberships
  if (!sellOn) missing.push({ key: 'sell', text: '“Sell memberships” is turned off' });
  // 3) business public
  if (!storePublic) missing.push({ key: 'store', text: 'Your business isn’t public yet' });

  return { hasPlan, hasActive, hasPublic, sellOn, storePublic, live, missing };
}
