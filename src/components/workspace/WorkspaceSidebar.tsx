'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as Icons from 'lucide-react';
import { OrganizationService } from '@/services/organization.service';

/**
 * Module-switcher workspace sidebar.
 *
 * Fetches `/menu/tree/?workspace=<id>` (Service → Module → Pages, already
 * filtered by the user's per-workspace permissions, owned services and the
 * workspace's industry). The backend also tags each service with a `group`
 * (Home / CRM / Store / Finance / Ops / People / Settings) and returns
 * `group_order`. We render a **module switcher** at the top and show only the
 * active module's nav below — Odoo/Salesforce-style, instead of one long tree.
 *
 * Gating still lives entirely in the backend; this is purely presentation.
 */

type MenuPage = { key: string; label: string; path: string; icon: string; permission: string | null; unread?: number };
type MenuModule = { code: string; name: string; icon: string; pages: MenuPage[] };
type MenuService = { code: string; name: string; icon: string; color: string; group: string; modules: MenuModule[] };
type MenuTree = { services: MenuService[]; group_order?: string[]; is_admin: boolean };

// Icon per module group (lucide PascalCase names).
const GROUP_ICON: Record<string, string> = {
  Home: 'House', CRM: 'Users', Store: 'ShoppingBag', Finance: 'Wallet',
  Ops: 'Zap', People: 'UserCog', Settings: 'Settings', More: 'LayoutGrid',
};

function Icon({ name, className }: { name: string; className?: string }) {
  const key = name.split('-').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join('') || 'Circle';
  const C = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[key] ?? Icons.Circle;
  return <C className={className} />;
}

export default function WorkspaceSidebar({ workspaceId, workspaceName }: { workspaceId: string | number; workspaceName: string }) {
  const pathname = usePathname();
  const [tree, setTree] = useState<MenuTree | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);

  const prefix = `/w/${workspaceId}`;

  useEffect(() => {
    let cancelled = false;
    OrganizationService.menuTree(workspaceId)
      .then((res) => {
        if (cancelled || !res?.success) return;
        setTree(res.data);
        const all: Record<string, boolean> = {};
        res.data.services.forEach((s: MenuService) =>
          s.modules.forEach((m: MenuModule) => { all[`${s.code}.${m.code}`] = true; }),
        );
        setOpen(all);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [workspaceId]);

  // Groups present, in backend order.
  const groups = useMemo(() => {
    if (!tree) return [];
    const present = Array.from(new Set(tree.services.map((s) => s.group || 'More')));
    const order = tree.group_order && tree.group_order.length ? tree.group_order : present;
    return order.filter((g) => present.includes(g));
  }, [tree]);

  // Default the active module to the one containing the current route, else first.
  useEffect(() => {
    if (!tree || activeGroup) return;
    const here = tree.services.find((s) =>
      s.modules.some((m) => m.pages.some((p) => p.path !== '/' && pathname?.startsWith(prefix + p.path))),
    );
    setActiveGroup(here?.group || groups[0] || null);
  }, [tree, groups, activeGroup, pathname, prefix]);

  const isActive = (path: string) => {
    const full = prefix + path;
    if (pathname === full) return true;
    if (path !== '/' && pathname?.startsWith(full + '/')) return true;
    return false;
  };

  const activeServices = (tree?.services ?? []).filter((s) => (s.group || 'More') === activeGroup);

  return (
    <aside className="hidden md:flex md:w-64 lg:w-72 shrink-0 flex-col border-r border-white/5 bg-[#080e1c] h-screen sticky top-0">
      {/* Workspace header */}
      <div className="px-5 py-5 border-b border-white/5">
        <Link href="/w" className="text-[11px] uppercase tracking-wider text-slate-500 hover:text-slate-300 inline-flex items-center gap-1">
          <Icons.ArrowLeft className="w-3 h-3" />
          All workspaces
        </Link>
        <div className="mt-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center text-white font-bold">
            {workspaceName?.[0]?.toUpperCase() || 'W'}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white truncate">{workspaceName}</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Workspace</div>
          </div>
        </div>
      </div>

      {/* Pinned: Overview + Members */}
      <div className="px-3 pt-4 space-y-1">
        <Link href={prefix} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${pathname === prefix ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'text-slate-300 hover:bg-white/[0.04]'}`}>
          <Icons.LayoutDashboard className="w-4 h-4" /> Overview
        </Link>
        <Link href={`${prefix}/members`} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${pathname === `${prefix}/members` ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'text-slate-300 hover:bg-white/[0.04]'}`}>
          <Icons.Users className="w-4 h-4" /> Members
        </Link>
      </div>

      {/* Module switcher */}
      {groups.length > 0 && (
        <div className="px-3 pt-3 pb-2">
          <div className="text-[10px] uppercase tracking-[0.12em] font-semibold text-slate-500 px-1 mb-1.5">Modules</div>
          <div className="flex flex-wrap gap-1.5">
            {groups.map((g) => {
              const on = g === activeGroup;
              return (
                <button
                  key={g}
                  onClick={() => setActiveGroup(g)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${on ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25' : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent'}`}
                >
                  <Icon name={GROUP_ICON[g] || 'LayoutGrid'} className="w-3.5 h-3.5" />
                  {g}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Active module's nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-5 border-t border-white/5">
        {loading && <div className="px-3 pt-3 text-xs text-slate-500">Loading menu…</div>}
        {!loading && tree && tree.services.length === 0 && (
          <div className="px-3 pt-3 text-xs text-slate-500">No services available. Ask your admin to grant you permissions.</div>
        )}
        {activeServices.map((svc) => (
          <div key={svc.code} className="pt-3">
            <div className="px-3 mb-2 flex items-center gap-2">
              <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ backgroundColor: `${svc.color}1f`, color: svc.color }}>
                <Icon name={svc.icon} className="w-3 h-3" />
              </div>
              <span className="text-[10px] uppercase tracking-[0.12em] font-semibold text-slate-400">{svc.name}</span>
            </div>
            <div className="space-y-1">
              {svc.modules.map((mod) => {
                const isOpen = open[`${svc.code}.${mod.code}`];
                return (
                  <div key={mod.code}>
                    <button
                      onClick={() => setOpen((o) => ({ ...o, [`${svc.code}.${mod.code}`]: !isOpen }))}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white"
                    >
                      <Icon name={mod.icon} className="w-3.5 h-3.5 text-slate-500" />
                      <span className="flex-1 text-left">{mod.name}</span>
                      <Icons.ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? '' : '-rotate-90'} text-slate-500`} />
                    </button>
                    {isOpen && (
                      <div className="mt-0.5 pl-3 space-y-0.5">
                        {mod.pages.map((page) => {
                          const active = isActive(page.path);
                          return (
                            <Link
                              key={page.key}
                              href={prefix + page.path}
                              className={`group flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[13px] transition-colors ${active ? 'bg-emerald-500/10 text-emerald-300' : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'}`}
                            >
                              <Icon name={page.icon} className={`w-3.5 h-3.5 ${active ? 'text-emerald-300' : 'text-slate-500 group-hover:text-slate-300'}`} />
                              <span className="flex-1 truncate">{page.label}</span>
                              {page.unread && page.unread > 0 ? (
                                <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] font-semibold bg-emerald-500 text-white">
                                  {page.unread > 99 ? '99+' : page.unread}
                                </span>
                              ) : null}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/5 px-3 py-3 text-[10px] uppercase tracking-wider text-slate-600">
        {tree?.is_admin ? 'Admin view' : 'Member view'}
      </div>
    </aside>
  );
}
