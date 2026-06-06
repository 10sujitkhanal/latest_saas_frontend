'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowRight, Lock, ShieldAlert } from 'lucide-react';
import { getAuthToken, removeAuthTokens } from '@/lib/storage';
import { OrganizationService } from '@/services/organization.service';
import { useAuthStore } from '@/store/authStore';
import { setBusinessCurrency } from '@/lib/currency';
import WorkspaceSwitcher from '@/components/workspace/WorkspaceSwitcher';

/**
 * Layout for the workspace panel (/w/...).
 *
 * Gate hierarchy:
 *   1. Token present                          → else redirect /auth/login
 *   2. /me/ resolves                          → else error screen
 *   3. Subscription active                    → else
 *        - admin user  → "Renew" CTA → /subscription
 *        - non-admin   → "Contact your admin" message (BLOCKED, no escape)
 *   4. Children handle their own access checks (e.g. WorkspaceContextView
 *      enforces membership for /w/<id>/...).
 */
type GateState = 'checking' | 'ok' | 'unauth' | 'sub_admin' | 'sub_member' | 'error';

export default function WorkspacePanelLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<GateState>('checking');
  const [me, setMe] = useState<{ email: string; is_admin: boolean; subscription_active: boolean; business?: { name: string; logo: string | null } } | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

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
        const m = res.data;
        setMe({ email: m.email, is_admin: !!m.is_admin, subscription_active: !!m.subscription_active, business: m.business });
        setBusinessCurrency((m.business as { currency?: string } | undefined)?.currency);
        // Apply the business's own favicon + tab title in the workspace panel too
        // (same as the admin panel — the public branding endpoint doesn't carry
        // the tenant's own favicon for non-white-label orgs).
        try {
          if (m.business?.favicon) {
            let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement | null;
            if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
            link.href = m.business.favicon;
          }
          if (m.business?.name) document.title = m.business.name;
        } catch { /* non-critical */ }
        if (!m.subscription_active) {
          setState(m.is_admin ? 'sub_admin' : 'sub_member');
          return;
        }
        setState('ok');
      })
      .catch((err) => {
        if (cancelled) return;
        if (err?.response?.status === 401) {
          removeAuthTokens();
          setState('unauth');
          router.replace('/auth/login');
          return;
        }
        setErrorMessage(err?.response?.data?.message ?? 'Failed to verify your account.');
        setState('error');
      });
    return () => { cancelled = true; };
  }, [router]);

  if (state === 'checking' || state === 'unauth') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
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

  if (state === 'sub_admin') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-500/40 mx-auto mb-4 flex items-center justify-center text-amber-300">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-semibold text-white">Subscription paused</h2>
          <p className="text-sm text-slate-300 mt-2">
            Your organization's subscription isn't active. Workspace access is locked until it's renewed.
          </p>
          <Link
            href="/subscription"
            className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold transition-colors"
          >
            Renew or upgrade
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  if (state === 'sub_member') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-500/40 mx-auto mb-4 flex items-center justify-center text-amber-300">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-semibold text-white">Contact your admin</h2>
          <p className="text-sm text-slate-300 mt-2">
            Your organization's subscription is paused. Please ask your administrator to renew the plan to restore your workspace access.
          </p>
          <p className="text-xs text-slate-500 mt-4">
            Signed in as <span className="text-slate-300">{me?.email}</span>
          </p>
          <button
            onClick={() => { removeAuthTokens(); router.replace('/auth/login'); }}
            className="mt-5 px-4 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 text-sm text-slate-200"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  // ok
  return (
    <div className="min-h-screen flex flex-col bg-[#030712] text-slate-50">
      <WorkspaceHeader email={me?.email} isAdmin={!!me?.is_admin} business={me?.business} />
      <div className="flex-1">{children}</div>
    </div>
  );
}

function WorkspaceHeader({ email, isAdmin, business }: { email?: string; isAdmin: boolean; business?: { name: string; logo: string | null } }) {
  const router = useRouter();
  const ws = useAuthStore((s) => s.workspaceMeta);
  const name = business?.name || 'Workspace';
  return (
    <header className="sticky top-0 z-20 backdrop-blur-xl bg-[#030712]/70 border-b border-white/5">
      <div className="px-6 lg:px-10 h-14 flex items-center gap-3">
        {/* Client (business) brand: logo + name */}
        <Link href="/w" className="flex items-center gap-2.5 min-w-0" title="All workspaces">
          {business?.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={business.logo} alt={name} className="w-8 h-8 rounded-lg object-cover border border-white/10 shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-sky-600 flex items-center justify-center font-black text-white text-sm shrink-0">
              {name[0]?.toUpperCase() || 'B'}
            </div>
          )}
          <span className="text-[15px] font-extrabold text-white truncate max-w-[200px]">{name}</span>
        </Link>

        {/* Current workspace + role (when inside a workspace) — same banner */}
        {ws && (
          <>
            <span className="h-5 w-px bg-white/10" />
            <WorkspaceSwitcher currentId={ws.id} currentName={ws.name} />
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              {ws.role}
            </span>
          </>
        )}

        <div className="flex-1" />

        {isAdmin && (
          <Link href="/dashboard" className="text-xs text-emerald-300 hover:text-emerald-200 font-semibold">
            Org admin →
          </Link>
        )}
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="hidden md:inline">{email}</span>
          <button
            onClick={() => { removeAuthTokens(); router.replace('/auth/login'); }}
            className="p-1.5 rounded-md text-slate-500 hover:text-red-300 hover:bg-red-500/10"
            title="Sign out"
          >
            <Lock className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
