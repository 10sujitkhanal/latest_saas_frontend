'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import * as Icons from 'lucide-react';
import { OrganizationService } from '@/services/organization.service';

/**
 * Module-switcher workspace sidebar.
 *
 * Header shows the BUSINESS profile (the tenant's own name + logo). The nav is
 * driven by `/menu/tree/?workspace=<id>` (already gated by per-workspace
 * permissions, owned services + the workspace's industry). Each service is
 * tagged with a `group` (Home/CRM/Store/Finance/Ops/People/Settings); the user
 * picks a module from a **searchable dropdown** and we show only that module's
 * nav. Gating stays 100% backend; this is presentation only.
 */

type MenuPage = { key: string; label: string; path: string; icon: string; permission: string | null; unread?: number };
type MenuModule = { code: string; name: string; icon: string; pages: MenuPage[] };
type MenuService = { code: string; name: string; icon: string; color: string; group: string; modules: MenuModule[] };
type MenuTree = { services: MenuService[]; group_order?: string[]; is_admin: boolean };

const GROUP_ICON: Record<string, string> = {
  Home: 'House', CRM: 'Users', Store: 'ShoppingBag', Finance: 'Wallet',
  Ops: 'Zap', People: 'UserCog', Settings: 'Settings', More: 'LayoutGrid',
};

function Icon({ name, className }: { name: string; className?: string }) {
  const key = name.split('-').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join('') || 'Circle';
  const C = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[key] ?? Icons.Circle;
  return <C className={className} />;
}

