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

  useEffect(() => {
    let alive = true;
    if (typeof window !== 'undefined') {
      const r = new URLSearchParams(window.location.search).get('ref');
      if (r) setRefCode(r);
    }
    (async () => {
      const [storefront, items, offers, availability] = await Promise.all([
        getPublicStorefront(schema),
        getPublicItems(schema),
        getPublicOffers(schema),
        getPublicAvailability(schema),
      ]);
      if (!alive) return;
      if (!storefront) { setState('notfound'); return; }
      setData({ storefront, items, offers, availability });
      setState('ok');
    })().catch(() => { if (alive) setState('notfound'); });
    return () => { alive = false; };
  }, [schema]);

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
      />
    </>
  );
}
