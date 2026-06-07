'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, AlertTriangle } from 'lucide-react';
import { OrganizationService } from '@/services/organization.service';
import { useAuthStore } from '@/store/authStore';

/**
 * Internal-Management SSO landing. The agency portal opens this with a one-time
 * ?ticket=… ; we exchange it for THIS workspace's tokens and drop the agency
 * owner straight into their own business dashboard. No password typed.
 */
export default function SsoLandingPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [error, setError] = useState('');

  useEffect(() => {
    const ticket = new URLSearchParams(window.location.search).get('ticket');
    if (!ticket) { setError('Invalid sign-in link.'); return; }
    (async () => {
      try {
        const res = await OrganizationService.ssoExchange(ticket);
        const d = res?.data ?? res;
        if ((res?.success ?? true) && d?.access) {
          login(d.access, d.refresh, d.email || '');
          router.replace('/dashboard');
        } else {
          setError(res?.message || 'Sign-in failed. Please reopen from your agency portal.');
        }
      } catch (e: unknown) {
        const v = e as { response?: { data?: { message?: string } } };
        setError(v.response?.data?.message ?? 'Sign-in failed. Please reopen from your agency portal.');
      }
    })();
  }, [login, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#030712] text-slate-200 p-6">
      {error ? (
        <div className="max-w-sm text-center">
          <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-3" />
          <h1 className="text-lg font-bold text-white">Couldn’t open your workspace</h1>
          <p className="text-sm text-slate-400 mt-2">{error}</p>
        </div>
      ) : (
        <div className="flex items-center gap-3 text-sm text-slate-300">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-400" /> Opening your workspace…
        </div>
      )}
    </div>
  );
}
