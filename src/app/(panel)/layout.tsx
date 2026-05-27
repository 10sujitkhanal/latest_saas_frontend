'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Shield } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { getAuthToken, removeAuthTokens } from '@/lib/storage';
import { OrganizationService } from '@/services/organization.service';
import { useAuthStore } from '@/store/authStore';
import { useSubscriptionStatusStore } from '@/store/subscriptionStatusStore';

type GateState = 'checking' | 'unauth' | 'forbidden' | 'ok' | 'error';

const SUBSCRIPTION_PATH = '/subscription';

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const setUser = useAuthStore((s) => s.setUser);
  const setPermissions = useAuthStore((s) => s.setPermissions);
  const setServices = useAuthStore((s) => s.setServices);
  const setHydrated = useAuthStore((s) => s.setHydrated);
  const setSubscriptionStatus = useSubscriptionStatusStore((s) => s.set);
  const subscriptionActive = useSubscriptionStatusStore((s) => s.active);
  const [state, setState] = useState<GateState>('checking');
  const [forbiddenInfo, setForbiddenInfo] = useState<{ email: string; role: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const token = getAuthToken('access');
    if (!token) {
      setState('unauth');
      router.replace('/auth/login');
      return;
    }

    let cancelled = false;
    OrganizationService.me()
      .then((res) => {
        if (cancelled) return;
        if (!res?.success || !res.data) {
          setErrorMessage(res?.message || 'Failed to verify your account.');
          setState('error');
          return;
        }
        const me = res.data;
        setUser({ email: me.email, role: me.is_admin ? 'ADMIN' : 'MEMBER' });
        setPermissions(Array.isArray(me.permission_codes) ? me.permission_codes : []);
        setServices(Array.isArray(me.services) ? me.services : []);
        setSubscriptionStatus({
          active: !!me.subscription_active,
          status: me.subscription?.status ?? null,
          planName: me.subscription?.plan_name ?? null,
          currentPeriodEnd: me.subscription?.current_period_end ?? null,
        });
        if (!me.is_admin) {
          setForbiddenInfo({ email: me.email, role: me.role || 'MEMBER' });
          setState('forbidden');
          return;
        }
        setState('ok');
      })
      .catch((err) => {
        if (cancelled) return;
        const status = err?.response?.status;
        if (status === 401) {
          removeAuthTokens();
          setState('unauth');
          router.replace('/auth/login');
          return;
        }
        setErrorMessage(err?.response?.data?.message ?? 'Failed to verify your account.');
        setState('error');
      })
      .finally(() => { if (!cancelled) setHydrated(true); });
    return () => {
      cancelled = true;
    };
  }, [router, setUser, setPermissions, setServices, setSubscriptionStatus, setHydrated]);

  // Lock locked-out admins to /subscription. Any navigation to other panel
  // routes is redirected. The subscription page itself stays accessible so
  // they can renew or switch plans.
  useEffect(() => {
    if (state !== 'ok') return;
    if (subscriptionActive) return;
    if (pathname === SUBSCRIPTION_PATH) return;
    router.replace(SUBSCRIPTION_PATH);
  }, [state, subscriptionActive, pathname, router]);

  if (state === 'checking' || state === 'unauth') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (state === 'forbidden') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl bg-white/[0.02] border border-white/5 p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 mx-auto mb-4 flex items-center justify-center text-amber-300">
            <Shield className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-semibold text-white">This is the admin panel</h2>
          <p className="text-sm text-slate-400 mt-2">
            Your account (<span className="text-emerald-300">{forbiddenInfo?.email}</span>) is signed in as{' '}
            <span className="uppercase font-semibold text-slate-300">{forbiddenInfo?.role}</span>, which doesn't have admin access.
            <br />
            You can still open the workspaces you've been assigned to.
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <button
              onClick={() => router.replace('/w')}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold"
            >
              Go to my workspaces →
            </button>
            <button
              onClick={() => {
                removeAuthTokens();
                setUser(null);
                router.replace('/auth/login');
              }}
              className="px-4 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 text-sm text-slate-200"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-red-500/30 bg-red-500/5 p-6 text-center">
          <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/30 mx-auto mb-3 flex items-center justify-center text-red-400">!</div>
          <h3 className="text-base font-semibold text-white">Couldn't verify your account</h3>
          <p className="text-sm text-slate-400 mt-1">{errorMessage}</p>
          <button onClick={() => location.reload()} className="mt-4 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#030712] text-slate-50">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">{children}</div>
    </div>
  );
}
