'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as Icons from 'lucide-react';
import { OrganizationService } from '@/services/organization.service';

/**
 * Permission-driven workspace sidebar.
 *
 * Fetches `/menu/tree/` (returns Service → Module → Pages filtered by the
 * user's permissions and the tenant's owned services) and renders it
 * Odoo-style: grouped sections with collapsible module headers.
 *
 * Workspace ID is prepended to every page path so a leaf `/leads` becomes
 * `/w/<id>/leads`.
 */

type MenuPage = {
  key: string;
  label: string;
  path: string;
  icon: string;
  permission: string | null;
  unread?: number;
};

type MenuModule = {
  code: string;
  name: string;
  icon: string;
  pages: MenuPage[];
};

type MenuService = {
  code: string;
  name: string;
  icon: string;
  color: string;
  modules: MenuModule[];
};

type MenuTree = {
  services: MenuService[];
  is_admin: boolean;
};

function Icon({ name, className }: { name: string; className?: string }) {
  // Lucide exports PascalCase. Convert "user-cog" → "UserCog".
  const key =
    name
      .split('-')
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join('') || 'Circle';
  const C = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[key] ?? Icons.Circle;
  return <C className={className} />;
}

export default function WorkspaceSidebar({ workspaceId, workspaceName }: { workspaceId: string | number; workspaceName: string }) {
  const pathname = usePathname();
  const [tree, setTree] = useState<MenuTree | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    OrganizationService.menuTree(workspaceId)
      .then((res) => {
        if (cancelled) return;
        if (res?.success) {
          setTree(res.data);
          // Expand every module by default — Odoo-ish.
          const all: Record<string, boolean> = {};
          res.data.services.forEach((s: MenuService) =>
            s.modules.forEach((m: MenuModule) => {
              all[`${s.code}.${m.code}`] = true;
            }),
          );
          setOpen(all);
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const prefix = `/w/${workspaceId}`;

  const isActive = (path: string) => {
    const full = prefix + path;
    if (pathname === full) return true;
    // Treat /w/1/leads as parent of /w/1/leads/automation.
    if (path !== '/' && pathname?.startsWith(full + '/')) return true;
    return false;
  };

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

      {/* Overview link (always visible) */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        <div>
          <Link
            href={prefix}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              pathname === prefix
                ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                : 'text-slate-300 hover:bg-white/[0.04]'
            }`}
          >
            <Icons.LayoutDashboard className="w-4 h-4" />
            Overview
          </Link>
          <Link
            href={`${prefix}/members`}
            className={`mt-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              pathname === `${prefix}/members`
                ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                : 'text-slate-300 hover:bg-white/[0.04]'
            }`}
          >
            <Icons.Users className="w-4 h-4" />
            Members
          </Link>
        </div>

        {/* Permission-grouped tree */}
        {loading && (
          <div className="px-3 text-xs text-slate-500">Loading menu…</div>
        )}
        {!loading && tree && tree.services.length === 0 && (
          <div className="px-3 text-xs text-slate-500">
            No services available. Ask your admin to grant you permissions.
          </div>
        )}
        {tree?.services.map((svc) => (
          <div key={svc.code}>
            <div className="px-3 mb-2 flex items-center gap-2">
              <div
                className="w-5 h-5 rounded-md flex items-center justify-center"
                style={{ backgroundColor: `${svc.color}1f`, color: svc.color }}
              >
                <Icon name={svc.icon} className="w-3 h-3" />
              </div>
              <span className="text-[10px] uppercase tracking-[0.12em] font-semibold text-slate-400">
                {svc.name}
              </span>
            </div>
            <div className="space-y-1">
              {svc.modules.map((mod) => {
                const isOpen = open[`${svc.code}.${mod.code}`];
                return (
                  <div key={mod.code}>
                    <button
                      onClick={() =>
                        setOpen((o) => ({ ...o, [`${svc.code}.${mod.code}`]: !isOpen }))
                      }
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white"
                    >
                      <Icon name={mod.icon} className="w-3.5 h-3.5 text-slate-500" />
                      <span className="flex-1 text-left">{mod.name}</span>
                      <Icons.ChevronDown
                        className={`w-3.5 h-3.5 transition-transform ${isOpen ? '' : '-rotate-90'} text-slate-500`}
                      />
                    </button>
                    {isOpen && (
                      <div className="mt-0.5 pl-3 space-y-0.5">
                        {mod.pages.map((page) => {
                          const active = isActive(page.path);
                          return (
                            <Link
                              key={page.key}
                              href={prefix + page.path}
                              className={`group flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[13px] transition-colors ${
                                active
                                  ? 'bg-emerald-500/10 text-emerald-300'
                                  : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'
                              }`}
                            >
                              <Icon
                                name={page.icon}
                                className={`w-3.5 h-3.5 ${active ? 'text-emerald-300' : 'text-slate-500 group-hover:text-slate-300'}`}
                              />
                              <span className="flex-1 truncate">{page.label}</span>
                              {page.unread && page.unread > 0 ? (
                                <span
                                  className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] font-semibold bg-emerald-500 text-white"
                                  title={`${page.unread} new message${page.unread === 1 ? '' : 's'}`}
                                >
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
