'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, use as reactUse } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search, Columns, Eye, Pencil, Trash2, MoreHorizontal, Mail, Phone,
  Building2, Tag, TrendingUp, User as UserIcon, X, Save, Calendar,
  Activity, ChevronDown, ChevronLeft, ChevronRight, AlertTriangle,
  CheckCircle2, Users, Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import QuotaBadge from '@/components/QuotaBadge';
import { useIsAdmin } from '@/hooks/usePermission';
import { OrganizationService } from '@/services/organization.service';
import { LeadHoverCard } from '@/components/leads/LeadHoverCard';

/** Workspace leads — paginated, inline assignment, view/edit/delete drawer. */

interface WorkspaceLead {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  company?: string;
  company_name?: string | null;
  status: string;
  score?: number;
  source?: number | null;
  source_name?: string | null;
  source_color?: string | null;
  stage?: number | null;
  stage_name?: string | null;
  stage_color?: string | null;
  stage_slug?: string | null;
  pipeline?: number | null;
  pipeline_name?: string | null;
  pipeline_color?: string | null;
  pipeline_industry?: string | null;
  assigned_to?: number | null;
  assigned_to_email: string | null;
  assigned_to_name?: string | null;
  // Activity timeline (resolved by the backend per row). Each field is
  // ``null`` when the lead has no matching history / scheduled work.
  last_followup?: {
    id: number; title: string; kind: string; status: string | null;
    due_at: string | null; completed_at: string | null;
  } | null;
  next_followup?: {
    id: number; title: string; kind: string; status: string | null;
    due_at: string | null; completed_at: string | null;
  } | null;
  next_appointment?: {
    id: number; title: string; starts_at: string | null;
    duration_minutes: number; status: string; location: string;
  } | null;
  created_at: string;
}

interface MemberLite {
  user_id: number;
  email: string;
  full_name: string;
}

interface SourceLite {
  id: number;
  name: string;
  slug: string;
  color?: string | null;
}

const STATUS_BADGE: Record<string, string> = {
  new: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  contacted: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  qualified: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  won: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  lost: 'bg-red-500/15 text-red-300 border-red-500/30',
};

const STATUS_OPTIONS = [
  { value: 'new',       label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'won',       label: 'Won' },
  { value: 'lost',      label: 'Lost' },
];

const PAGE_SIZE = 20;

export default function WorkspaceLeadsListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = reactUse(params);
  return (
    <PermissionGuard required="crm.leads_view" workspaceId={id} skeleton="list">
      <WorkspaceLeadsListInner id={id} />
    </PermissionGuard>
  );
}

