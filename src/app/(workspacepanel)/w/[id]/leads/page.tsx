'use client';

import { useCallback, useEffect, useMemo, useRef, useState, use as reactUse } from 'react';
import Link from 'next/link';
import { Plus, RefreshCw, List as ListIcon, Mail, Phone, User as UserIcon, Sparkles, Activity, ChevronDown, Tag, Check } from 'lucide-react';
import { toast } from 'sonner';
import { PageSpinner } from '@/components/StateViews';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import QuotaBadge from '@/components/QuotaBadge';
import { OrganizationService } from '@/services/organization.service';
import { LeadHoverCard } from '@/components/leads/LeadHoverCard';

/**
 * Lead Pipeline (Kanban) — the default Leads page.
 *
 * Columns are LeadStage rows (ordered, color-coded). Each card shows the
 * lead's name, company, value, source, and assigned member. Drag a card to
 * another column → POST /leads/<id>/move/ with the new stage_id.
 *
 * Uses native HTML5 drag-and-drop (no extra library) for maximum
 * compatibility with the new Next.js renderer.
 */

interface KanbanLead {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  company: string;
  value: string | number;
  status: string;
  source: number | null;
  source_name: string | null;
  source_color: string | null;
  stage: number | null;
  stage_name: string | null;
  stage_color: string | null;
  score: number;
  score_band: 'hot' | 'warm' | 'cold';
  temperature?: string;
  ai_recommendation?: string;
  ai_summary?: string;
  last_activity_at?: string | null;
  lifecycle_stage: string;
  assigned_to: number | null;
  assigned_to_email: string | null;
}

interface KanbanColumn {
  id: number | null;
  name: string;
  slug: string;
  color: string;
  order: number;
  probability: number;
  is_won: boolean;
  is_lost: boolean;
  requires_lost_reason: boolean;
  count: number;
  total_value: number;
  weighted_value: number;
  has_more?: boolean;
  leads: KanbanLead[];
}

interface Forecast {
  weighted_pipeline_value: number;
  unweighted_pipeline_value: number;
}

interface PipelineOption {
  id: number; name: string; slug: string; color: string; industry: string; is_default: boolean;
}

interface LeadSource {
  id: number;
  name: string;
  slug: string;
  color: string;
}

interface LeadStage {
  id: number;
  name: string;
  slug: string;
  color: string;
}

export default function LeadsPipelinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = reactUse(params);
  return (
    <PermissionGuard required="crm.leads_view" workspaceId={id} skeleton="kanban">
      <LeadsPipelineInner wsIdString={id} />
    </PermissionGuard>
  );
}

