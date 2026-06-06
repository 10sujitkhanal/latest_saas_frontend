import { OrganizationService } from '@/services/organization.service';

/**
 * Decide where a freshly-authenticated TEAM user lands, by who they are:
 *   • owner / admin            -> /dashboard (the org command center)
 *   • staff with 1 workspace   -> /w/<id>   (straight into their workspace)
 *   • staff with >1 workspace  -> /w        (workspace picker)
 *   • staff with none / unknown-> /w        (empty list is self-explanatory)
 *
 * (Storefront customers authenticate through the storefront, not this login,
 * so they're never routed here.)
 */
export async function resolvePostLoginPath(): Promise<string> {
  try {
    const me = await OrganizationService.me();
    const d = (me?.data ?? me) as { is_admin?: boolean } | undefined;
    if (d?.is_admin) return '/dashboard';

    const ws = await OrganizationService.myWorkspaces();
    const list = (ws?.data?.workspaces ?? ws?.workspaces ?? []) as Array<{ id: number }>;
    if (Array.isArray(list) && list.length === 1) return `/w/${list[0].id}`;
    return '/w';
  } catch {
    return '/dashboard';
  }
}
