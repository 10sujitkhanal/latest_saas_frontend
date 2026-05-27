'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useBranding } from '@/lib/branding';

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
  const [hasResolved, setHasResolved] = useState(false);

  useEffect(() => {
    // Give the branding fetch ~2s to either succeed or fail before showing
    // the no-org message. If branding flips to registered, we resolve early.
    const t = setTimeout(() => setHasResolved(true), 2000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (branding.registered) setHasResolved(true);
  }, [branding.registered]);

  if (!hasResolved) {
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
          <h1 className="text-xl font-bold text-white">No organization registered</h1>
          <p className="text-sm text-slate-400 mt-2 leading-relaxed">
            No organization is registered for <span className="text-emerald-300 font-mono">{typeof window !== 'undefined' ? window.location.hostname : ''}</span>.
            <br />
            If you're an agency owner, provision this organization from your agency panel.
          </p>
          <p className="text-xs text-slate-500 mt-4">
            Already onboarded? Double-check the subdomain in your URL bar.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
