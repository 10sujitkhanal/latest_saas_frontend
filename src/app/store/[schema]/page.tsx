'use client';

/**
 * Public storefront — what a shopper sees at /store/<tenant-schema>.
 *
 * Renders the premium, industry-specific storefront via UniversalStorefrontClient
 * (which dispatches to the Wellness / Restaurant / Hotel / Salon / Fika / Craft
 * Beer / Natural Beauty / Trekking client by industry). Data comes from the
 * production public API through the storefrontPublicApi adapter, which also
 * forwards an owner ?preview=<token> so a draft store renders for the owner.
 */

import { useEffect, useState, use as reactUse } from 'react';
import Link from 'next/link';
import { LogIn } from 'lucide-react';
import {
  getPublicStorefront, getPublicItems, getPublicOffers, getPublicAvailability,
  type PublicStorefront, type PublicItem, type PublicOffer, type PublicAvailability,
} from '@/lib/storefront/storefrontPublicApi';
import { UniversalStorefrontClient } from '@/components/storefront/UniversalStorefrontClient';
import StorefrontAssistant from '@/components/storefront/StorefrontAssistant';
import { setFavicon } from '@/lib/branding';
import { resolveApexApiBase } from '@/lib/apiBase';

/**
 * A subdomain that isn't a tenant store might be an AGENCY (e.g.
 * ``moretechglobal.morefungi.com``). If so, route the visitor to that agency's
 * branded landing instead of showing "store coming soon". Returns true when it
 * redirected. Skipped on localhost (the agency app is a separate dev host).
 */
async function redirectIfAgency(slug: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost')) return false;
  try {
    const res = await fetch(`${resolveApexApiBase()}/api/v1/public/agency/storefront/${encodeURIComponent(slug)}/`);
    if (!res.ok) return false;
    const d = await res.json();
    if (!(d?.data?.agency || d?.agency)) return false;
    const apex = (process.env.NEXT_PUBLIC_FRONTEND_APEX || host.split('.').slice(-2).join('.')).toLowerCase();
    window.location.replace(`https://agency.${apex}/landing?a=${encodeURIComponent(slug)}`);
    return true;
  } catch {
    return false;
  }
}

/** Subtle, non-invasive sign-in pill shown over every storefront. Routes to the
 *  org login, which then sends the user where they belong (owner→dashboard,
 *  staff→their workspace). Works across all industry storefronts. */
function StoreSignIn() {
  return (
    <Link
      href="/auth/login"
      className="fixed top-4 right-4 z-50 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-black/70 hover:bg-black text-white text-xs font-semibold backdrop-blur shadow-lg"
    >
      <LogIn className="w-3.5 h-3.5" /> Sign in
    </Link>
  );
}

type Loaded = {
  storefront: PublicStorefront;
  items: PublicItem[];
  offers: PublicOffer[];
  availability: PublicAvailability | null;
};

export default function StorefrontPage({ params }: { params: Promise<{ schema: string }> }) {
  const { schema } = reactUse(params);
  const [data, setData] = useState<Loaded | null>(null);
  const [state, setState] = useState<'loading' | 'notfound' | 'ok'>('loading');
  const [refCode, setRefCode] = useState<string | undefined>(undefined);
  // ?join=1 (the membership QR deep-link) — land the shopper on the membership
  // section so they can become a member in a tap.
  const [joinIntent, setJoinIntent] = useState(false);

  useEffect(() => {
    let alive = true;
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      const r = sp.get('ref');
      if (r) setRefCode(r);
      if (sp.get('join') === '1' || sp.has('join')) setJoinIntent(true);
    }
    (async () => {
      const [storefront, items, offers, availability] = await Promise.all([
        getPublicStorefront(schema),
        getPublicItems(schema),
        getPublicOffers(schema),
        getPublicAvailability(schema),
      ]);
      if (!alive) return;
      if (!storefront) {
        // Not a tenant store — maybe an agency subdomain → its landing.
        if (await redirectIfAgency(schema)) return;
        setState('notfound');
        return;
      }
      setData({ storefront, items, offers, availability });
      setState('ok');
    })().catch(async () => { if (alive && !(await redirectIfAgency(schema))) setState('notfound'); });
    return () => { alive = false; };
  }, [schema]);

  // Apply the business's OWN favicon + tab title to the public store.
  useEffect(() => {
    const sf = data?.storefront;
    if (!sf) return;
    if (sf.name) document.title = sf.name;
    if (sf.faviconUrl) setFavicon(sf.faviconUrl);
  }, [data]);

  if (state === 'loading') {
    return (
      <div className="min-h-screen grid place-items-center bg-white text-slate-400 text-sm">
        <StoreSignIn />
        Loading store…
      </div>
    );
  }
  if (state === 'notfound' || !data) {
    return (
      <div className="min-h-screen grid place-items-center bg-white text-center px-6">
        <StoreSignIn />
        <div>
          <div className="text-2xl font-bold text-slate-900">Store coming soon</div>
          <p className="mt-2 text-sm text-slate-500">This business is getting set up. If this is your business, sign in to finish your storefront.</p>
        </div>
      </div>
    );
  }
  return (
    <>
      <StoreSignIn />
      <UniversalStorefrontClient
        storefront={data.storefront}
        items={data.items}
        offers={data.offers}
        availability={data.availability}
        refCode={refCode}
        joinIntent={joinIntent}
      />
      <StorefrontAssistant
        slug={schema}
        name={data.storefront.name}
        accent={data.storefront.primaryColor}
      />
    </>
  );
}
