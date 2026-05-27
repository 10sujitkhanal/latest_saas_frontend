'use client';

import { useAuthStore } from '@/store/authStore';

/**
 * Permission + service-ownership hooks.
 *
 * These mirror the server-side gates exactly so the UI can hide /
 * disable affordances the user doesn't have:
 *
 *   const canEditLead = useHasPerm('crm.leads_edit');
 *   const canManageCreds = useHasPerm(['credentials.add', 'credentials.edit']);
 *   const hasScheduling = useHasService('scheduling');
 *
 * Owners + admins receive the wildcard ``*`` from the backend on login,
 * so ``useHasPerm`` automatically returns ``true`` for them on any code.
 *
 * NOTE: never rely on these for security — the API enforces the same
 * rules and will 403. UI checks are for affordance polish (hide a
 * disabled "Delete" button) and routing (don't show a tab the user
 * can't load).
 */

/** True when the current user is an org admin / owner / superuser.
 *
 * Three accepted flavours, mirroring the backend's
 * ``_is_admin_user`` helper:
 *   - Legacy ``user.role === 'ADMIN'`` flag
 *   - The wildcard ``*`` code on the user's permission_codes list
 *     (the backend grants ``*`` to anyone with ``role_obj.code='owner'``
 *     or ``is_superuser=True``)
 *
 * Use this to gate upgrade / billing affordances so plain members see
 * "Contact your admin" instead of an Upgrade button they can't act on.
 */
export function useIsAdmin(): boolean {
  const role = useAuthStore((s) => s.user?.role);
  const codes = useAuthStore((s) => s.permissionCodes);
  if (role === 'ADMIN') return true;
  return !!codes?.includes('*');
}


/** True when the user holds the given code (or one of the codes). */
export function useHasPerm(code: string | string[]): boolean {
  const held = useAuthStore((s) => s.permissionCodes);
  if (!held || held.length === 0) return false;
  if (held.includes('*')) return true;
  const list = Array.isArray(code) ? code : [code];
  return list.some((c) => held.includes(c));
}

/** True when the current org actively owns the named service. */
export function useHasService(serviceCode: string): boolean {
  const services = useAuthStore((s) => s.services);
  if (!services) return false;
  return services.some(
    (s) => s.is_owned && (s.code === serviceCode || s.name.toLowerCase() === serviceCode.toLowerCase()),
  );
}

/**
 * Combined check matching the server's ``HasPermissionCode`` gate when
 * both a service AND a code are required. Returns ``{ok, reason}`` so
 * the caller can render a tailored "upgrade" vs "ask admin" message.
 *
 *   const gate = useAccess({ service: 'crm', perm: 'credentials.add' });
 *   if (!gate.ok && gate.reason === 'no_service') return <UpgradePanel />;
 *   if (!gate.ok && gate.reason === 'no_perm')    return <NotAllowed />;
 */
export function useAccess({
  service, perm,
}: { service?: string; perm?: string | string[] }): { ok: boolean; reason: null | 'no_service' | 'no_perm' } {
  const hasService = useHasService(service || '');
  const hasPerm = useHasPerm(perm || '');
  if (service && !hasService) return { ok: false, reason: 'no_service' };
  if (perm && !hasPerm) return { ok: false, reason: 'no_perm' };
  return { ok: true, reason: null };
}
