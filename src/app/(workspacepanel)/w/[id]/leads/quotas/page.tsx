'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Gauge, Users, User, Wand2, Layers, Plug, Columns3, Clock, MessageSquare,
  ArrowUpRight, Sparkles, ShieldCheck, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { OrganizationService } from '@/services/organization.service';

/**
 * Plan limits — a single dashboard showing every Growth Engine quota,
 * usage vs cap, retention windows, and a one-click upgrade CTA.
 *
 * Quotas come from /leads/quotas/ which reads the org's subscription
 * (OrganizationSubscription.effective_*). When a row turns red, that
 * resource is gated — creating more will return HTTP 402.
 */

interface QuotaSlot {
  label: string;
  used: number;
  cap: number;
  unlimited: boolean;
  remaining: number | null;
  percent: number;
  over: boolean;
}

interface QuotaPayload {
  _meta?: { plan_name: string; status: string; audit_log_retention_days: number };
  [key: string]: QuotaSlot | { plan_name: string; status: string; audit_log_retention_days: number } | undefined;
}

interface CapRow {
  key: string;
  label: string;
  description: string;
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
}

const ROWS: CapRow[] = [
  { key: 'leads',                    label: 'Leads',            description: 'Total leads ever created (across all pipelines).', Icon: Users,          color: '#10b981' },
  { key: 'contacts',                 label: 'Contacts',         description: 'Deduplicated person profiles.',                    Icon: User,           color: '#06b6d4' },
  { key: 'workflows',                label: 'Workflows',        description: 'Active prompt-built automation rules.',            Icon: Wand2,          color: '#a855f7' },
  { key: 'lead_sources',             label: 'Sources',          description: 'Channels you can attribute leads to.',             Icon: Layers,         color: '#f59e0b' },
  { key: 'channels',                 label: 'Channels',         description: 'Connected inbound endpoints (FB, IG, WA, …).',     Icon: Plug,           color: '#3b82f6' },
  { key: 'pipelines',                label: 'Pipelines',        description: 'Industry pipelines (Sales / Hotel / Salon / …).',  Icon: Columns3,       color: '#ec4899' },
  { key: 'followups_pending',        label: 'Pending follow-ups', description: 'Scheduled but not yet fired.',                   Icon: Clock,          color: '#f59e0b' },
  { key: 'conversations_this_month', label: 'Conversations / month', description: 'Inbound conversation rows this calendar month.', Icon: MessageSquare, color: '#06b6d4' },
];

export default function QuotasPage({ params }: { params: Promise<{ id: string }> }) {
  const [wsId, setWsId] = useState('');
  useEffect(() => { params.then((p) => setWsId(p.id)); }, [params]);
  if (!wsId) return null;
  return (
    <PermissionGuard required="crm.leads_view" workspaceId={wsId} skeleton="list">
      <QuotasInner wsId={wsId} />
    </PermissionGuard>
  );
}

function QuotasInner({ wsId }: { wsId: string }) {
  const [data, setData] = useState<QuotaPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await OrganizationService.quotaStatus();
      if (res?.success) setData(res.data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading || !data) return <PageSkeleton kind="list" />;

  const meta = data._meta as { plan_name: string; status: string; audit_log_retention_days: number } | undefined;
  const allOver = ROWS.every((r) => {
    const s = data[r.key] as QuotaSlot | undefined;
    return s && (s.unlimited || !s.over);
  });

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white inline-flex items-center gap-2">
            <Gauge className="w-6 h-6 text-emerald-300" /> Plan limits
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Every Growth Engine cap, what's used, what's left. Quotas come from your subscription plan.
          </p>
        </div>
        <Link
          href="/subscription"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold"
        >
          <ArrowUpRight className="w-4 h-4" /> Upgrade plan
        </Link>
      </div>

      {/* Plan summary */}
      {meta && (
        <div className="mb-6 rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-cyan-500/5 to-transparent p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="text-sm text-slate-300">Current plan</div>
              <div className="text-xl font-bold text-white">{meta.plan_name}</div>
            </div>
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-wider text-slate-400">Status</div>
              <div className={`text-sm font-semibold ${meta.status === 'active' ? 'text-emerald-300' : 'text-amber-300'}`}>
                {meta.status}
              </div>
            </div>
            <div className="text-right border-l border-white/10 pl-4">
              <div className="text-[11px] uppercase tracking-wider text-slate-400">Audit retention</div>
              <div className="text-sm font-semibold text-white">
                {meta.audit_log_retention_days === 0 ? 'Forever' : `${meta.audit_log_retention_days} days`}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quota rows */}
      <div className="space-y-3">
        {ROWS.map((row) => {
          const slot = data[row.key] as QuotaSlot | undefined;
          if (!slot) return null;
          return (
            <article key={row.key} className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
              <div className="flex items-start gap-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${row.color}26`, color: row.color }}
                >
                  <row.Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-white">{row.label}</h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">{row.description}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {slot.unlimited ? (
                        <span className="text-xs font-semibold text-emerald-300 inline-flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5" /> Unlimited
                        </span>
                      ) : (
                        <span className={`text-base font-bold tabular-nums ${slot.over ? 'text-red-300' : 'text-white'}`}>
                          {slot.used} <span className="text-slate-500 font-medium">/ {slot.cap}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {!slot.unlimited && (
                    <div className="mt-3">
                      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className="h-full transition-all"
                          style={{
                            width: `${Math.min(100, slot.percent)}%`,
                            backgroundColor: slot.over ? '#ef4444' : slot.percent >= 80 ? '#f59e0b' : row.color,
                          }}
                        />
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-[11px]">
                        <span className={`inline-flex items-center gap-1 ${slot.over ? 'text-red-300' : 'text-slate-500'}`}>
                          {slot.over
                            ? <><AlertTriangle className="w-3 h-3" /> Quota reached — upgrade to add more</>
                            : <><CheckCircle2 className="w-3 h-3 text-emerald-400" /> {slot.remaining} {row.label.toLowerCase()} remaining</>}
                        </span>
                        <span className="text-slate-500">{slot.percent}% used</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {!allOver && (
        <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/5 p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-300 shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-white">Some quotas are full</h3>
            <p className="text-[12px] text-slate-400 mt-0.5">
              The system will return a 402 error when you try to create more.
              Upgrade your plan or contact your admin to raise limits.
            </p>
          </div>
          <Link
            href="/subscription"
            className="px-3 py-1.5 rounded-md bg-red-500 hover:bg-red-400 text-white text-xs font-semibold"
          >
            Upgrade
          </Link>
        </div>
      )}
    </div>
  );
}