function LeadsPipelineInner({ wsIdString }: { wsIdString: string }) {
  const id = wsIdString;
  const wsId = Number(id);

  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [stages, setStages] = useState<LeadStage[]>([]);
  const [tick, setTick] = useState<{ fired: number; moved: number; next_due: string | null } | null>(null);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [lostReasons, setLostReasons] = useState<{ id: number; name: string }[]>([]);
  const [pipelines, setPipelines] = useState<PipelineOption[]>([]);
  const [activePipeline, setActivePipeline] = useState<PipelineOption | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showAddStage, setShowAddStage] = useState(false);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [pendingLost, setPendingLost] = useState<{ leadId: number; stageId: number } | null>(null);
  // Hover preview — a single fixed-position card driven by which lead the mouse
  // is over (positioned from the card's rect, so it escapes the column overflow).
  const [hover, setHover] = useState<{ lead: KanbanLead; top: number; left: number } | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openHover = (lead: KanbanLead, el: HTMLElement) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    if (draggingId !== null) return;
    const r = el.getBoundingClientRect();
    const left = Math.min(r.right + 8, window.innerWidth - 300);
    const top = Math.min(r.top, window.innerHeight - 240);
    setHover({ lead, top: Math.max(8, top), left });
  };
  const closeHover = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setHover(null), 140);
  };
  // Source filter — passes ?source=<id>|none to the kanban endpoint so the
  // board can be sliced by which lead-source the cards came in from.
  const [sourceFilter, setSourceFilter] = useState<'' | 'none' | number>('');
  // Per-column pagination state. Each column starts at page 1 (the
  // first batch returned by the main kanban GET). "Load more" calls
  // /leads/kanban/column/?stage=<id>&page=N and appends the result to
  // ``columns[i].leads``. Keyed by stage id ("none" for unstaged).
  const [columnPages, setColumnPages] = useState<Record<string, number>>({});
  const [columnLoading, setColumnLoading] = useState<Record<string, boolean>>({});

  // Refs let ``fetchAll`` read the latest pipeline / filter without
  // depending on them — keeping the callback identity stable across
  // renders. The original implementation listed ``activePipeline`` in
  // the deps; since ``fetchAll`` ALSO calls ``setActivePipeline``, the
  // first successful load changed the callback identity, re-fired the
  // ``useEffect([load])``, and triggered a second fetch + a second
  // skeleton flash. With 5,915 leads in the workspace that second
  // fetch is slow enough to feel like a permanent loading state.
  const activePipelineRef = useRef(activePipeline);
  const sourceFilterRef = useRef(sourceFilter);
  useEffect(() => { activePipelineRef.current = activePipeline; }, [activePipeline]);
  useEffect(() => { sourceFilterRef.current = sourceFilter; }, [sourceFilter]);

  // Two flavours of refresh:
  //   - ``load()``       → user-triggered + first mount, shows the
  //                        skeleton via ``setLoading(true)``.
  //   - ``fetchAll()``   → background polling and post-mutation
  //                        refresh, never flips loading so the kanban
  //                        doesn't flash a blank skeleton every 15s.
  // Stable identity (deps only ``wsId``) — re-fires only when the
  // workspace actually changes, not on every state setter inside.
  const fetchAll = useCallback(async (opts?: { silent?: boolean }) => {
    const pipelineId = activePipelineRef.current?.id;
    const sourceId = sourceFilterRef.current;
    // Each call is wrapped in ``.catch`` so a single failing endpoint
    // doesn't take down the whole board. Previously the unhandled
    // rejection from ``Promise.all`` bubbled up and — combined with
    // the slow kanban response on big workspaces — left the page
    // stuck on the loading skeleton.
    const safe = <T,>(p: Promise<T>): Promise<T | null> => p.catch(() => null);
    const [board, srcs, stgs, lrs] = await Promise.all([
      safe(OrganizationService.leadKanbanPipeline(pipelineId, wsId, {
        source: sourceId || undefined,
        // Skip the automation tick on background polls so the silent
        // refresh stays fast and doesn't double-fire follow-ups.
        ...(opts?.silent ? { skip_tick: 1 } : {}),
      })),
      safe(OrganizationService.listLeadSources()),
      // Scope stages to the active pipeline so the "move to stage"
      // dropdown only shows columns that actually exist on this board.
      // Falls back to all stages on first mount (before
      // ``activePipeline`` is hydrated from the board response).
      safe(OrganizationService.listLeadStages(
        pipelineId ? { pipeline: pipelineId } : undefined,
      )),
      safe(OrganizationService.listLostReasons()),
    ]);
    if (board?.success) {
      setColumns(board.data.columns);
      // A full board refetch resets pagination — the columns we just
      // received are page 1 of every stage. Without clearing this,
      // "Load more" would jump straight to page 3+ on the user.
      if (!opts?.silent) setColumnPages({});
      if (board.data.automation) setTick(board.data.automation);
      if (board.data.forecast) setForecast(board.data.forecast);
      if (Array.isArray(board.data.pipelines)) setPipelines(board.data.pipelines);
      if (board.data.active_pipeline && !activePipelineRef.current) {
        // First load — adopt whatever pipeline the backend picked.
        // The ref read above already used ``undefined``, so updating
        // state here doesn't invalidate this callback.
        setActivePipeline(board.data.active_pipeline);
      }
    } else if (!opts?.silent) {
      // Surface the failure instead of letting the skeleton linger.
      toast.error(board?.message || 'Failed to load pipeline.');
    }
    if (srcs?.success) setSources(srcs.data);
    if (stgs?.success) setStages(stgs.data);
    if (lrs?.success) setLostReasons(lrs.data);
  }, [wsId]);

  const load = useCallback(async () => {
    setLoading(true);
    try { await fetchAll(); } finally { setLoading(false); }
  }, [fetchAll]);

  // First-mount fetch + when the user explicitly changes pipeline /
  // source filter. We watch the underlying primitive (id) not the
  // object reference so a re-render with the same pipeline doesn't
  // cause a re-fetch.
  const activePipelineId = activePipeline?.id ?? null;
  useEffect(() => {
    load();
    // ``load`` is stable (only deps on wsId, which is itself in this
    // dep array via the ref read). Explicit pipeline/source changes
    // re-trigger here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsId, activePipelineId, sourceFilter]);

  // Background refresh every 15s — silent (no skeleton). Skipped when
  // the tab is hidden so we don't burn API calls in background tabs.
  // Stable interval — depends only on ``fetchAll`` whose identity now
  // only changes on workspace switch, so the timer is set up once.
  useEffect(() => {
    const t = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      fetchAll({ silent: true });
    }, 15_000);
    return () => clearInterval(t);
  }, [fetchAll]);

  // --- column pagination ---
  const loadMoreColumn = async (stageId: number | null) => {
    const key = stageId === null ? 'none' : String(stageId);
    if (columnLoading[key]) return;
    setColumnLoading((m) => ({ ...m, [key]: true }));
    try {
      const currentPage = columnPages[key] || 1;
      const nextPage = currentPage + 1;
      const res = await OrganizationService.leadKanbanColumn({
        stage: stageId === null ? 'none' : stageId,
        workspace: wsId,
        pipeline: activePipeline?.id,
        source: sourceFilter === '' ? undefined : sourceFilter,
        page: nextPage,
      });
      if (!res?.success) {
        toast.error(res?.message || 'Failed to load more leads.');
        return;
      }
      setColumnPages((m) => ({ ...m, [key]: nextPage }));
      setColumns((cols) =>
        cols.map((c) => {
          if (c.id !== stageId) return c;
          // Dedupe by id in case a card was just moved while paging.
          const seen = new Set(c.leads.map((l) => l.id));
          const additions = (res.data.leads as KanbanLead[]).filter(
            (l) => !seen.has(l.id),
          );
          return {
            ...c,
            leads: [...c.leads, ...additions],
            has_more: !!res.data.has_more,
          };
        }),
      );
    } catch {
      toast.error('Failed to load more leads.');
    } finally {
      setColumnLoading((m) => ({ ...m, [key]: false }));
    }
  };

  // --- drag handlers ---
  const onDragStart = (leadId: number) => setDraggingId(leadId);
  const onDragEnd = () => setDraggingId(null);

  const onDrop = async (stageId: number | null) => {
    if (draggingId == null) return;
    // If the target stage demands a lost reason, pop a picker first instead of moving.
    const targetCol = columns.find((c) => c.id === stageId);
    if (targetCol && (targetCol.requires_lost_reason || targetCol.is_lost)) {
      setPendingLost({ leadId: draggingId, stageId: stageId as number });
      setDraggingId(null);
      return;
    }
    // Optimistic reorder
    setColumns((cols) => {
      const next = cols.map((c) => ({ ...c, leads: c.leads.filter((l) => l.id !== draggingId) }));
      let moved: KanbanLead | undefined;
      cols.forEach((c) => c.leads.forEach((l) => { if (l.id === draggingId) moved = l; }));
      if (moved) {
        const target = next.find((c) => c.id === stageId);
        if (target) {
          target.leads.unshift({ ...moved });
          target.count = target.leads.length;
        }
      }
      return next;
    });
    setDraggingId(null);
    try {
      const res = await OrganizationService.moveLeadStage(draggingId, stageId);
      if (!res?.success) {
        toast.error(res?.message || 'Failed to move lead');
        load();
      } else {
        toast.success('Stage updated');
      }
    } catch (err) {
      toast.error('Failed to move lead');
      load();
    }
  };

  const totalLeads = useMemo(() => columns.reduce((s, c) => s + c.count, 0), [columns]);
  const totalValue = useMemo(() => columns.reduce((s, c) => s + (c.total_value || 0), 0), [columns]);

  if (loading) return <PageSkeleton kind="kanban" />;

  return (
    <div>
      {/* Header bar */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h1 className="text-2xl font-bold text-white">Pipeline</h1>
            <QuotaBadge quota="leads" label="leads" />
            {pipelines.length > 1 && (
              <div className="relative">
                <select
                  value={activePipeline?.id ?? ''}
                  onChange={(e) => {
                    const p = pipelines.find((pp) => pp.id === Number(e.target.value));
                    if (p) setActivePipeline(p);
                  }}
                  className="appearance-none pl-3 pr-8 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-white hover:bg-white/[0.06] focus:outline-none cursor-pointer"
                >
                  {pipelines.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            )}
            {activePipeline && (
              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md"
                    style={{ backgroundColor: `${activePipeline.color}1a`, color: activePipeline.color, border: `1px solid ${activePipeline.color}40` }}>
                {activePipeline.industry}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 mt-1">
            {totalLeads} {totalLeads === 1 ? 'lead' : 'leads'} · ${totalValue.toLocaleString()} pipeline
            {forecast && (
              <>
                {' '}· <span className="text-emerald-300">${Math.round(forecast.weighted_pipeline_value).toLocaleString()} weighted</span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <KanbanSourceFilter value={sourceFilter} onChange={setSourceFilter} sources={sources} />
          <button
            onClick={load}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link
            href={`/w/${id}/leads/list`}
            className="px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 inline-flex items-center gap-2"
          >
            <ListIcon className="w-4 h-4" />
            List view
          </Link>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New lead
          </button>
        </div>
      </div>

      {/* Live automation strip */}
      {tick && (
        <div className="mb-5 flex items-center justify-between rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] px-4 py-2.5 text-xs">
          <div className="flex items-center gap-3 text-slate-300">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
            <span>
              Auto-pilot is running — leads stage themselves, get an owner, and follow-ups fire on time.
            </span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Just fired: <strong className="text-emerald-300">{tick.fired}</strong></span>
            <span>Auto-moved: <strong className="text-cyan-300">{tick.moved}</strong></span>
            <Link href={`/w/${id}/leads/center`} className="inline-flex items-center gap-1 text-emerald-400 hover:underline">
              <Activity className="w-3 h-3" /> Open center
            </Link>
          </div>
        </div>
      )}

      {/* Kanban */}
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2">
        {columns.map((col) => (
          <div
            key={col.id ?? 'unstaged'}
            className="w-72 shrink-0 rounded-2xl bg-white/[0.02] border border-white/5"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(col.id)}
          >
            {/* Column header */}
            <div
              className="px-4 py-3 border-b border-white/5"
              style={{ borderTop: `3px solid ${col.color}`, borderTopLeftRadius: 14, borderTopRightRadius: 14 }}
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: col.color }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{col.name}</div>
                  <div className="text-[11px] text-slate-500">
                    {col.count} · ${Number(col.total_value).toLocaleString()}
                  </div>
                </div>
                {typeof col.probability === 'number' && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                    style={{ backgroundColor: `${col.color}26`, color: col.color }}
                    title={`Win probability for this stage`}
                  >
                    {col.probability}%
                  </span>
                )}
                {col.is_won && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">won</span>
                )}
                {col.is_lost && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-300 border border-red-500/20">lost</span>
                )}
              </div>
              {(col.weighted_value || 0) > 0 && (
                <div className="mt-1 text-[10px] text-slate-500">
                  Forecast: <span className="text-emerald-300">${Math.round(col.weighted_value).toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Cards */}
            <div className="p-2 space-y-2 min-h-[200px] max-h-[calc(100vh-280px)] overflow-y-auto">
              {col.leads.map((lead) => (
                <Link
                  href={`/w/${id}/leads/${lead.id}`}
                  key={lead.id}
                  draggable
                  onDragStart={() => { setHover(null); onDragStart(lead.id); }}
                  onDragEnd={onDragEnd}
                  onMouseEnter={(e) => openHover(lead, e.currentTarget)}
                  onMouseLeave={closeHover}
                  onClick={(e) => { if (draggingId !== null) e.preventDefault(); }}
                  className={`block group rounded-xl border bg-[#0c1424] p-3 cursor-grab active:cursor-grabbing transition-colors ${
                    draggingId === lead.id ? 'opacity-40' : 'border-white/5 hover:border-emerald-500/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-white truncate">{lead.full_name}</h3>
                      {lead.company && (
                        <p className="text-[11px] text-slate-500 mt-0.5 truncate">{lead.company}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {Number(lead.value) > 0 && (
                        <span className="text-[11px] font-semibold text-emerald-300">
                          ${Number(lead.value).toLocaleString()}
                        </span>
                      )}
                      {typeof lead.score === 'number' && (
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                            lead.score_band === 'hot'
                              ? 'bg-red-500/15 text-red-300 border border-red-500/30'
                              : lead.score_band === 'warm'
                              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                              : 'bg-slate-500/15 text-slate-300 border border-slate-500/20'
                          }`}
                          title={`Lead score: ${lead.score}`}
                        >
                          {lead.score_band} · {lead.score}
                        </span>
                      )}
                    </div>
                  </div>

                  {lead.lifecycle_stage && lead.lifecycle_stage !== 'lead' && (
                    <span className="mt-1.5 inline-block text-[9px] uppercase tracking-wider text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 rounded px-1.5 py-0.5">
                      {lead.lifecycle_stage}
                    </span>
                  )}

                  {lead.source_name && (
                    <div
                      className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border"
                      style={{
                        color: lead.source_color || '#64748b',
                        borderColor: `${lead.source_color || '#64748b'}40`,
                        backgroundColor: `${lead.source_color || '#64748b'}1a`,
                      }}
                    >
                      {lead.source_name}
                    </div>
                  )}

                  <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-500">
                    {lead.email && (
                      <span className="inline-flex items-center gap-1 truncate">
                        <Mail className="w-3 h-3 shrink-0" />
                        <span className="truncate max-w-[120px]">{lead.email}</span>
                      </span>
                    )}
                    {lead.phone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {lead.phone}
                      </span>
                    )}
                  </div>

                  {lead.assigned_to_email && (
                    <div className="mt-2 pt-2 border-t border-white/5 flex items-center gap-1.5 text-[11px] text-slate-500">
                      <UserIcon className="w-3 h-3" />
                      <span className="truncate">{lead.assigned_to_email}</span>
                    </div>
                  )}
                </Link>
              ))}
              {col.leads.length === 0 && (
                <div className="text-center text-[11px] text-slate-600 py-8">
                  Drop leads here
                </div>
              )}
              {col.has_more && (() => {
                const key = col.id === null ? 'none' : String(col.id);
                const busy = !!columnLoading[key];
                const remaining = Math.max(0, col.count - col.leads.length);
                return (
                  <button
                    type="button"
                    onClick={() => loadMoreColumn(col.id)}
                    disabled={busy}
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-dashed border-white/10 hover:border-emerald-500/30 hover:bg-emerald-500/[0.04] text-[11px] font-semibold text-slate-400 hover:text-emerald-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {busy ? 'Loading…' : `Load ${Math.min(100, remaining)} more`}
                    {!busy && remaining > 100 && (
                      <span className="ml-1 text-slate-600">({remaining} left)</span>
                    )}
                  </button>
                );
              })()}
            </div>
          </div>
        ))}
        {columns.length === 0 && (
          <div className="w-full text-center py-16 text-slate-500">
            No stages configured.{' '}
            <Link href={`/w/${id}/leads/automation`} className="text-emerald-400 hover:underline">
              Set up your pipeline
            </Link>
          </div>
        )}

        {/* Add-stage column — only shows for users with edit permission. */}
        {activePipeline && (
          <button
            onClick={() => setShowAddStage(true)}
            className="w-72 shrink-0 rounded-2xl border-2 border-dashed border-white/10 hover:border-emerald-500/30 hover:bg-emerald-500/[0.03] transition-colors flex items-center justify-center text-slate-500 hover:text-emerald-300 min-h-[200px]"
          >
            <span className="inline-flex flex-col items-center gap-2">
              <Plus className="w-6 h-6" />
              <span className="text-xs font-medium">Add stage</span>
            </span>
          </button>
        )}
      </div>

      {showCreate && (
        <CreateLeadModal
          workspaceId={wsId}
          sources={sources}
          stages={stages}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}

      {pendingLost && (
        <LostReasonModal
          reasons={lostReasons}
          onCancel={() => setPendingLost(null)}
          onPick={async (reasonId) => {
            try {
              const res = await OrganizationService.moveLeadStage(pendingLost.leadId, pendingLost.stageId, reasonId);
              if (res?.success) {
                toast.success('Lead marked lost');
                setPendingLost(null);
                load();
              } else toast.error(res?.message || 'Failed');
            } catch {
              toast.error('Failed');
            }
          }}
        />
      )}

      {showAddStage && activePipeline && (
        <AddStageModal
          pipelineId={activePipeline.id}
          onClose={() => setShowAddStage(false)}
          onCreated={() => { setShowAddStage(false); load(); }}
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

function AddStageModal({
  pipelineId, onClose, onCreated,
}: { pipelineId: number; onClose: () => void; onCreated: () => void }) {
  const STAGE_COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#ec4899', '#64748b'];
  const [form, setForm] = useState({ name: '', color: STAGE_COLORS[0], probability: 30 });
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Name required'); return; }
    setBusy(true);
    try {
      const res = await OrganizationService.createLeadStage({
        name: form.name,
        color: form.color,
        probability: form.probability,
        pipeline: pipelineId,
      });
      if (res?.success) { toast.success('Stage created'); onCreated(); }
      else toast.error(res?.message || 'Failed');
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed');
    } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-[#0c1424] border border-white/10 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Add a stage</h2>
        <div className="space-y-3">
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-slate-500">Stage name</span>
            <input className="mt-1 w-full px-3 py-2 rounded-lg bg-[#080e1c] border border-white/10 text-sm text-white" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Demo scheduled" />
          </label>
          <div>
            <span className="text-[11px] uppercase tracking-wider text-slate-500">Color</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {STAGE_COLORS.map((c) => (
                <button type="button" key={c} onClick={() => setForm({ ...form, color: c })}
                  className={`w-7 h-7 rounded-md border-2 transition-transform ${form.color === c ? 'scale-110 border-white/40' : 'border-transparent'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-slate-500">Win probability ({form.probability}%)</span>
            <input type="range" min={0} max={100} step={5} className="mt-1 w-full accent-emerald-500"
              value={form.probability} onChange={(e) => setForm({ ...form, probability: Number(e.target.value) })} />
            <p className="text-[10px] text-slate-500 mt-1">Used by the weighted-pipeline forecast.</p>
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-white/5">Cancel</button>
          <button type="submit" disabled={busy} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold disabled:opacity-50">{busy ? 'Creating…' : 'Create stage'}</button>
        </div>
      </form>
    </div>
  );
}

function LostReasonModal({
  reasons, onCancel, onPick,
}: {
  reasons: { id: number; name: string }[];
  onCancel: () => void;
  onPick: (id: number) => void;
}) {
  const [pick, setPick] = useState<number | null>(null);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-[#0c1424] border border-white/10 p-6">
        <h2 className="text-lg font-semibold text-white">Why is this deal lost?</h2>
        <p className="text-xs text-slate-500 mt-1">Required by your pipeline rules — drives the win/loss report.</p>
        <div className="mt-4 space-y-1.5 max-h-[300px] overflow-y-auto">
          {reasons.map((r) => (
            <button
              key={r.id}
              onClick={() => setPick(r.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                pick === r.id ? 'bg-red-500/10 text-red-200 border border-red-500/30' : 'text-slate-300 hover:bg-white/[0.04] border border-transparent'
              }`}
            >
              {r.name}
            </button>
          ))}
          {reasons.length === 0 && <p className="text-xs text-slate-500">No lost reasons configured.</p>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-white/5">Cancel</button>
          <button
            disabled={!pick}
            onClick={() => pick && onPick(pick)}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold disabled:opacity-50"
          >
            Mark lost
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateLeadModal({
  workspaceId, sources, stages, onClose, onCreated,
}: {
  workspaceId: number;
  sources: LeadSource[];
  stages: LeadStage[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '', company: '',
    value: '0',
    source: '', stage: '',
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name.trim()) {
      toast.error('First name is required');
      return;
    }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email || null,
        phone: form.phone || null,
        company: form.company,
        value: form.value || '0',
        workspace: workspaceId,
        status: 'new',
      };
      if (form.source) payload.source = Number(form.source);
      if (form.stage) payload.stage = Number(form.stage);
      const res = await OrganizationService.workspaceLeadsCreate(workspaceId, payload);
      if (res?.success) {
        toast.success('Lead created — automation scheduled');
        onCreated();
      } else {
        toast.error(res?.message || 'Failed to create');
      }
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to create');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl bg-[#0c1424] border border-white/10 p-6 shadow-2xl"
      >
        <h2 className="text-lg font-semibold text-white mb-1">New lead</h2>
        <p className="text-xs text-slate-500 mb-4">
          Pick a source to auto-schedule follow-ups from your automation flow.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name *">
            <input className={inputCls} value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
          </Field>
          <Field label="Last name">
            <input className={inputCls} value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
          </Field>
          <Field label="Email">
            <input type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Phone">
            <input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Company">
            <input className={inputCls} value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          </Field>
          <Field label="Estimated value ($)">
            <input type="number" className={inputCls} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
          </Field>
          <Field label="Source (triggers automation)">
            <select className={inputCls} value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
              <option value="">— none —</option>
              {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Stage">
            <select className={inputCls} value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
              <option value="">— none —</option>
              {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-white/5">
            Cancel
          </button>
          <button type="submit" disabled={busy} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold disabled:opacity-50">
            {busy ? 'Creating…' : 'Create lead'}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputCls = 'w-full px-3 py-2 rounded-lg bg-[#080e1c] border border-white/10 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wider text-slate-500">{label}</span>
      {children}
    </label>
  );
}

/** Source filter for the kanban — same custom popover style as the leads
 *  list page so the dropdown options are themed dark instead of relying
 *  on browser-native select styling. */
function KanbanSourceFilter({
  value, onChange, sources,
}: {
  value: '' | 'none' | number;
  onChange: (v: '' | 'none' | number) => void;
  sources: LeadSource[];
}) {
  const [open, setOpen] = useState(false);
  const label =
    value === ''     ? 'Any source'
    : value === 'none' ? 'No source'
    : sources.find((s) => s.id === value)?.name || `Source #${value}`;
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-sm font-medium text-slate-300"
        title="Filter by lead source"
      >
        <Tag className="w-3.5 h-3.5 text-slate-400" />
        {label}
        <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 w-56 rounded-xl border border-white/10 bg-[#0a1020] shadow-xl py-1 max-h-72 overflow-y-auto">
            <SrcRow active={value === ''} label="Any source" onClick={() => { onChange(''); setOpen(false); }} />
            <SrcRow active={value === 'none'} label="No source" onClick={() => { onChange('none'); setOpen(false); }} />
            {sources.length > 0 && <div className="h-px bg-white/5 my-1" />}
            {sources.map((s) => (
              <button
                key={s.id}
                onClick={() => { onChange(s.id); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 ${
                  value === s.id ? 'bg-emerald-500/10 text-emerald-200' : 'text-slate-200 hover:bg-white/[0.04]'
                }`}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color || '#64748b' }} />
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

function SrcRow({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 ${
        active ? 'bg-emerald-500/10 text-emerald-200' : 'text-slate-200 hover:bg-white/[0.04]'
      }`}
    >
      <span className="w-3.5" />
      <span className="font-semibold flex-1">{label}</span>
      {active && <Check className="w-3 h-3 text-emerald-300" />}
    </button>
  );
}