function WorkspaceLeadsListInner({ id }: { id: string }) {
  const wsId = Number(id);
  const router = useRouter();
  // Whether the viewer is an admin / owner — drives the banner CTA
  // (upgrade button vs "contact your admin" text).
  const isAdmin = useIsAdmin();
  const [leads, setLeads] = useState<WorkspaceLead[]>([]);
  const [total, setTotal] = useState(0);
  // Hover preview (same as the pipeline) — quick read + quick-compose on hover.
  const [hover, setHover] = useState<{ lead: WorkspaceLead; top: number; left: number } | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openHover = (lead: WorkspaceLead, el: HTMLElement) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    const r = el.getBoundingClientRect();
    setHover({ lead, top: Math.max(8, Math.min(r.top, window.innerHeight - 240)), left: Math.min(r.left + 60, window.innerWidth - 300) });
  };
  const closeHover = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setHover(null), 140);
  };
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  // Plan-cap meta returned by the backend — drives the "X latest
  // leads hidden — upgrade" banner. ``cap_unlimited`` short-circuits
  // the banner for unlimited plans.
  const [capMeta, setCapMeta] = useState<{
    org_total: number; org_visible: number; org_hidden: number;
    cap: number; cap_unlimited: boolean;
  } | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [assignedFilter, setAssignedFilter] = useState<'' | 'unassigned' | number>('');
  const [sourceFilter, setSourceFilter] = useState<'' | 'none' | number>('');
  const [members, setMembers] = useState<MemberLite[]>([]);
  const [sources, setSources] = useState<SourceLite[]>([]);
  const [drawer, setDrawer] = useState<{ mode: 'view' | 'edit'; lead: WorkspaceLead } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [openAssignId, setOpenAssignId] = useState<number | null>(null);

  // ``fetchLeads`` is silent (no skeleton flip); ``load`` adds the
  // skeleton + toast-on-error for first-mount / filter-change. Polling
  // uses the silent variant so the table doesn't flash blank every 15s.
  const fetchLeads = useCallback(async () => {
    const res = await OrganizationService.workspaceLeadsList(wsId, {
      search: search || undefined,
      status: statusFilter || undefined,
      assigned_to: assignedFilter || undefined,
      source: sourceFilter || undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    });
    if (res?.success) {
      setLeads(res.data);
      setTotal(res.meta?.total ?? res.data.length);
      if (res.meta) {
        setCapMeta({
          org_total: res.meta.org_total ?? 0,
          org_visible: res.meta.org_visible ?? 0,
          org_hidden: res.meta.org_hidden ?? 0,
          cap: res.meta.cap ?? 0,
          cap_unlimited: !!res.meta.cap_unlimited,
        });
      }
    }
  }, [wsId, search, statusFilter, assignedFilter, sourceFilter, page]);

  const load = useCallback(async () => {
    setLoading(true);
    try { await fetchLeads(); }
    catch { toast.error('Failed to load leads'); }
    finally { setLoading(false); }
  }, [fetchLeads]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  // Silent background poll every 20s so newly captured leads (via
  // webhook / IMAP / public form) appear without a manual refresh.
  useEffect(() => {
    const t = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      fetchLeads();
    }, 20_000);
    return () => clearInterval(t);
  }, [fetchLeads]);

  // Pull workspace members once for the assign dropdown.
  useEffect(() => {
    OrganizationService.listWorkspaceMembers(wsId).then((res) => {
      if (res?.success) setMembers(res.data as MemberLite[]);
    }).catch(() => {});
    OrganizationService.listLeadSources().then((res) => {
      if (res?.success) setSources(res.data as SourceLite[]);
    }).catch(() => {});
  }, [wsId]);

  // Reset to page 0 when filters change.
  useEffect(() => { setPage(0); }, [search, statusFilter, assignedFilter, sourceFilter]);

  const remove = async (lead: WorkspaceLead) => {
    if (!confirm(`Delete ${lead.full_name}? This cannot be undone.`)) return;
    const res = await OrganizationService.deleteLead(lead.id);
    if (res?.success) {
      toast.success(`${lead.full_name} deleted`);
      setLeads((curr) => curr.filter((l) => l.id !== lead.id));
      setTotal((t) => Math.max(0, t - 1));
      if (drawer?.lead.id === lead.id) setDrawer(null);
    } else {
      toast.error(res?.message || 'Failed to delete');
    }
  };

  const assign = async (lead: WorkspaceLead, userId: number | null) => {
    const prev = lead.assigned_to;
    // Optimistic update.
    setLeads((curr) => curr.map((l) =>
      l.id === lead.id
        ? {
            ...l,
            assigned_to: userId,
            assigned_to_email: userId ? members.find((m) => m.user_id === userId)?.email ?? l.assigned_to_email : null,
            assigned_to_name: userId ? members.find((m) => m.user_id === userId)?.full_name ?? null : null,
          }
        : l));
    setOpenAssignId(null);
    try {
      const res = await OrganizationService.updateLead(lead.id, { assigned_to: userId });
      if (!res?.success) {
        toast.error(res?.message || 'Could not reassign');
        // Rollback.
        setLeads((curr) => curr.map((l) => l.id === lead.id ? { ...l, assigned_to: prev ?? null } : l));
      } else {
        const member = userId ? members.find((m) => m.user_id === userId) : null;
        toast.success(member ? `Assigned to ${member.full_name}` : 'Unassigned');
      }
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Could not reassign');
      setLeads((curr) => curr.map((l) => l.id === lead.id ? { ...l, assigned_to: prev ?? null } : l));
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-white inline-flex items-center gap-3 flex-wrap">
            All leads
            <QuotaBadge quota="leads" label="leads" />
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {total} {total === 1 ? 'lead' : 'leads'} in this workspace.
            View, edit, assign, or remove any of them inline.
          </p>
        </div>
        <Link
          href={`/w/${id}/leads`}
          className="px-4 py-2 rounded-full border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-sm font-semibold text-slate-200 inline-flex items-center gap-2"
        >
          <Columns className="w-4 h-4" />
          Pipeline view
        </Link>
      </div>

      {/* Plan-cap banner — shown when the org has more leads than its
          plan allows. The OLDEST ``cap`` leads remain accessible; newer
          leads are hidden until the user upgrades. Banner is hidden on
          unlimited plans and when nothing is over the cap. */}
      {capMeta && !capMeta.cap_unlimited && capMeta.org_hidden > 0 && (
        <div className="mb-5 rounded-2xl border border-red-500/30 bg-red-500/[0.06] p-4 flex items-start gap-3 flex-wrap">
          <div className="w-9 h-9 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-[240px]">
            <h3 className="text-sm font-bold text-white">
              {capMeta.org_hidden.toLocaleString()} latest{' '}
              {capMeta.org_hidden === 1 ? 'lead is' : 'leads are'} hidden
            </h3>
            <p className="text-[12.5px] text-slate-400 mt-0.5">
              Your plan allows <strong className="text-white">{capMeta.cap.toLocaleString()}</strong>{' '}
              leads. You currently have{' '}
              <strong className="text-white">{capMeta.org_total.toLocaleString()}</strong>.
              We&apos;re showing the oldest {capMeta.org_visible.toLocaleString()} —
              {isAdmin
                ? <> upgrade to unlock the most recent {capMeta.org_hidden.toLocaleString()}.</>
                : <> ask your admin to upgrade so the most recent {capMeta.org_hidden.toLocaleString()} unlock.</>}
            </p>
          </div>
          {isAdmin ? (
            <Link
              href="/subscription"
              className="px-3.5 py-2 rounded-full bg-red-500 hover:bg-red-400 text-white text-xs font-bold inline-flex items-center gap-1.5 shrink-0"
            >
              Upgrade plan
            </Link>
          ) : (
            <span className="px-3.5 py-2 rounded-full border border-white/15 text-slate-300 text-xs font-semibold inline-flex items-center gap-1.5 shrink-0">
              Contact your admin
            </span>
          )}
        </div>
      )}

      <div className="mb-5 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            placeholder="Search by name, email, phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
          />
        </div>

        <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.02] p-1 gap-1 overflow-x-auto">
          <FilterChip active={!statusFilter} onClick={() => setStatusFilter('')} label="All status" />
          {STATUS_OPTIONS.map((s) => (
            <FilterChip
              key={s.value}
              active={statusFilter === s.value}
              onClick={() => setStatusFilter(s.value)}
              label={s.label}
              accentClass={STATUS_BADGE[s.value]}
            />
          ))}
        </div>

        <AssignedFilter
          value={assignedFilter}
          onChange={setAssignedFilter}
          members={members}
        />

        <SourceFilter
          value={sourceFilter}
          onChange={setSourceFilter}
          sources={sources}
        />
      </div>

      {loading ? (
        <PageSkeleton kind="list" />
      ) : leads.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">
          <UserIcon className="w-10 h-10 mx-auto mb-3 text-slate-600" />
          {total === 0
            ? 'No leads yet. Create your first from the pipeline page.'
            : 'No leads match these filters.'}
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
            <div className="overflow-x-auto">
              {/* ``minWidth`` pushes the table wider than typical
                  laptop viewports so it actually horizontally scrolls.
                  The Lead + Contact columns below use ``position:sticky``
                  with explicit ``left`` offsets so they stay pinned
                  while the rest of the columns scroll under them.
                  A 1px right border + subtle shadow on the last pinned
                  column makes the "frozen" edge visible. */}
              <table className="w-full text-sm" style={{ minWidth: 1400 }}>
                <thead className="bg-[#0c1322] border-b border-white/5">
                  <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                    <th
                      className="text-left px-4 py-3 sticky left-0 z-20 bg-[#0c1322] w-[240px]"
                      style={{ minWidth: 240 }}
                    >
                      Lead
                    </th>
                    <th
                      className="text-left px-4 py-3 sticky z-20 bg-[#0c1322] w-[240px] shadow-[2px_0_0_0_rgba(255,255,255,0.04)]"
                      style={{ left: 240, minWidth: 240 }}
                    >
                      Contact
                    </th>
                    <th className="text-left px-4 py-3 w-[140px]">Pipeline</th>
                    <th className="text-left px-4 py-3 w-[120px]">Stage</th>
                    <th className="text-left px-4 py-3 w-[180px]">Assigned</th>
                    {/* New activity columns: "Last follow-up" (when we
                        last touched this lead), "Next follow-up" (what's
                        scheduled next), "Next appointment" (upcoming
                        meeting). Each cell renders a relative time
                        with the full timestamp on hover. */}
                    <th className="text-left px-4 py-3 w-[140px]">Last follow-up</th>
                    <th className="text-left px-4 py-3 w-[140px]">Next follow-up</th>
                    <th className="text-left px-4 py-3 w-[160px]">Next appointment</th>
                    <th className="text-left px-4 py-3 w-[100px]">Created</th>
                    <th className="px-4 py-3 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((l) => (
                    <LeadRow
                      key={l.id}
                      lead={l}
                      members={members}
                      menuOpen={openMenuId === l.id}
                      assignOpen={openAssignId === l.id}
                      onOpenMenu={() => setOpenMenuId(openMenuId === l.id ? null : l.id)}
                      onCloseMenu={() => setOpenMenuId(null)}
                      onOpenAssign={() => setOpenAssignId(openAssignId === l.id ? null : l.id)}
                      onCloseAssign={() => setOpenAssignId(null)}
                      onAssign={(uid) => assign(l, uid)}
                      onView={() => router.push(`/w/${id}/leads/${l.id}`)}
                      onHover={(el) => openHover(l, el)}
                      onHoverEnd={closeHover}
                      onQuickPreview={() => setDrawer({ mode: 'view', lead: l })}
                      onEdit={() => setDrawer({ mode: 'edit', lead: l })}
                      onDelete={() => remove(l)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination footer */}
          {total > PAGE_SIZE && (
            <div className="mt-4 flex items-center justify-between text-xs">
              <div className="text-slate-500">
                Showing <strong className="text-slate-300">{page * PAGE_SIZE + 1}</strong>–
                <strong className="text-slate-300">{Math.min(total, (page + 1) * PAGE_SIZE)}</strong> of{' '}
                <strong className="text-slate-300">{total}</strong>
              </div>
              <div className="inline-flex items-center gap-1">
                <PageButton onClick={() => setPage(0)} disabled={page === 0}>«</PageButton>
                <PageButton onClick={() => setPage(page - 1)} disabled={page === 0}>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </PageButton>
                <span className="px-3 py-1.5 text-slate-400">
                  Page <strong className="text-white">{page + 1}</strong> of {totalPages}
                </span>
                <PageButton onClick={() => setPage(page + 1)} disabled={page >= totalPages - 1}>
                  <ChevronRight className="w-3.5 h-3.5" />
                </PageButton>
                <PageButton onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}>»</PageButton>
              </div>
            </div>
          )}
        </>
      )}

      {drawer && (
        <LeadDrawer
          mode={drawer.mode}
          lead={drawer.lead}
          members={members}
          onClose={() => setDrawer(null)}
          onSwitchEdit={() => setDrawer({ mode: 'edit', lead: drawer.lead })}
          onSwitchView={() => setDrawer({ mode: 'view', lead: drawer.lead })}
          onDelete={() => remove(drawer.lead)}
          onAssign={(uid) => assign(drawer.lead, uid)}
          onSaved={(updated) => {
            setLeads((curr) => curr.map((l) => l.id === updated.id ? { ...l, ...updated } : l));
            setDrawer({ mode: 'view', lead: { ...drawer.lead, ...updated } });
            toast.success('Lead updated');
          }}
        />
      )}

      {hover && (
        <LeadHoverCard
          wsId={id}
          lead={hover.lead}
          style={{ top: hover.top, left: hover.left }}
          onMouseEnter={() => { if (hoverTimer.current) clearTimeout(hoverTimer.current); }}
          onMouseLeave={closeHover}
        />
      )}
    </div>
  );
}

function PageButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-8 h-8 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.08] text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed inline-flex items-center justify-center"
    >
      {children}
    </button>
  );
}

function FilterChip({
  active, onClick, label, accentClass,
}: {
  active: boolean; onClick: () => void; label: string; accentClass?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold whitespace-nowrap transition-colors ${
        active
          ? accentClass
            ? `${accentClass} border`
            : 'bg-white/[0.08] text-white border border-white/15'
          : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
      }`}
    >
      {label}
    </button>
  );
}

function AssignedFilter({
  value, onChange, members,
}: { value: '' | 'unassigned' | number; onChange: (v: '' | 'unassigned' | number) => void; members: MemberLite[] }) {
  const [open, setOpen] = useState(false);
  const label =
    value === ''           ? 'Anyone'
    : value === 'unassigned' ? 'Unassigned'
    : members.find((m) => m.user_id === value)?.full_name || `User #${value}`;
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] text-xs font-semibold text-slate-200"
      >
        <Users className="w-3.5 h-3.5 text-slate-400" />
        {label}
        <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 w-56 rounded-xl border border-white/10 bg-[#0a1020] shadow-xl py-1 max-h-72 overflow-y-auto">
            <AssignOption active={value === ''} label="Anyone" onClick={() => { onChange(''); setOpen(false); }} />
            <AssignOption active={value === 'unassigned'} label="Unassigned" onClick={() => { onChange('unassigned'); setOpen(false); }} />
            <div className="h-px bg-white/5 my-1" />
            {members.map((m) => (
              <AssignOption
                key={m.user_id}
                active={value === m.user_id}
                label={m.full_name}
                sub={m.email}
                onClick={() => { onChange(m.user_id); setOpen(false); }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SourceFilter({
  value, onChange, sources,
}: { value: '' | 'none' | number; onChange: (v: '' | 'none' | number) => void; sources: SourceLite[] }) {
  const [open, setOpen] = useState(false);
  const label =
    value === ''     ? 'Any source'
    : value === 'none' ? 'No source'
    : sources.find((s) => s.id === value)?.name || `Source #${value}`;
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] text-xs font-semibold text-slate-200"
      >
        <Tag className="w-3.5 h-3.5 text-slate-400" />
        {label}
        <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 w-56 rounded-xl border border-white/10 bg-[#0a1020] shadow-xl py-1 max-h-72 overflow-y-auto">
            <AssignOption active={value === ''} label="Any source" onClick={() => { onChange(''); setOpen(false); }} />
            <AssignOption active={value === 'none'} label="No source" onClick={() => { onChange('none'); setOpen(false); }} />
            {sources.length > 0 && <div className="h-px bg-white/5 my-1" />}
            {sources.map((s) => (
              <button
                key={s.id}
                onClick={() => { onChange(s.id); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 ${
                  value === s.id ? 'bg-emerald-500/10 text-emerald-200' : 'text-slate-200 hover:bg-white/[0.04]'
                }`}
              >
                {s.color && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />}
                {!s.color && <span className="w-2 h-2 rounded-full bg-slate-500 shrink-0" />}
                <span className="font-semibold truncate flex-1">{s.name}</span>
                {value === s.id && <Check className="w-3 h-3 text-emerald-300" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function AssignOption({
  active, label, sub, onClick,
}: { active: boolean; label: string; sub?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 text-xs flex items-start gap-2 ${
        active ? 'bg-emerald-500/10 text-emerald-200' : 'text-slate-200 hover:bg-white/[0.04]'
      }`}
    >
      {active ? <Check className="w-3.5 h-3.5 mt-0.5 text-emerald-300" /> : <span className="w-3.5" />}
      <div className="flex-1 min-w-0">
        <div className="font-semibold truncate">{label}</div>
        {sub && <div className="text-[10px] text-slate-500 truncate">{sub}</div>}
      </div>
    </button>
  );
}

function LeadRow({
  lead, members, menuOpen, assignOpen, onOpenMenu, onCloseMenu, onOpenAssign, onCloseAssign,
  onAssign, onView, onHover, onHoverEnd, onQuickPreview, onEdit, onDelete,
}: {
  lead: WorkspaceLead;
  members: MemberLite[];
  menuOpen: boolean;
  assignOpen: boolean;
  onOpenMenu: () => void;
  onCloseMenu: () => void;
  onOpenAssign: () => void;
  onCloseAssign: () => void;
  onAssign: (uid: number | null) => void;
  onView: () => void;
  onHover?: (el: HTMLElement) => void;
  onHoverEnd?: () => void;
  onQuickPreview: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const initials = (lead.full_name || lead.email || '?')
    .split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('') || '?';
  const avatarHue = (lead.id * 47) % 360;

  // Sticky-cell background classes — match the table's base
  // ``bg-white/[0.02]`` look but use a *solid* color underneath so the
  // non-sticky cells scrolling past don't bleed through. ``group-hover``
  // swaps to the row-hover shade in sync with the rest of the cells.
  const stickyCellBase = 'bg-[#0c1322] group-hover:bg-[#101a30] transition-colors';

  return (
    <tr
      className="group border-t border-white/5 transition-colors cursor-pointer"
      onClick={onView}
      onMouseEnter={(e) => onHover?.(e.currentTarget)}
      onMouseLeave={onHoverEnd}
    >
      <td
        className={`px-4 py-3 sticky left-0 z-10 ${stickyCellBase}`}
        style={{ minWidth: 240 }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
            style={{ background: `linear-gradient(135deg, hsl(${avatarHue} 60% 35%), hsl(${(avatarHue + 40) % 360} 55% 25%))` }}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <div className="text-white font-semibold truncate">{lead.full_name || '—'}</div>
            <div className="flex items-center gap-2 mt-0.5">
              {typeof lead.score === 'number' && (
                <span className="text-[10px] text-slate-500 inline-flex items-center gap-0.5">
                  <TrendingUp className="w-2.5 h-2.5" />
                  {lead.score}
                </span>
              )}
              {lead.source_name && (
                <span
                  className="inline-block px-1.5 py-0 text-[9px] rounded border whitespace-nowrap"
                  style={{
                    color: lead.source_color || '#64748b',
                    borderColor: `${lead.source_color || '#64748b'}55`,
                    backgroundColor: `${lead.source_color || '#64748b'}1a`,
                  }}
                >
                  {lead.source_name}
                </span>
              )}
            </div>
          </div>
        </div>
      </td>
      <td
        className={`px-4 py-3 sticky z-10 ${stickyCellBase} shadow-[2px_0_0_0_rgba(255,255,255,0.04)]`}
        style={{ left: 240, minWidth: 240 }}
      >
        <div className="space-y-0.5 min-w-0">
          {lead.email ? (
            <div className="text-slate-300 text-[12.5px] truncate inline-flex items-center gap-1.5 max-w-[220px]">
              <Mail className="w-3 h-3 text-slate-500 shrink-0" />
              <span className="truncate">{lead.email}</span>
            </div>
          ) : (
            <div className="text-slate-600 text-[12.5px]">No email</div>
          )}
          {lead.phone && (
            <div className="text-slate-400 text-[11.5px] inline-flex items-center gap-1.5">
              <Phone className="w-3 h-3 text-slate-500 shrink-0" />
              {lead.phone}
            </div>
          )}
          {lead.company_name && (
            <div className="text-[10px] text-slate-500 inline-flex items-center gap-1">
              <Building2 className="w-2.5 h-2.5" />
              {lead.company_name}
            </div>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        {lead.pipeline_name ? (
          <div className="min-w-0">
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] rounded-md border whitespace-nowrap font-semibold"
              style={{
                color: lead.pipeline_color || '#94a3b8',
                borderColor: `${lead.pipeline_color || '#94a3b8'}55`,
                backgroundColor: `${lead.pipeline_color || '#94a3b8'}1a`,
              }}
              title={lead.pipeline_industry ? `Industry: ${lead.pipeline_industry}` : undefined}
            >
              <Columns className="w-2.5 h-2.5" />
              {lead.pipeline_name}
            </span>
            {lead.pipeline_industry && lead.pipeline_industry !== 'generic' && (
              <div className="text-[9.5px] uppercase tracking-wider text-slate-500 mt-0.5">
                {lead.pipeline_industry.replace(/_/g, ' ')}
              </div>
            )}
          </div>
        ) : (
          <span className="text-slate-600">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        {lead.stage_name ? (
          <span
            className="inline-block px-2 py-0.5 text-[11px] rounded-md border whitespace-nowrap font-semibold"
            style={{
              color: lead.stage_color || '#94a3b8',
              borderColor: `${lead.stage_color || '#94a3b8'}55`,
              backgroundColor: `${lead.stage_color || '#94a3b8'}1a`,
            }}
            title={`Pipeline stage: ${lead.stage_name}`}
          >
            {lead.stage_name}
          </span>
        ) : (
          <span className="text-slate-600">—</span>
        )}
      </td>
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <InlineAssign
          lead={lead}
          members={members}
          open={assignOpen}
          onOpen={onOpenAssign}
          onClose={onCloseAssign}
          onAssign={onAssign}
        />
      </td>

      {/* Last follow-up — most-recent completed FollowUp row. Renders a
          relative time (e.g. "3d ago") with the full timestamp on
          hover; dash when the lead has never been followed-up. */}
      <td className="px-4 py-3">
        <ActivityCell row={lead.last_followup ?? null} kind="past" />
      </td>

      {/* Next follow-up — soonest pending FollowUp by due_at. Future
          due dates render in slate; past (overdue) due dates render
          in red so the owner sees them at a glance. */}
      <td className="px-4 py-3">
        <ActivityCell row={lead.next_followup ?? null} kind="future" />
      </td>

      {/* Next appointment — earliest upcoming Appointment that isn't
          cancelled. Same relative-time treatment + the appointment
          title underneath when there's space. */}
      <td className="px-4 py-3">
        {lead.next_appointment ? (
          <div className="min-w-0">
            <div className="text-[12px] text-white inline-flex items-center gap-1.5 whitespace-nowrap" title={lead.next_appointment.starts_at ? new Date(lead.next_appointment.starts_at).toLocaleString() : ''}>
              <Calendar className="w-3 h-3 text-purple-300 shrink-0" />
              <span>{formatRel(lead.next_appointment.starts_at, 'future')}</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[140px]" title={lead.next_appointment.title}>
              {lead.next_appointment.title}
            </div>
          </div>
        ) : (
          <span className="text-slate-600">—</span>
        )}
      </td>

      <td className="px-4 py-3">
        <span className="text-slate-500 text-[11px] inline-flex items-center gap-1 whitespace-nowrap">
          <Calendar className="w-2.5 h-2.5" />
          {new Date(lead.created_at).toLocaleDateString()}
        </span>
      </td>
      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
        <RowActions
          menuOpen={menuOpen}
          onOpenMenu={onOpenMenu}
          onCloseMenu={onCloseMenu}
          onView={onView}
          onQuickPreview={onQuickPreview}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </td>
    </tr>
  );
}

// Cell renderer used by the "Last follow-up" and "Next follow-up"
// columns. Renders a relative time + the follow-up title underneath.
// ``kind='past'`` uses the ``completed_at`` timestamp + a neutral
// slate color; ``kind='future'`` uses ``due_at`` and switches to red
// when the date is in the past (overdue).
function ActivityCell({
  row, kind,
}: {
  row: { title: string; due_at: string | null; completed_at: string | null } | null;
  kind: 'past' | 'future';
}) {
  if (!row) return <span className="text-slate-600">—</span>;
  const ts = kind === 'past' ? row.completed_at : row.due_at;
  if (!ts) return <span className="text-slate-600">—</span>;
  const overdue = kind === 'future' && new Date(ts).getTime() < Date.now();
  return (
    <div className="min-w-0">
      <div
        className={`text-[12px] inline-flex items-center gap-1.5 whitespace-nowrap ${
          overdue ? 'text-red-300' : kind === 'past' ? 'text-slate-300' : 'text-emerald-200'
        }`}
        title={new Date(ts).toLocaleString()}
      >
        <Activity className={`w-3 h-3 ${overdue ? 'text-red-400' : kind === 'past' ? 'text-slate-500' : 'text-emerald-400'} shrink-0`} />
        <span>{formatRel(ts, kind)}{overdue && ' · overdue'}</span>
      </div>
      <div className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[120px]" title={row.title}>
        {row.title}
      </div>
    </div>
  );
}

// Relative time formatter — "now", "5m", "3d", "in 2h", "yesterday",
// "5/12/2026". Matches the convention used in the Messenger-style
// inbox so the whole app speaks the same language about time.
function formatRel(iso: string | null, kind: 'past' | 'future'): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  const diffMs = t - Date.now();
  const absMs = Math.abs(diffMs);
  const past = diffMs < 0;
  const mins = Math.floor(absMs / 60_000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);

  if (absMs < 60_000) return kind === 'future' ? 'now' : 'just now';
  const label =
    days >= 30 ? new Date(iso).toLocaleDateString() :
    days >= 1  ? `${days}d` :
    hrs >= 1   ? `${hrs}h` :
                 `${mins}m`;
  if (days >= 30) return label;
  return past ? `${label} ago` : `in ${label}`;
}

function InlineAssign({
  lead, members, open, onOpen, onClose, onAssign,
}: {
  lead: WorkspaceLead;
  members: MemberLite[];
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onAssign: (uid: number | null) => void;
}) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [search, setSearch] = useState('');
  // Popover position is computed off the trigger's getBoundingClientRect
  // and rendered via a portal so the table's overflow-x-auto can't clip it.
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const POPOVER_W = 256;

  useLayoutEffect(() => {
    if (!open) { setPos(null); return; }
    const compute = () => {
      const el = triggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      // Anchor the popover under the trigger, then nudge inward if it
      // would overflow the right edge of the viewport.
      const desiredLeft = r.left;
      const maxLeft = window.innerWidth - POPOVER_W - 8;
      const left = Math.max(8, Math.min(desiredLeft, maxLeft));
      setPos({ top: r.bottom + 4, left, width: POPOVER_W });
    };
    compute();
    // Reposition on scroll / resize — anything that could move the row.
    window.addEventListener('scroll', compute, true);
    window.addEventListener('resize', compute);
    return () => {
      window.removeEventListener('scroll', compute, true);
      window.removeEventListener('resize', compute);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  const filtered = members.filter((m) =>
    !search.trim()
    || m.full_name.toLowerCase().includes(search.toLowerCase())
    || m.email.toLowerCase().includes(search.toLowerCase())
  );
  const assignedLabel = lead.assigned_to_name || lead.assigned_to_email;

  return (
    <>
      <button
        ref={triggerRef}
        onClick={onOpen}
        className={`w-full text-left inline-flex items-center gap-2 px-2 py-1 rounded-lg border transition-colors max-w-[220px] ${
          open
            ? 'border-emerald-500/40 bg-emerald-500/[0.06]'
            : 'border-transparent hover:border-white/10 hover:bg-white/[0.04]'
        }`}
      >
        {assignedLabel ? (
          <>
            <AvatarTiny name={assignedLabel} />
            <span className="text-[11.5px] text-slate-200 truncate flex-1">{assignedLabel}</span>
          </>
        ) : (
          <>
            <div className="w-5 h-5 rounded-full border border-dashed border-white/20 inline-flex items-center justify-center text-slate-500">
              <UserIcon className="w-2.5 h-2.5" />
            </div>
            <span className="text-[11.5px] text-slate-500 flex-1">Unassigned</span>
          </>
        )}
        <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && pos && typeof document !== 'undefined' && createPortal(
        <>
          <div className="fixed inset-0 z-[60]" onClick={onClose} />
          <div
            className="fixed z-[61] rounded-xl border border-white/10 bg-[#0a1020] shadow-2xl overflow-hidden"
            style={{ top: pos.top, left: pos.left, width: pos.width }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-2 border-b border-white/5">
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search staff…"
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#080e1c] border border-white/10 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            <div className="max-h-60 overflow-y-auto py-1">
              <button
                onClick={() => onAssign(null)}
                className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 text-slate-300 hover:bg-white/[0.04]"
              >
                <X className="w-3.5 h-3.5" />
                Unassign
              </button>
              <div className="h-px bg-white/5 my-1" />
              {filtered.length === 0 ? (
                <div className="px-3 py-3 text-[11px] text-slate-500 italic text-center">No members.</div>
              ) : (
                filtered.map((m) => (
                  <button
                    key={m.user_id}
                    onClick={() => onAssign(m.user_id)}
                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 ${
                      lead.assigned_to === m.user_id ? 'bg-emerald-500/10 text-emerald-200' : 'text-slate-200 hover:bg-white/[0.04]'
                    }`}
                  >
                    <AvatarTiny name={m.full_name} />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{m.full_name}</div>
                      <div className="text-[10px] text-slate-500 truncate">{m.email}</div>
                    </div>
                    {lead.assigned_to === m.user_id && <Check className="w-3 h-3 text-emerald-300" />}
                  </button>
                ))
              )}
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}

function AvatarTiny({ name }: { name: string }) {
  const initials = (name || '?').split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('') || '?';
  const hue = Array.from(name).reduce((a, c) => (a + c.charCodeAt(0)) % 360, 0);
  return (
    <span
      className="w-5 h-5 rounded-full inline-flex items-center justify-center text-[9px] font-bold text-white shrink-0"
      style={{ background: `linear-gradient(135deg, hsl(${hue} 60% 35%), hsl(${(hue + 40) % 360} 55% 25%))` }}
    >
      {initials}
    </span>
  );
}

function RowActions({
  menuOpen, onOpenMenu, onCloseMenu, onView, onQuickPreview, onEdit, onDelete,
}: {
  menuOpen: boolean;
  onOpenMenu: () => void;
  onCloseMenu: () => void;
  onView: () => void;
  onQuickPreview: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const ref = useRef<HTMLButtonElement | null>(null);
  return (
    <>
      <button
        ref={ref}
        onClick={onOpenMenu}
        className="p-1.5 rounded text-slate-500 hover:text-white hover:bg-white/[0.06]"
        aria-label="Row actions"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      <FloatingPopover open={menuOpen} anchorRef={ref} onClose={onCloseMenu} width={196} align="right">
        <MenuItem icon={Eye}    label="Open full page"   onClick={() => { onCloseMenu(); onView(); }} />
        <MenuItem icon={Eye}    label="Quick preview"    onClick={() => { onCloseMenu(); onQuickPreview(); }} />
        <MenuItem icon={Pencil} label="Edit lead"        onClick={() => { onCloseMenu(); onEdit(); }} />
        <div className="h-px bg-white/5 my-1" />
        <MenuItem icon={Trash2} label="Delete" tone="red" onClick={() => { onCloseMenu(); onDelete(); }} />
      </FloatingPopover>
    </>
  );
}

function MenuItem({
  icon: Icon, label, onClick, tone = 'default',
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  tone?: 'default' | 'red';
}) {
  const colorCls = tone === 'red'
    ? 'text-red-300 hover:bg-red-500/[0.08]'
    : 'text-slate-200 hover:bg-white/[0.04]';
  return (
    <button onClick={onClick} className={`w-full text-left px-3 py-1.5 text-xs inline-flex items-center gap-2 ${colorCls}`}>
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

/** Floating popover anchored to a trigger element, rendered via portal so
 *  it can't be clipped by any overflow container. Anchor edge (right/left)
 *  is auto-flipped when the popover would overrun the viewport. */
function FloatingPopover({
  open, anchorRef, onClose, width = 176, align = 'right', children,
}: {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  width?: number;
  /** Default alignment of the popover's edge with the anchor's edge. */
  align?: 'left' | 'right';
  children: React.ReactNode;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) { setPos(null); return; }
    const compute = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      // Try the requested alignment first, fall back to the opposite when
      // it would overrun the viewport on that side.
      let left = align === 'right' ? r.right - width : r.left;
      if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8;
      if (left < 8) left = 8;
      setPos({ top: r.bottom + 4, left });
    };
    compute();
    window.addEventListener('scroll', compute, true);
    window.addEventListener('resize', compute);
    return () => {
      window.removeEventListener('scroll', compute, true);
      window.removeEventListener('resize', compute);
    };
  }, [open, anchorRef, width, align]);

  if (!open || !pos || typeof document === 'undefined') return null;
  return createPortal(
    <>
      <div className="fixed inset-0 z-[60]" onClick={onClose} />
      <div
        className="fixed z-[61] rounded-lg border border-white/10 bg-[#0a1020] shadow-2xl py-1"
        style={{ top: pos.top, left: pos.left, width }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}

// ───────────────────────────────────────────────────────────────────────
//  Detail / Edit drawer
// ───────────────────────────────────────────────────────────────────────

function LeadDrawer({
  mode, lead, members, onClose, onSwitchEdit, onSwitchView, onDelete, onAssign, onSaved,
}: {
  mode: 'view' | 'edit';
  lead: WorkspaceLead;
  members: MemberLite[];
  onClose: () => void;
  onSwitchEdit: () => void;
  onSwitchView: () => void;
  onDelete: () => void;
  onAssign: (uid: number | null) => void;
  onSaved: (patch: Partial<WorkspaceLead>) => void;
}) {
  const [form, setForm] = useState({
    first_name: lead.first_name || '',
    last_name: lead.last_name || '',
    email: lead.email || '',
    phone: lead.phone || '',
    status: lead.status || 'new',
  });
  const [saving, setSaving] = useState(false);
  const [details, setDetails] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (mode !== 'view') return;
    OrganizationService.getLead(lead.id).then((res) => {
      if (res?.success) setDetails(res.data);
    }).catch(() => {});
  }, [mode, lead.id]);

  const save = async () => {
    if (!form.first_name.trim() && !form.last_name.trim()) {
      toast.error('First or last name is required.');
      return;
    }
    setSaving(true);
    try {
      const res = await OrganizationService.updateLead(lead.id, form);
      if (res?.success) {
        onSaved({ ...form, full_name: `${form.first_name} ${form.last_name}`.trim() } as Partial<WorkspaceLead>);
      } else {
        toast.error(res?.message || 'Save failed');
      }
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex bg-slate-950/70 backdrop-blur-sm" onClick={onClose}>
      <div className="ml-auto w-full max-w-xl h-full bg-[#0a1020] border-l border-white/10 flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-white/5 flex items-start gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-base font-bold text-white shrink-0"
            style={{ background: `linear-gradient(135deg, hsl(${(lead.id * 47) % 360} 60% 35%), hsl(${((lead.id * 47) + 40) % 360} 55% 25%))` }}
          >
            {(lead.full_name || lead.email || '?').split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('') || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-white truncate">{lead.full_name || 'Untitled lead'}</h2>
            <div className="text-[11px] text-slate-400 truncate">{lead.email || lead.phone || '—'}</div>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              {lead.pipeline_name && (
                <span className="px-1.5 py-0.5 text-[10px] rounded-md border inline-flex items-center gap-1" style={{
                  color: lead.pipeline_color || '#94a3b8',
                  borderColor: `${lead.pipeline_color || '#94a3b8'}55`,
                  backgroundColor: `${lead.pipeline_color || '#94a3b8'}1a`,
                }}>
                  <Columns className="w-2.5 h-2.5" />
                  {lead.pipeline_name}
                </span>
              )}
              {lead.stage_name && (
                <span className="px-1.5 py-0.5 text-[10px] rounded-md border" style={{
                  color: lead.stage_color || '#94a3b8',
                  borderColor: `${lead.stage_color || '#94a3b8'}55`,
                  backgroundColor: `${lead.stage_color || '#94a3b8'}1a`,
                }}>
                  {lead.stage_name}
                </span>
              )}
              <span className={`px-1.5 py-0.5 text-[10px] uppercase tracking-wider font-bold rounded-md border ${STATUS_BADGE[lead.status] || 'bg-slate-500/10 text-slate-300 border-slate-500/20'}`}>
                {lead.status}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/[0.06]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex border-b border-white/5">
          <DrawerTab active={mode === 'view'} onClick={onSwitchView} icon={<Eye className="w-3.5 h-3.5" />}>View</DrawerTab>
          <DrawerTab active={mode === 'edit'} onClick={onSwitchEdit} icon={<Pencil className="w-3.5 h-3.5" />}>Edit</DrawerTab>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {mode === 'view' ? (
            <ViewPanel lead={lead} details={details} members={members} onAssign={onAssign} />
          ) : (
            <EditPanel form={form} setForm={setForm} />
          )}
        </div>

        <div className="px-5 py-3 border-t border-white/5 flex items-center justify-between">
          <button
            onClick={onDelete}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-300 hover:bg-red-500/[0.08]"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete lead
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-white/[0.04]">
              Close
            </button>
            {mode === 'edit' && (
              <button
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DrawerTab({
  active, onClick, icon, children,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-4 py-2.5 text-[11px] uppercase tracking-wider font-bold inline-flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
        active ? 'border-emerald-500 text-emerald-300 bg-white/[0.02]' : 'border-transparent text-slate-400 hover:text-white hover:bg-white/[0.02]'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function ViewPanel({
  lead, details, members, onAssign,
}: {
  lead: WorkspaceLead;
  details: Record<string, unknown> | null;
  members: MemberLite[];
  onAssign: (uid: number | null) => void;
}) {
  const [assignOpen, setAssignOpen] = useState(false);
  return (
    <div className="space-y-5 text-xs">
      <Section title="Contact">
        <DetailRow icon={Mail} label="Email" value={lead.email || '—'} />
        <DetailRow icon={Phone} label="Phone" value={lead.phone || '—'} />
        <DetailRow icon={Building2} label="Company" value={lead.company_name || '—'} />
      </Section>

      <Section title="Pipeline">
        <DetailRow icon={Columns} label="Pipeline" value={
          lead.pipeline_name
            ? (lead.pipeline_industry && lead.pipeline_industry !== 'generic'
                ? `${lead.pipeline_name} (${lead.pipeline_industry.replace(/_/g, ' ')})`
                : lead.pipeline_name)
            : '—'
        } />
        <DetailRow icon={Tag} label="Source" value={lead.source_name || '—'} />
        <DetailRow icon={Activity} label="Stage" value={lead.stage_name || '—'} />
        <DetailRow icon={CheckCircle2} label="Status" value={lead.status} />
        {typeof lead.score === 'number' && (
          <DetailRow icon={TrendingUp} label="Score" value={String(lead.score)} />
        )}
      </Section>

      <Section title="Ownership">
        <div className="flex items-start gap-3">
          <UserIcon className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
          <div className="text-[10px] uppercase tracking-wider text-slate-500 w-20 shrink-0 mt-0.5">Assigned</div>
          <div className="flex-1">
            <InlineAssign
              lead={lead}
              members={members}
              open={assignOpen}
              onOpen={() => setAssignOpen(true)}
              onClose={() => setAssignOpen(false)}
              onAssign={(uid) => { setAssignOpen(false); onAssign(uid); }}
            />
          </div>
        </div>
        <DetailRow icon={Calendar} label="Created" value={new Date(lead.created_at).toLocaleString()} />
      </Section>

      {details && (
        <Section title="Full record">
          <pre className="rounded-lg bg-[#080e1c] border border-white/10 p-3 text-[10.5px] text-slate-300 font-mono whitespace-pre-wrap break-all max-h-72 overflow-y-auto">
{JSON.stringify(details, null, 2)}
          </pre>
        </Section>
      )}
    </div>
  );
}

function EditPanel({
  form, setForm,
}: {
  form: { first_name: string; last_name: string; email: string; phone: string; status: string };
  setForm: React.Dispatch<React.SetStateAction<typeof form>>;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <FieldInput label="First name" value={form.first_name} onChange={(v) => setForm((f) => ({ ...f, first_name: v }))} />
        <FieldInput label="Last name" value={form.last_name} onChange={(v) => setForm((f) => ({ ...f, last_name: v }))} />
      </div>
      <FieldInput label="Email" type="email" value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} />
      <FieldInput label="Phone" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} />
      <div>
        <FieldLabel>Status</FieldLabel>
        <div className="relative">
          <select
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            className="w-full appearance-none rounded-xl bg-white/[0.02] border border-white/10 px-3 py-2.5 pr-9 text-sm text-white focus:outline-none focus:border-emerald-500/50"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value} className="bg-[#0a1020]">{s.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
        </div>
      </div>

      <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-3 text-[11px] text-amber-100 inline-flex items-start gap-2">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <div>
          Use the <strong>Pipeline view</strong> to drag a lead between stages.
          Assign-to is editable inline on each row.
        </div>
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1.5">{children}</div>;
}

function FieldInput({
  label, value, onChange, type = 'text',
}: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl bg-white/[0.02] border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50"
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-2">{title}</div>
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-2">{children}</div>
    </div>
  );
}

function DetailRow({
  icon: Icon, label, value,
}: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
      <div className="text-[10px] uppercase tracking-wider text-slate-500 w-20 shrink-0 mt-0.5">{label}</div>
      <div className="flex-1 text-sm text-white break-all">{value}</div>
    </div>
  );
}
