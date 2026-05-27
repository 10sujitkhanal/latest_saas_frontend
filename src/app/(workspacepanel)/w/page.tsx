'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Folder, Users, ArrowRight, AlertTriangle, ShieldCheck } from 'lucide-react';
import { PageSpinner, PageError, EmptyState } from '@/components/StateViews';
import { OrganizationService } from '@/services/organization.service';

interface MyWorkspace {
  id: number;
  name: string;
  created_at: string;
  role: string | null;
  member_count: number;
  lead_count: number;
}

const roleBadge: Record<string, string> = {
  owner: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  admin: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
  manager: 'bg-violet-500/10 text-violet-300 border-violet-500/20',
  sales: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  viewer: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
  member: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
};

export default function WorkspacePickerPage() {
  const [workspaces, setWorkspaces] = useState<MyWorkspace[] | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      const res = await OrganizationService.myWorkspaces();
      if (!res.success) throw new Error(res.message || 'Failed to load workspaces.');
      setWorkspaces(res.data.workspaces ?? []);
      setIsAdmin(!!res.data.is_admin);
    } catch (err) {
      const v = err as { response?: { data?: { message?: string } }; message?: string };
      setError(v.response?.data?.message ?? v.message ?? 'Failed to load workspaces.');
    }
  };

  useEffect(() => { load(); }, []);

  const assigned = workspaces?.filter((w) => w.role != null) ?? [];
  const unassigned = workspaces?.filter((w) => w.role == null) ?? [];

  return (
    <main className="max-w-5xl mx-auto px-6 lg:px-10 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Your workspaces</h1>
        <p className="text-sm text-slate-400 mt-1">
          Pick a workspace to work in. You only see workspaces you've been assigned to.
        </p>
      </div>

      {workspaces === null && !error && <PageSpinner />}
      {error && <PageError message={error} onRetry={load} />}

      {workspaces && workspaces.length === 0 && (
        <EmptyState
          title="You're not in any workspace yet"
          description="Ask an admin to assign you to a workspace from the Staff or Workspaces pages."
        />
      )}

      {assigned.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-[0.18em] text-emerald-300 font-bold mb-3 flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5" /> Assigned to you ({assigned.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assigned.map((w) => <Card key={w.id} ws={w} />)}
          </div>
        </section>
      )}

      {isAdmin && unassigned.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xs uppercase tracking-[0.18em] text-slate-500 font-bold mb-3 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5" /> Other workspaces ({unassigned.length}) — admin override
          </h2>
          <p className="text-[11px] text-slate-500 mb-3">
            You can see these because you're an admin, but you're not formally a member.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {unassigned.map((w) => <Card key={w.id} ws={w} />)}
          </div>
        </section>
      )}
    </main>
  );
}

function Card({ ws }: { ws: MyWorkspace }) {
  const badge = ws.role ? roleBadge[ws.role] ?? roleBadge.viewer : null;
  return (
    <Link
      href={`/w/${ws.id}`}
      className="group rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-300">
          <Folder className="w-5 h-5" />
        </div>
        {badge && (
          <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full border ${badge}`}>
            {ws.role}
          </span>
        )}
      </div>
      <h3 className="mt-4 text-lg font-semibold text-white truncate">{ws.name}</h3>
      <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" /> {ws.member_count}</span>
        <span className="text-slate-600">·</span>
        <span>{ws.lead_count} lead{ws.lead_count === 1 ? '' : 's'}</span>
      </div>
      <div className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-emerald-300 opacity-0 group-hover:opacity-100 transition-opacity">
        Open workspace
        <ArrowRight className="w-3.5 h-3.5" />
      </div>
    </Link>
  );
}