export default function WorkspaceSidebar({
  workspaceId, workspaceName, businessName, businessLogo,
}: {
  workspaceId: string | number;
  workspaceName: string;
  businessName?: string | null;
  businessLogo?: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [tree, setTree] = useState<MenuTree | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [query, setQuery] = useState('');
  const switcherRef = useRef<HTMLDivElement>(null);

  const prefix = `/w/${workspaceId}`;
  const brand = businessName || workspaceName || 'Workspace';

  useEffect(() => {
    let cancelled = false;
    OrganizationService.menuTree(workspaceId)
      .then((res) => {
        if (cancelled || !res?.success) return;
        setTree(res.data);
        const all: Record<string, boolean> = {};
        res.data.services.forEach((s: MenuService) =>
          s.modules.forEach((m: MenuModule) => { all[`${s.code}.${m.code}`] = true; }));
        setOpen(all);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [workspaceId]);

  // Close the module dropdown on outside click.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) setSwitcherOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const groups = useMemo(() => {
    if (!tree) return [];
    const present = Array.from(new Set(tree.services.map((s) => s.group || 'More')));
    const order = tree.group_order?.length ? tree.group_order : present;
    return order.filter((g) => present.includes(g));
  }, [tree]);

  // Flat page list for the dropdown search (jump to any page).
  const allPages = useMemo(() => {
    if (!tree) return [];
    return tree.services.flatMap((s) =>
      s.modules.flatMap((m) => m.pages.map((p) => ({ ...p, group: s.group || 'More', service: s.name }))));
  }, [tree]);

  useEffect(() => {
    if (!tree || activeGroup) return;
    const here = tree.services.find((s) =>
      s.modules.some((m) => m.pages.some((p) => p.path !== '/' && pathname?.startsWith(prefix + p.path))));
    setActiveGroup(here?.group || groups[0] || null);
  }, [tree, groups, activeGroup, pathname, prefix]);

  const isActive = (path: string) => {
    const full = prefix + path;
    return pathname === full || (path !== '/' && !!pathname?.startsWith(full + '/'));
  };

  const activeServices = (tree?.services ?? []).filter((s) => (s.group || 'More') === activeGroup);
  const q = query.trim().toLowerCase();
  const pageMatches = q ? allPages.filter((p) => p.label.toLowerCase().includes(q) || p.service.toLowerCase().includes(q)).slice(0, 8) : [];
  const groupMatches = q ? groups.filter((g) => g.toLowerCase().includes(q)) : groups;

  const pickGroup = (g: string) => { setActiveGroup(g); setSwitcherOpen(false); setQuery(''); };
  const goPage = (path: string) => { setSwitcherOpen(false); setQuery(''); router.push(prefix + path); };

  return (
    <aside className="hidden md:flex md:w-64 lg:w-72 shrink-0 flex-col border-r border-white/5 bg-[#080e1c] h-screen sticky top-0">
      {/* Business profile header */}
      <div className="px-4 py-4 border-b border-white/5">
        <Link href="/w" className="text-[10px] uppercase tracking-wider text-slate-500 hover:text-slate-300 inline-flex items-center gap-1">
          <Icons.ArrowLeft className="w-3 h-3" /> All workspaces
        </Link>
        <div className="mt-3 flex items-center gap-3">
          {businessLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={businessLogo} alt={brand} className="w-10 h-10 rounded-xl object-cover border border-white/10" />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center text-white font-bold">
              {brand[0]?.toUpperCase() || 'B'}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-sm font-bold text-white truncate">{brand}</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 truncate">{workspaceName}</div>
          </div>
        </div>
      </div>

      {/* Pinned: Overview + Members */}
      <div className="px-3 pt-3 space-y-1">
        <Link href={prefix} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${pathname === prefix ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'text-slate-300 hover:bg-white/[0.04]'}`}>
          <Icons.LayoutDashboard className="w-4 h-4" /> Overview
        </Link>
        <Link href={`${prefix}/members`} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${pathname === `${prefix}/members` ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'text-slate-300 hover:bg-white/[0.04]'}`}>
          <Icons.Users className="w-4 h-4" /> Members
        </Link>
      </div>

      {/* Module switcher — searchable dropdown */}
      {groups.length > 0 && (
        <div className="px-3 pt-3 pb-1 relative" ref={switcherRef}>
          <button
            onClick={() => setSwitcherOpen((o) => !o)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 text-sm font-semibold text-white"
          >
            <Icon name={GROUP_ICON[activeGroup || ''] || 'LayoutGrid'} className="w-4 h-4 text-emerald-300" />
            <span className="flex-1 text-left truncate">{activeGroup || 'Modules'}</span>
            <Icons.ChevronsUpDown className="w-3.5 h-3.5 text-slate-500" />
          </button>

          {switcherOpen && (
            <div className="absolute left-3 right-3 top-full mt-1.5 z-30 rounded-xl border border-white/10 bg-slate-900 shadow-2xl py-1.5">
              <div className="px-2 pb-1.5">
                <div className="flex items-center gap-2 rounded-lg bg-white/[0.05] border border-white/10 px-2.5 py-1.5">
                  <Icons.Search className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search modules & pages…"
                    className="flex-1 bg-transparent text-xs text-white placeholder:text-slate-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {/* Page jump-to results when searching */}
                {q && pageMatches.length > 0 && (
                  <div className="px-1.5 pb-1">
                    <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-slate-500 font-bold">Pages</div>
                    {pageMatches.map((p) => (
                      <button key={p.key} onClick={() => goPage(p.path)} className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left hover:bg-white/5">
                        <Icon name={p.icon} className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="flex-1 min-w-0 text-[13px] text-slate-200 truncate">{p.label}</span>
                        <span className="text-[10px] text-slate-500 shrink-0">{p.group}</span>
                      </button>
                    ))}
                  </div>
                )}
                {/* Module list */}
                <div className="px-1.5">
                  {q && <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-slate-500 font-bold">Modules</div>}
                  {groupMatches.map((g) => {
                    const on = g === activeGroup;
                    return (
                      <button key={g} onClick={() => pickGroup(g)} className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left ${on ? 'bg-emerald-500/15 text-emerald-300' : 'text-slate-200 hover:bg-white/5'}`}>
                        <Icon name={GROUP_ICON[g] || 'LayoutGrid'} className="w-4 h-4 shrink-0" />
                        <span className="flex-1 text-[13px] font-semibold">{g}</span>
                        {on && <Icons.Check className="w-3.5 h-3.5 shrink-0" />}
                      </button>
                    );
                  })}
                  {q && pageMatches.length === 0 && groupMatches.length === 0 && (
                    <div className="px-3 py-3 text-xs text-slate-500">No matches.</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Active module's nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-5">
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
                    <button onClick={() => setOpen((o) => ({ ...o, [`${svc.code}.${mod.code}`]: !isOpen }))} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white">
                      <Icon name={mod.icon} className="w-3.5 h-3.5 text-slate-500" />
                      <span className="flex-1 text-left">{mod.name}</span>
                      <Icons.ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? '' : '-rotate-90'} text-slate-500`} />
                    </button>
                    {isOpen && (
                      <div className="mt-0.5 pl-3 space-y-0.5">
                        {mod.pages.map((page) => {
                          const active = isActive(page.path);
                          return (
                            <Link key={page.key} href={prefix + page.path} className={`group flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[13px] transition-colors ${active ? 'bg-emerald-500/10 text-emerald-300' : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'}`}>
                              <Icon name={page.icon} className={`w-3.5 h-3.5 ${active ? 'text-emerald-300' : 'text-slate-500 group-hover:text-slate-300'}`} />
                              <span className="flex-1 truncate">{page.label}</span>
                              {page.unread && page.unread > 0 ? (
                                <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] font-semibold bg-emerald-500 text-white">{page.unread > 99 ? '99+' : page.unread}</span>
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
