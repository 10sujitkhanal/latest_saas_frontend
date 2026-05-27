'use client';

import { useEffect, useState, use as reactUse } from 'react';
import { PageSpinner, EmptyState } from '@/components/StateViews';
import { OrganizationService } from '@/services/organization.service';

interface Member {
  id: number;
  user_id: number;
  email: string;
  full_name: string;
  designation: string;
  role: string;
  joined_at: string;
}

const roleBadge: Record<string, string> = {
  owner: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  admin: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
  manager: 'bg-violet-500/10 text-violet-300 border-violet-500/20',
  sales: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  viewer: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
  member: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
};

export default function WorkspaceMembersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = reactUse(params);
  const [members, setMembers] = useState<Member[] | null>(null);

  useEffect(() => {
    OrganizationService.workspaceContext(Number(id)).then((res) => {
      if (res.success) setMembers(res.data.members ?? []);
    });
  }, [id]);

  if (!members) return <PageSpinner />;

  if (members.length === 0) {
    return <EmptyState title="No members yet" description="The org admin can add staff to this workspace." />;
  }

  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-white/[0.02] border-b border-white/5">
          <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
            <th className="px-5 py-3 font-medium">Member</th>
            <th className="px-5 py-3 font-medium">Role</th>
            <th className="px-5 py-3 font-medium hidden md:table-cell">Joined</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {members.map((m) => {
            const initials = (m.full_name || m.email).split(/[\s@]/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
            return (
              <tr key={m.id} className="hover:bg-white/[0.02]">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-xs font-semibold text-emerald-300 border border-white/10">
                      {initials || '?'}
                    </div>
                    <div className="min-w-0">
                      <div className="text-white font-medium truncate">{m.full_name}</div>
                      <div className="text-[11px] text-slate-500 truncate">{m.email}</div>
                      {m.designation && <div className="text-[11px] text-slate-500 truncate">{m.designation}</div>}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <span className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full border ${roleBadge[m.role] ?? roleBadge.viewer}`}>
                    {m.role}
                  </span>
                </td>
                <td className="px-5 py-3 hidden md:table-cell text-xs text-slate-400">
                  {new Date(m.joined_at).toLocaleDateString()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
