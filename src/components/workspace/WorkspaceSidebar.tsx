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
type MenuTree = { services: MenuService[]; pinned?: MenuPage[]; group_order?: string[]; is_admin: boolean };

const GROUP_ICON: Record<string, string> = {
  Home: 'House', CRM: 'Users', Store: 'ShoppingBag', Finance: 'Wallet',
  Documents: 'FileSignature', Ops: 'Zap', People: 'UserCog', Settings: 'Settings', More: 'LayoutGrid',
};

function Icon({ name, className }: { name: string; className?: string }) {
  const key = name.split('-').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join('') || 'Circle';
  const C = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[key] ?? Icons.Circle;
  return <C className={className} />;
}

export default function WorkspaceSidebar({
  workspaceId, workspaceName,
}: {
  workspaceId: string | number;
  workspaceName: string;
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
  // Global command palette (Ctrl/⌘-K) — jump to any page in any module.
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [paletteIdx, setPaletteIdx] = useState(0);

  const prefix = `/w/${workspaceId}`;

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

  // Global command palette: Ctrl/⌘-K toggles, Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      } else if (e.key === 'Escape') {
        setPaletteOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Reset palette state each time it opens.
  useEffect(() => {
    if (paletteOpen) { setPaletteQuery(''); setPaletteIdx(0); }
  }, [paletteOpen]);

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

  // First navigable page of a group's first service — the module's landing page.
  const firstPathForGroup = (g: string): string | null => {
    const svc = (tree?.services ?? []).find((s) => (s.group || 'More') === g);
    for (const m of svc?.modules ?? []) {
      const p = m.pages.find((pg) => pg.path && pg.path !== '/');
      if (p) return p.path;
    }
    return svc?.modules?.[0]?.pages?.[0]?.path ?? null;
  };

  const pickGroup = (g: string) => {
    setActiveGroup(g);
    setSwitcherOpen(false);
    setQuery('');
    // Switching modules should take you INTO that module, not just re-skin the
    // sidebar — otherwise the main view stays on the previous page (confusing).
    // Only jump if we're not already somewhere inside the picked group.
    const path = firstPathForGroup(g);
    if (path) {
      const target = prefix + path;
      const alreadyHere = pathname === target || pathname?.startsWith(target + '/');
      if (!alreadyHere) router.push(target);
    }
  };
  const goPage = (path: string) => { setSwitcherOpen(false); setQuery(''); router.push(prefix + path); };

  // Command-palette results: every page across modules, filtered by query.
  const pq = paletteQuery.trim().toLowerCase();
  const paletteResults = useMemo(() => {
    const list = pq
      ? allPages.filter((p) => p.label.toLowerCase().includes(pq) || p.service.toLowerCase().includes(pq) || p.group.toLowerCase().includes(pq))
      : allPages;
    return list.slice(0, 40);
  }, [allPages, pq]);

  const goPalette = (p: { path: string; group?: string }) => {
    setPaletteOpen(false);
    if (p.group) setActiveGroup(p.group);
    router.push(prefix + p.path);
  };

  const onPaletteKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setPaletteIdx((i) => Math.min(i + 1, paletteResults.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setPaletteIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); const p = paletteResults[paletteIdx]; if (p) goPalette(p); }
  };

  return (
    <aside className="hidden md:flex md:w-64 lg:w-72 shrink-0 flex-col border-r border-white/5 bg-[#080e1c] h-screen sticky top-0">
      {/* Sidebar header — back to the owner cockpit + workspace switcher. The
          owner-dashboard button only shows for org owners/admins (a workspace
          member without org access shouldn't be sent to the org panel). */}
      <div className="px-4 py-4 border-b border-white/5 space-y-2">
        {tree?.is_admin && (
          <Link href="/dashboard" className="flex items-center gap-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 px-3 py-2 text-[13px] font-semibold text-slate-200 hover:text-white transition-colors">
            <Icons.LayoutDashboard className="w-4 h-4 text-emerald-300" /> Owner dashboard
          </Link>
        )}
        <Link href="/w" className="text-[11px] uppercase tracking-wider text-slate-400 hover:text-slate-200 inline-flex items-center gap-1.5">
          <Icons.ArrowLeft className="w-3.5 h-3.5" /> All workspaces
        </Link>
      </div>

      {/* Command palette launcher */}
      <div className="px-3 pt-3">
        <button
          onClick={() => setPaletteOpen(true)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <Icons.Search className="w-3.5 h-3.5 shrink-0" />
          <span className="flex-1 text-left text-[13px]">Search…</span>
          <kbd className="text-[10px] font-sans font-semibold text-slate-500 bg-white/[0.06] border border-white/10 rounded px-1.5 py-0.5">⌘K</kbd>
        </button>
      </div>

      {/* Pinned: Overview + Members */}
      <div className="px-3 pt-3 space-y-1">
        <Link href={prefix} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${pathname === prefix ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'text-slate-300 hover:bg-white/[0.04]'}`}>
          <Icons.LayoutDashboard className="w-4 h-4" /> Overview
        </Link>
        <Link href={`${prefix}/members`} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${pathname === `${prefix}/members` ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'text-slate-300 hover:bg-white/[0.04]'}`}>
          <Icons.Users className="w-4 h-4" /> Members
        </Link>
        {/* Pinned, permission-gated entries from the backend menu tree (e.g. AI
            Staff — only present when the user holds `agents.manage`). */}
        {(tree?.pinned ?? []).map((page) => (
          <Link key={page.key} href={prefix + page.path} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive(page.path) ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'text-slate-300 hover:bg-white/[0.04]'}`}>
            <Icon name={page.icon} className="w-4 h-4" /> {page.label}
            <span className="ml-auto text-[9px] font-bold uppercase tracking-wider rounded-full bg-emerald-500/15 text-emerald-300 px-1.5 py-0.5">New</span>
          </Link>
        ))}
      </div>

      {/* Module switcher — searchable dropdown */}
      {groups.length > 0 && (
        <div className="px-3 pt-3 pb-1 relative" ref={switcherRef}>
          <button
            onClick={() => setSwitcherOpen((o) => !o)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 text-white"
          >
            <span className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <Icon name={GROUP_ICON[activeGroup || ''] || 'LayoutGrid'} className="w-4 h-4 text-emerald-300" />
            </span>
            <span className="flex-1 min-w-0 text-left">
              <span className="block text-[9px] uppercase tracking-[0.14em] text-slate-500 font-bold leading-none mb-1">Module</span>
              <span className="block text-sm font-semibold truncate leading-none">{activeGroup || 'Select module'}</span>
            </span>
            <Icons.ChevronsUpDown className="w-4 h-4 text-slate-500 shrink-0" />
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

      {/* ── Command palette (Ctrl/⌘-K) ───────────────────────────────── */}
      {paletteOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4 bg-black/60 backdrop-blur-sm"
          onMouseDown={() => setPaletteOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 shadow-2xl overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 px-4 border-b border-white/10">
              <Icons.Search className="w-4 h-4 text-slate-500 shrink-0" />
              <input
                autoFocus
                value={paletteQuery}
                onChange={(e) => { setPaletteQuery(e.target.value); setPaletteIdx(0); }}
                onKeyDown={onPaletteKey}
                placeholder="Jump to any page…"
                className="flex-1 bg-transparent py-3.5 text-sm text-white placeholder:text-slate-500 focus:outline-none"
              />
              <kbd className="text-[10px] font-sans font-semibold text-slate-500 bg-white/[0.06] border border-white/10 rounded px-1.5 py-0.5">esc</kbd>
            </div>
            <div className="max-h-[55vh] overflow-y-auto py-1.5">
              {paletteResults.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-slate-500">No pages match “{paletteQuery}”.</div>
              )}
              {paletteResults.map((p, i) => {
                const on = i === paletteIdx;
                return (
                  <button
                    key={p.key}
                    onMouseEnter={() => setPaletteIdx(i)}
                    onClick={() => goPalette(p)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left ${on ? 'bg-emerald-500/15' : 'hover:bg-white/[0.04]'}`}
                  >
                    <Icon name={p.icon} className={`w-4 h-4 shrink-0 ${on ? 'text-emerald-300' : 'text-slate-500'}`} />
                    <span className={`flex-1 min-w-0 text-sm truncate ${on ? 'text-white' : 'text-slate-200'}`}>{p.label}</span>
                    <span className="text-[11px] text-slate-500 shrink-0">{p.service}</span>
                    <span className="text-[10px] uppercase tracking-wider text-slate-600 shrink-0">{p.group}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-3 px-4 py-2 border-t border-white/10 text-[10px] text-slate-500">
              <span>↑↓ navigate</span><span>↵ open</span><span>esc close</span>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
