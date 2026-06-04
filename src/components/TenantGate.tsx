'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { useBranding } from '@/lib/branding';

/**
 * Public routes that must render WITHOUT a registered tenant — the apex
 * marketing landing, the signup/partner flows, and the consumer surfaces
 * (MoreDealsX, public storefront, public booking). These resolve their own
 * tenant (by path) or need none, so the org gate must not block them.
 */
const PUBLIC_PREFIXES = ['/signup', '/deals', '/store', '/book', '/quote', '/invoice'];
function isPublicPath(pathname: string): boolean {
  if (pathname === '/') return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

/**
 * The apex marketing host (localhost, 127.0.0.1, or a bare two-label domain
 * like merkoll.com) never maps to a tenant — it is the public site. Tenants
 * live on subdomains (<name>.localhost, acme.merkoll.com). So the org gate must
 * only ever run on a subdomain; on the apex it bypasses entirely, letting the
 * matched route render (landing, 404, login, etc.). Returns false during SSR so
 * the server and the client's first paint agree (no hydration mismatch); the
 * real check runs after mount.
 */
function hostIsApex(): boolean {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  if (!h || h === 'localhost' || h === '127.0.0.1') return true;
  if (h.endsWith('.localhost')) return false;
  return h.split('.').length <= 2;
}

/**
 * Sits between the root layout and every page. Blocks rendering until
 * `/api/v1/public/tenant/branding/` confirms the current host maps to a real
 * org tenant. Visitors on unregistered subdomains see a "No organization
 * registered" message instead of the panel/login.
 *
 * The branding lookup is fired by `BrandingProvider` (see `lib/branding.tsx`).
 * `useBranding()` returns `registered: false` while the lookup is in flight
 * OR if no tenant matches the host. We distinguish them with a local
 * `hasResolved` flag so we don't flash the error UI before the response
 * arrives.
 */
export default function TenantGate({ children }: { children: React.ReactNode }) {
  const branding = useBranding();
  const pathname = usePathname();
  const [hasResolved, setHasResolved] = useState(false);
  const [mounted, setMounted] = useState(false);
  const isPublic = isPublicPath(pathname);

  useEffect(() => {
    setMounted(true);
    // Give the branding fetch ~2s to either succeed or fail before showing
    // the no-org message. If branding flips to registered, we resolve early.
    const t = setTimeout(() => setHasResolved(true), 2000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (branding.registered) setHasResolved(true);
  }, [branding.registered]);

  // Public consumer routes (landing, signup, partner, deals, store, book) and
  // the entire apex marketing host bypass the org gate — they need no tenant.
  // The apex check waits for mount so SSR/first paint stay consistent.
  if (isPublic || (mounted && hostIsApex())) {
    return <>{children}</>;
  }

  if (!mounted || !hasResolved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#030712]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-4 border-slate-700 border-t-emerald-500 animate-spin" />
          <span className="text-sm font-bold text-slate-500">Checking organization…</span>
        </div>
      </div>
    );
  }

  if (!branding.registered) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#030712] p-4">
        <div className="max-w-md w-full rounded-2xl bg-slate-900/80 border border-amber-500/30 p-8 text-center shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 mx-auto mb-4 flex items-center justify-center text-amber-300">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-white">Nothing here</h1>
          <p className="text-sm text-slate-400 mt-2 leading-relaxed">
            No business is registered at <span className="text-emerald-300 font-mono">{typeof window !== 'undefined' ? window.location.hostname : ''}</span>.
            <br />
            Businesses live at <span className="text-slate-300 font-mono">{'<name>'}.localhost:3000</span> — double-check the address.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <a href="http://localhost:3000/" className="rounded-full bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold px-5 py-2.5">Go to homepage</a>
            <a href="http://localhost:3000/signup" className="rounded-full border border-white/15 hover:bg-white/[0.06] text-slate-200 text-sm font-semibold px-5 py-2.5">Start a business</a>
            <a href="/auth/login" className="rounded-full border border-white/15 hover:bg-white/[0.06] text-slate-200 text-sm font-semibold px-5 py-2.5">Sign in</a>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
