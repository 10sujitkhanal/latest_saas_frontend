'use client';

import { useCallback, useEffect, useState, use as reactUse } from 'react';
import { FileText, AlertTriangle, Info, CircleAlert } from 'lucide-react';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { OrganizationService } from '@/services/organization.service';

interface AuditRow {
  id: number;
  event: string;
  level: 'info' | 'warn' | 'error';
  summary: string;
  payload: Record<string, unknown>;
  actor: number | null;
  actor_email: string | null;
  actor_kind: string;
  lead: number | null;
  contact: number | null;
  created_at: string;
}

const LEVEL_META: Record<string, { Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string; bg: string }> = {
  info:  { Icon: Info,         color: '#94a3b8', bg: 'bg-slate-500/10' },
  warn:  { Icon: AlertTriangle,color: '#fbbf24', bg: 'bg-amber-500/10' },
  error: { Icon: CircleAlert,  color: '#ef4444', bg: 'bg-red-500/10' },
};

export default function AuditLogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard required="crm.leads_view" workspaceId={wsId} skeleton="list">
      <AuditLogInner />
    </PermissionGuard>
  );
}

function AuditLogInner() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await OrganizationService.auditLog(event || undefined);
      if (res?.success) setRows(res.data);
    } finally { setLoading(false); }
  }, [event]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white inline-flex items-center gap-2">
          <FileText className="w-6 h-6 text-emerald-300" /> Audit log
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Every automation, AI action, and staff change is logged here. Append-only.
        </p>
      </div>

      <div className="mb-4">
        <input
          placeholder="Filter by event (e.g. lead.created, message.sent)"
          value={event}
          onChange={(e) => setEvent(e.target.value)}
          className="w-full max-w-md px-3 py-2 rounded-lg bg-[#080e1c] border border-white/10 text-sm text-white"
        />
      </div>

      {loading ? <PageSkeleton kind="list" /> : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">
          No audit entries match.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => {
            const meta = LEVEL_META[r.level] ?? LEVEL_META.info;
            const Icon = meta.Icon;
            return (
              <li key={r.id} className={`flex items-start gap-3 px-3 py-2.5 rounded-lg ${meta.bg} border border-white/5`}>
                <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: meta.color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] uppercase tracking-wider text-slate-500 font-mono">{r.event}</span>
                    <span className="text-[10px] text-slate-600">·</span>
                    <span className="text-[10px] text-slate-500 capitalize">{r.actor_kind}</span>
                    {r.actor_email && <span className="text-[10px] text-slate-500">· {r.actor_email}</span>}
                  </div>
                  <p className="text-sm text-slate-200 mt-0.5">{r.summary}</p>
                </div>
                <span className="text-[10px] text-slate-500 shrink-0">{new Date(r.created_at).toLocaleString()}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
