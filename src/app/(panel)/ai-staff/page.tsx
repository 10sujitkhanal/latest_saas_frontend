'use client';

/**
 * Org-level AI Staff command center.
 *
 * The agents themselves act on a single workspace's data (leads, store,
 * deals), so they live at `/w/[id]/ai-staff`. This page is the OWNER's
 * roll-up: it lists every workspace, shows how many agent proposals are
 * awaiting approval in each, and deep-links into that workspace's agents.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bot, ArrowRight, Clock, Loader2, Sparkles } from 'lucide-react';
import { OrganizationService, type Workspace } from '@/services/organization.service';
import { AgentsService } from '@/services/agents.service';

export default function OrgAiStaffPage() {
  const [items, setItems] = useState<Workspace[] | null>(null);
  const [pending, setPending] = useState<Record<number, number>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    OrganizationService.listWorkspaces()
      .then(async (res) => {
        if (cancelled) return;
        if (!res?.success) { setError(res?.message || 'Could not load workspaces.'); setItems([]); return; }
        const ws: Workspace[] = (res.data || []).filter((w: Workspace) => !w.archived_at);
        // Show the org roll-up (don't force a redirect into a single workspace —
        // the owner stays at org level and chooses where to work).
        setItems(ws);
        // Fetch each workspace's awaiting-approval count in parallel (best-effort).
        const counts = await Promise.all(ws.map(async (w) => {
          try {
            const t = await AgentsService.listTasks(w.id);
            const n = t?.success ? (t.data || []).filter((x) => x.status === 'proposed').length : 0;
            return [w.id, n] as const;
          } catch { return [w.id, 0] as const; }
        }));
        if (!cancelled) setPending(Object.fromEntries(counts));
      })
      .catch(() => { if (!cancelled) { setError('Could not load workspaces.'); setItems([]); } });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-2">
        <span className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <Bot className="w-6 h-6 text-emerald-400" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-white">AI Staff</h1>
          <p className="text-sm text-slate-400">Your AI team across every workspace. Pick a business to put them to work.</p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] px-4 py-3 flex items-start gap-2.5 text-sm text-slate-300">
        <Sparkles className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
        <p>Agents work <strong className="text-white">inside</strong> a workspace — Offers, Store builder, and the CRM co-pilot all act on that workspace&apos;s own data. They <strong className="text-white">draft</strong>; you approve. Open a workspace below to start.</p>
      </div>

      {items === null ? (
        <div className="py-16 flex items-center justify-center text-slate-500"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading workspaces…</div>
      ) : error ? (
        <div className="py-12 text-center text-rose-400 text-sm">{error}</div>
      ) : items.length === 0 ? (
        <div className="py-12 text-center text-slate-500 text-sm">
          No workspaces yet. <Link href="/workspaces" className="text-emerald-400 hover:underline">Create one</Link> to start using AI Staff.
        </div>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {items.map((w) => {
            const waiting = pending[w.id] ?? 0;
            return (
              <Link
                key={w.id}
                href={`/w/${w.id}/ai-staff`}
                className="group rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] hover:border-emerald-500/30 p-4 transition-colors flex items-center gap-4"
              >
                <span className="w-11 h-11 rounded-xl bg-slate-800 border border-white/5 flex items-center justify-center text-lg font-bold text-emerald-300 shrink-0">
                  {(w.name || 'W')[0].toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-white truncate">{w.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {w.effective_industry || w.industry || 'Business'} · {w.member_count} member{w.member_count === 1 ? '' : 's'}
                  </div>
                  {waiting > 0 && (
                    <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-300 px-2 py-0.5 text-[11px] font-semibold">
                      <Clock className="w-3 h-3" /> {waiting} awaiting you
                    </span>
                  )}
                </div>
                <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all shrink-0" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
