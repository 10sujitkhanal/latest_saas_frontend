'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronsUpDown, Folder, Plus } from 'lucide-react';
import Link from 'next/link';
import { OrganizationService } from '@/services/organization.service';

/**
 * Top-bar workspace switcher — lets a user flip between the businesses they
 * work in without bouncing back to the /w list. Each workspace can be a
 * different industry and grant a different role, so switching changes both the
 * industry-shaped menu and the user's effective permissions.
 */
type SwitcherWorkspace = {
  id: number;
  name: string;
  role: string | null;
  effective_industry: string | null;
};

export default function WorkspaceSwitcher({
  currentId,
  currentName,
}: {
  currentId: number | string;
  currentName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SwitcherWorkspace[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || items !== null) return;
    OrganizationService.myWorkspaces()
      .then((res) => { if (res?.success) setItems(res.data.workspaces ?? []); })
      .catch(() => setItems([]));
  }, [open, items]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const go = (id: number) => {
    setOpen(false);
    if (String(id) !== String(currentId)) router.push(`/w/${id}`);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 max-w-[220px] px-2.5 py-1.5 rounded-lg hover:bg-white/5 text-left"
        title="Switch workspace"
      >
        <span className="w-6 h-6 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-300 shrink-0">
          <Folder className="w-3.5 h-3.5" />
        </span>
        <span className="text-sm font-semibold text-white truncate">{currentName}</span>
        <ChevronsUpDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 w-72 rounded-xl border border-white/10 bg-slate-900 shadow-2xl py-1.5 z-30">
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
            Your workspaces
          </div>
          {items === null && (
            <div className="px-3 py-2 text-xs text-slate-500">Loading…</div>
          )}
          {items?.length === 0 && (
            <div className="px-3 py-2 text-xs text-slate-500">No workspaces.</div>
          )}
          <div className="max-h-72 overflow-y-auto">
            {items?.map((w) => {
              const active = String(w.id) === String(currentId);
              return (
                <button
                  key={w.id}
                  onClick={() => go(w.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-white/5 ${active ? 'bg-white/[0.03]' : ''}`}
                >
                  <span className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-emerald-300 shrink-0">
                    <Folder className="w-3.5 h-3.5" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-white truncate">{w.name}</span>
                    <span className="block text-[11px] text-slate-500 truncate">
                      {w.effective_industry || '—'}{w.role ? ` · ${w.role}` : ''}
                    </span>
                  </span>
                  {active && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                </button>
              );
            })}
          </div>
          <div className="border-t border-white/5 mt-1 pt-1">
            <Link
              href="/w"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-xs text-slate-400 hover:text-emerald-300 hover:bg-white/5"
            >
              <Plus className="w-3.5 h-3.5" /> All workspaces
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
