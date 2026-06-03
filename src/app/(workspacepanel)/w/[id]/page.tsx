'use client';

import { useEffect, useState, use as reactUse } from 'react';
import Link from 'next/link';
import {
  Users, UserCircle2, BadgeCheck, ArrowRight,
  Sparkles, CheckCircle2, AlertTriangle, Plug,
} from 'lucide-react';
import { PageSpinner } from '@/components/StateViews';
import { Skeleton } from '@/components/workspace/Skeleton';
import MoreTechAIPromo from '@/components/workspace/MoreTechAIPromo';
import { OrganizationService } from '@/services/organization.service';

interface Ctx {
  workspace: { id: number; name: string; created_at: string };
  my_role: string | null;
  is_admin_override: boolean;
  members: Array<{ id: number; user_id: number; email: string; full_name: string; designation: string; role: string; joined_at: string }>;
  stats: {
    member_count: number;
    lead_count: number;
    pipeline: Array<{ status: string; count: number }>;
  };
}

const STATUS_LABELS: Record<string, string> = {
  new: 'New', contacted: 'Contacted', qualified: 'Qualified', won: 'Won', lost: 'Lost',
};

interface SetupItem {
  key: string;
  title: string;
  description: string;
  done: boolean;
  cta_label: string;
  cta_path: string;
  severity: 'info' | 'warn';
}

interface SetupStatus {
  setup_score: number;
  done: number;
  total: number;
  items: SetupItem[];
  channels: { id: number; kind: string; kind_label: string; name: string; connected: boolean }[];
  connected_channel_count: number;
  needs_channel_setup: boolean;
}

