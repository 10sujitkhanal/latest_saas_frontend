'use client';

import { useEffect, useState, use as reactUse } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Lock } from 'lucide-react';
import { Skeleton } from '@/components/workspace/Skeleton';
import { OrganizationService } from '@/services/organization.service';
import { useAuthStore } from '@/store/authStore';
import WorkspaceSidebar from '@/components/workspace/WorkspaceSidebar';
import WorkspaceSwitcher from '@/components/workspace/WorkspaceSwitcher';

/**
 * Per-workspace layout — Odoo-style two-pane split:
 *   ┌──────────────┬─────────────────────────────┐
 *   │  Sidebar     │  Page content               │
 *   │  (perm tree) │                             │
 *   └──────────────┴─────────────────────────────┘
 *
 * The sidebar fetches /menu/tree/ which is filtered by the user's
 * permissions and the tenant's owned services — so a member who only has
 * `crm.leads_view` sees CRM → Leads → Pipeline / List, and nothing else.
 *
 * Workspace context (name + my role) loads once here and is passed down via
 * a top bar; the panel itself stays in `children`.
 */
export default function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = reactUse(params);
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const setPermissions = useAuthStore((s) => s.setPermissions);
  const setServices = useAuthStore((s) => s.setServices);
  const setHydrated = useAuthStore((s) => s.setHydrated);
  const [state, setState] = useState<'loading' | 'ok' | 'forbidden' | 'error'>('loading');
  const [workspace, setWorkspace] = useState<{ id: number; name: string } | null>(null);
  const [business, setBusiness] = useState<{ name: string; logo: string | null; brand_color?: string } | null>(null);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState('');

  // On a page refresh inside /w/<id>/... the (panel) layout doesn't run, so
  // the auth store starts empty and the per-page <PermissionGuard> would
  // flash "Not authorised" before /me/ returns. We fetch /me/ here in
  // parallel with workspaceContext, populate the store, and flip the
  // ``hydrated`` flag so the guard knows it's safe to decide.
  useEffect(() => {
    let cancelled = false;

    // /me/ here is for identity + owned services only. Permissions for THIS
    // panel are workspace-scoped and come from workspaceContext below — a
    // member can be an Accountant in one workspace and Front Desk in another,
    // so we must not let the org-wide /me/ codes drive what they see here.
    OrganizationService.me()
      .then((res) => {
        if (cancelled || !res?.success) return;
        const me = res.data;
        setUser({ email: me.email, role: me.is_admin ? 'ADMIN' : 'MEMBER' });
        if (Array.isArray(me.services)) setServices(me.services);
      })
      .catch(() => { /* /me/ failure doesn't block workspace access; guard will deny if needed */ });

    OrganizationService.workspaceContext(Number(id))
      .then((res) => {
        if (cancelled) return;
        if (!res?.success) {
          setErrMsg(res?.message || 'Failed to load workspace.');
          if (res?.data?.reason === 'not_a_member') setState('forbidden');
          else setState('error');
          setHydrated(true);
          return;
        }
        // Workspace-scoped permissions are authoritative inside /w/<id>.
        setPermissions(Array.isArray(res.data.permission_codes) ? res.data.permission_codes : []);
        setWorkspace(res.data.workspace);
        setBusiness(res.data.business ?? null);
        setMyRole(res.data.my_role);
        setState('ok');
        setHydrated(true);
      })
      .catch((err) => {
        if (cancelled) return;
        const status = err?.response?.status;
        const data = err?.response?.data;
        if (status === 403 && data?.data?.reason === 'not_a_member') {
          setErrMsg(data.message || "You're not assigned to this workspace.");
          setState('forbidden');
        } else {
          setErrMsg(data?.message ?? 'Failed to load workspace.');
          setState('error');
        }
        setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id, setUser, setPermissions, setServices, setHydrated]);

  if (state === 'loading') {
    // Polished split-pane shell so a refresh doesn't show a bare spinner.
    // Sidebar + top bar both rendered as shimmering skeletons; the page
    // content area is left to the child page's own <PermissionGuard>
    // skeleton so the placeholder matches the page type.
    return (
      <div className="flex min-h-screen bg-[#030712] text-slate-50">
        <aside className="hidden md:flex md:w-64 lg:w-72 shrink-0 flex-col border-r border-white/5 bg-[#080e1c] h-screen sticky top-0 p-5 gap-3">
          <Skeleton height={14} width={120} />
          <div className="mt-2 flex items-center gap-3">
            <Skeleton height={36} width={36} rounded="rounded-xl" />
            <div className="flex-1">
              <Skeleton height={14} width="60%" className="mb-2" />
              <Skeleton height={10} width="40%" />
            </div>
          </div>
          <div className="mt-5 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} height={32} rounded="rounded-lg" />
            ))}
          </div>
        </aside>
        <div className="flex-1 min-w-0 flex flex-col">
          <header className="h-14 border-b border-white/5 bg-[#080e1c]/80 backdrop-blur px-6 flex items-center gap-3">
            <Skeleton height={14} width={140} />
            <Skeleton height={20} width={64} rounded="rounded-full" />
          </header>
          <div className="flex-1 px-6 lg:px-10 py-6">
            <Skeleton height={28} width={220} className="mb-3" />
            <Skeleton height={14} width={320} className="mb-6" />
            <Skeleton height={200} rounded="rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (state === 'forbidden') {
    return (
      <main className="max-w-md mx-auto px-6 py-16 text-center">
        <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 mx-auto mb-4 flex items-center justify-center text-red-300">
          <Lock className="w-5 h-5" />
        </div>
        <h1 className="text-xl font-semibold text-white">Access denied</h1>
        <p className="text-sm text-slate-400 mt-2">{errMsg}</p>
        <Link href="/w" className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold">
          <ArrowLeft className="w-4 h-4" /> Back to workspaces
        </Link>
      </main>
    );
  }

  if (state === 'error') {
    return (
      <main className="max-w-md mx-auto px-6 py-16 text-center">
        <h1 className="text-xl font-semibold text-white">Couldn't load workspace</h1>
        <p className="text-sm text-slate-400 mt-2">{errMsg}</p>
        <button onClick={() => router.refresh()} className="mt-5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold">
          Retry
        </button>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#030712] text-slate-50">
      <WorkspaceSidebar workspaceId={id} workspaceName={workspace?.name ?? 'Workspace'} />
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar — business profile (brand) on the left, then workspace + role */}
        <header className="h-14 border-b border-white/5 bg-[#080e1c]/80 backdrop-blur px-6 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3 min-w-0">
            {/* Business profile (the brand) — always the primary header element. */}
            <div className="flex items-center gap-2.5 min-w-0">
              {business?.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={business.logo} alt={business.name} className="w-8 h-8 rounded-lg object-cover border border-white/10" />
              ) : (
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-black" style={{ background: business?.brand_color || '#10b981' }}>
                  {(business?.name || 'B')[0]?.toUpperCase()}
                </div>
              )}
              <span className="text-[15px] font-extrabold text-white truncate max-w-[220px]">{business?.name || 'Loading…'}</span>
            </div>
            <span className="h-5 w-px bg-white/10" />
            <WorkspaceSwitcher currentId={id} currentName={workspace?.name ?? 'Workspace'} />
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              {myRole ?? 'member'}
            </span>
          </div>
        </header>
        <div className="flex-1 px-6 lg:px-10 py-6">{children}</div>
      </div>
    </div>
  );
}
