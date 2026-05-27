'use client';

import Link from 'next/link';
import { ShieldAlert, Lock } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { PageSkeleton } from './Skeleton';

/**
 * Permission guard — gates a page on two independent layers:
 *
 *   1. **Org-level service access** (``service`` prop): if set, the
 *      tenant must currently own that platform Service (e.g. ``"crm"``,
 *      ``"scheduling"``). Failure renders an "Upgrade required" panel
 *      pointing the user at /subscription. This catches the case where
 *      a workspace member's Role *would* grant the permission, but the
 *      org never paid for the service in the first place.
 *
 *   2. **User-level permission code** (``required`` prop): a single code
 *      or array of codes — ANY match passes. Failure renders a "Not
 *      authorised" panel asking the user to talk to their admin.
 *
 *   <PermissionGuard service="crm" required="crm.leads_view" workspaceId={id} skeleton="kanban">
 *      <PipelinePage ... />
 *   </PermissionGuard>
 *
 * Owners / admins always pass the user-level gate — the auth store puts
 * the wildcard ``*`` into ``permissionCodes`` on login for them. They do
 * NOT bypass the service gate: if the org doesn't own a service, even
 * the owner shouldn't be using its endpoints (they wouldn't work
 * anyway — backend will 403 with reason='service_not_owned').
 *
 * Hydration: while ``useAuthStore.hydrated === false`` (the layout is
 * still calling /me/), the guard renders a full-page skeleton matching
 * the kind of page underneath, so a hard-refresh on a protected page
 * never flashes "Not authorised" before /me/ has had a chance to
 * populate the codes + services.
 *
 * Server enforcement: this is a UX guard only. The server enforces both
 * the same permission code AND the same service ownership via
 * ``HasPermissionCode`` on every endpoint, so a determined user can't
 * bypass either by editing JS — the API will simply 403.
 */
export default function PermissionGuard({
  required,
  service,
  workspaceId,
  skeleton = 'generic',
  children,
}: {
  required?: string | string[];
  /** Service code (e.g. "crm", "scheduling") the org must own. */
  service?: string;
  workspaceId?: string | number;
  skeleton?: 'kanban' | 'list' | 'detail' | 'grid' | 'inbox' | 'dashboard' | 'form' | 'generic';
  children: React.ReactNode;
}) {
  const codes_held = useAuthStore((s) => s.permissionCodes);
  const services_held = useAuthStore((s) => s.services);
  const hydrated = useAuthStore((s) => s.hydrated);
  const role = useAuthStore((s) => s.user?.role);
  // Mirrors ``useIsAdmin`` without the hook indirection (PermissionGuard
  // is its own client component so a re-render-only call is fine).
  const isAdmin = role === 'ADMIN' || !!codes_held?.includes('*');

  // Don't make a judgement until /me/ has landed.
  if (!hydrated) return <PageSkeleton kind={skeleton} />;

  // ── Service ownership ────────────────────────────────────────────
  if (service) {
    const owned = services_held?.some((s) => s.is_owned && (s.code === service || s.name.toLowerCase() === service.toLowerCase()));
    if (!owned) {
      return (
        <main className="max-w-md mx-auto py-16 text-center">
          <div className="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/30 mx-auto mb-4 flex items-center justify-center text-cyan-300">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-semibold text-white">
            {isAdmin ? 'Upgrade required' : 'Locked by your plan'}
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            Your organization doesn&apos;t have access to the{' '}
            <code className="text-cyan-300">{service}</code> service.
            {isAdmin
              ? <> Add it from <strong>Subscription</strong> to unlock this page.</>
              : <> Ask your admin to upgrade so this page unlocks.</>}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            {isAdmin ? (
              <Link href="/subscription" className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold">
                View plans
              </Link>
            ) : (
              <span className="px-4 py-2 rounded-lg border border-white/15 text-slate-300 text-sm font-semibold">
                Contact your admin
              </span>
            )}
            {workspaceId && (
              <Link href={`/w/${workspaceId}`} className="px-4 py-2 rounded-lg border border-white/10 text-slate-300 hover:bg-white/[0.04] text-sm font-semibold">
                Back
              </Link>
            )}
          </div>
        </main>
      );
    }
  }

  // ── User-level permission code ───────────────────────────────────
  if (required) {
    const codes = Array.isArray(required) ? required : [required];
    const has = (c: string) => codes_held?.includes('*') || codes_held?.includes(c);
    const ok = codes.some(has);
    if (!ok) {
      return (
        <main className="max-w-md mx-auto py-16 text-center">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 mx-auto mb-4 flex items-center justify-center text-amber-300">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-semibold text-white">Not authorised</h1>
          <p className="text-sm text-slate-400 mt-2">
            You don&apos;t have permission to view this page. Ask an admin to grant{' '}
            <code className="text-emerald-300">{codes.join(' or ')}</code>.
          </p>
          {workspaceId && (
            <Link href={`/w/${workspaceId}`} className="mt-5 inline-block px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold">
              Back to workspace
            </Link>
          )}
        </main>
      );
    }
  }

  return <>{children}</>;
}