export default function WorkspaceOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = reactUse(params);
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [setup, setSetup] = useState<SetupStatus | null>(null);

  useEffect(() => {
    OrganizationService.workspaceContext(Number(id)).then((res) => {
      if (res.success) setCtx(res.data);
    });
    OrganizationService.setupStatus().then((res) => {
      if (res?.success) setSetup(res.data);
    });
  }, [id]);

  if (!ctx) return <PageSpinner />;

  return (
    <div className="space-y-6">
      {ctx.is_admin_override && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-4 text-sm text-amber-200 flex items-start gap-2">
          <BadgeCheck className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            You're viewing this workspace as an <strong>admin</strong>. You're not a formal member, so some workspace-scoped actions may be limited.
          </span>
        </div>
      )}

      {/* Setup checklist — surfaces every "do this before AI can run" item.
          Shows only the items that still need attention; collapses to a
          subtle confetti tile once everything is done. */}
      <SetupBlock setup={setup} workspaceId={id} />

      {/* MoreTech AI promo — only shows when not yet purchased. Pitches
          unlimited tokens and opens a purchase popup right here. */}
      <MoreTechAIPromo variant="banner" />

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Tile label="Members" value={ctx.stats.member_count} href={`/w/${id}/members`} />
        <Tile label="Leads" value={ctx.stats.lead_count} href={`/w/${id}/leads`} />
        <Tile label="Your role" value={ctx.my_role || '—'} />
      </section>

      <section className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">Lead pipeline</h2>
          <Link href={`/w/${id}/leads`} className="text-xs text-emerald-300 hover:text-emerald-200 font-semibold">
            View all →
          </Link>
        </div>
        {ctx.stats.pipeline.length === 0 ? (
          <p className="text-sm text-slate-500">No leads yet.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {ctx.stats.pipeline.map((p) => (
              <div key={p.status} className="rounded-lg bg-white/[0.03] border border-white/5 px-3 py-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">{STATUS_LABELS[p.status] || p.status}</div>
                <div className="mt-1 text-2xl font-bold text-white">{p.count}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">Recent members</h2>
          <Link href={`/w/${id}/members`} className="text-xs text-emerald-300 hover:text-emerald-200 font-semibold">
            View all →
          </Link>
        </div>
        {ctx.members.length === 0 ? (
          <p className="text-sm text-slate-500">No members yet.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {ctx.members.slice(0, 5).map((m) => (
              <li key={m.id} className="py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-xs font-semibold text-emerald-300 border border-white/10">
                  {(m.full_name || m.email).split(/[\s@]/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white truncate">{m.full_name}</div>
                  <div className="text-[11px] text-slate-500 truncate">{m.designation || m.email}</div>
                </div>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/5">
                  {m.role}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Tile({ label, value, href }: { label: string; value: string | number; href?: string }) {
  const body = (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 hover:bg-white/[0.04] transition-colors">
      <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-bold text-white">{value}</div>
      {href && (
        <div className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-300">
          Open <ArrowRight className="w-3 h-3" />
        </div>
      )}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

// -------------------------------------------------------------------------
// Setup checklist — shown on the workspace overview.
//
// Only renders items that still need attention. When the score hits 100,
// collapses to a single congratulatory tile. The CTA on each card
// deep-links to the page that finishes the step.
// -------------------------------------------------------------------------

function SetupBlock({ setup, workspaceId }: { setup: SetupStatus | null; workspaceId: string }) {
  if (!setup) {
    return (
      <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
        <Skeleton height={14} width={180} className="mb-2" />
        <Skeleton height={10} width="60%" />
      </div>
    );
  }

  const pending = setup.items.filter((i) => !i.done);

  if (pending.length === 0) {
    return (
      <div className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 via-cyan-500/5 to-transparent p-5 flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300 shrink-0">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-white">All set — your CRM is fully wired up</h3>
          <p className="text-[12px] text-slate-300 mt-0.5">
            Channels connected, pipelines configured, workflows running. AI agents are live 24/7.
          </p>
        </div>
        <div className="text-2xl font-bold text-emerald-300 tabular-nums">100%</div>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/[0.06] via-amber-500/[0.02] to-transparent p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-300 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Finish setting up your CRM</h2>
            <p className="text-[12px] text-slate-300 mt-0.5">
              {pending.length} of {setup.total} step{setup.total === 1 ? '' : 's'} remaining.
              {setup.needs_channel_setup && (
                <> AI agents <strong className="text-amber-200">won't start firing</strong> until at least one channel is connected.</>
              )}
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-2xl font-bold text-white tabular-nums">{setup.setup_score}%</div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Setup complete</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden mb-4">
        <div className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all"
             style={{ width: `${setup.setup_score}%` }} />
      </div>

      {/* Action items */}
      <ul className="space-y-2">
        {pending.map((item) => {
          const isWarn = item.severity === 'warn';
          return (
            <li key={item.key}>
              <Link
                href={`/w/${workspaceId}${item.cta_path}`}
                className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                  isWarn
                    ? 'border-amber-500/30 bg-amber-500/[0.04] hover:bg-amber-500/[0.08]'
                    : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.04]'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    isWarn ? 'bg-amber-500/15 text-amber-300' : 'bg-white/[0.04] text-slate-400'
                  }`}
                >
                  {isWarn ? <AlertTriangle className="w-4 h-4" /> : <Plug className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                  <p className="text-[12px] text-slate-400 mt-0.5 line-clamp-2">{item.description}</p>
                </div>
                <div className={`text-[11px] font-semibold inline-flex items-center gap-1 shrink-0 ${
                  isWarn ? 'text-amber-300' : 'text-emerald-300'
                }`}>
                  {item.cta_label} <ArrowRight className="w-3 h-3" />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Per-channel breakdown — only if at least one channel needs setup */}
      {setup.channels.some((c) => !c.connected) && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2 font-semibold">
            Channels needing connection
          </div>
          <div className="flex flex-wrap gap-1.5">
            {setup.channels.filter((c) => !c.connected).map((c) => (
              <Link
                key={c.id}
                href={`/w/${workspaceId}/leads/credentials`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-[11px] text-slate-200"
              >
                <Plug className="w-3 h-3 text-amber-300" />
                {c.kind_label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
