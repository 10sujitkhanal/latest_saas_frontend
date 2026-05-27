'use client';

import { useCallback, useEffect, useState, use as reactUse } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, CheckCircle2, AlertCircle, XCircle, Clock, RefreshCw, ChevronDown,
  ChevronRight, Activity, Zap, AlertTriangle, FileJson, User as UserIcon,
} from 'lucide-react';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { OrganizationService } from '@/services/organization.service';

/**
 * Workflow execution history.
 *
 *   • Top: workflow name + summary stats (total runs / ok / errored).
 *   • List of runs, newest first. Each row collapsible to show every
 *     step with status, summary, input, output, error.
 *   • Status pills make a 1-second skim work: green ✓ / red ✕ / amber
 *     skipped / slate stopped.
 *   • Re-fetch button + an auto-refresh every 30s so you can watch
 *     real-time executions land while testing.
 */

interface StepRow {
  id: number;
  position: number;
  node_id: string;
  node_code: string;
  node_label: string;
  status: 'ok' | 'error' | 'skipped' | 'stopped';
  summary: string;
  input_payload: Record<string, unknown>;
  output_payload: Record<string, unknown>;
  error_message: string;
  error_traceback: string;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number;
}

interface RunRow {
  id: number;
  workflow: number;
  workflow_name: string;
  lead: number;
  lead_name: string;
  lead_email: string;
  outcome: 'ok' | 'error' | 'skipped';
  detail: string;
  steps_total: number;
  steps_ok: number;
  steps_error: number;
  steps_skipped: number;
  trigger_snapshot: Record<string, unknown>;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number;
  ran_at: string;
  steps: StepRow[];
}

export default function WorkflowRunsPage({
  params,
}: { params: Promise<{ id: string; wfId: string }> }) {
  const { id: wsId, wfId } = reactUse(params);
  return (
    <PermissionGuard required="crm.leads_view" workspaceId={wsId} skeleton="list">
      <RunsInner wsId={wsId} wfId={Number(wfId)} />
    </PermissionGuard>
  );
}

function RunsInner({ wsId, wfId }: { wsId: string; wfId: number }) {
  const [data, setData] = useState<{ workflow_name: string; total: number; shown: number; runs: RunRow[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    const res = await OrganizationService.workflowRuns(wfId, { limit: 50 });
    if (res?.success) setData(res.data);
    setLoading(false);
  }, [wfId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  const toggle = (id: number) => {
    setExpanded((curr) => {
      const next = new Set(curr);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading || !data) return <PageSkeleton kind="list" />;

  const stats = data.runs.reduce(
    (acc, r) => ({
      ok: acc.ok + (r.outcome === 'ok' ? 1 : 0),
      err: acc.err + (r.outcome === 'error' ? 1 : 0),
      skip: acc.skip + (r.outcome === 'skipped' ? 1 : 0),
    }),
    { ok: 0, err: 0, skip: 0 },
  );

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href={`/w/${wsId}/leads/workflows`} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-white mb-2">
            <ArrowLeft className="w-3.5 h-3.5" />
            Workflows
          </Link>
          <h1 className="text-2xl font-bold text-white inline-flex items-center gap-2">
            <Activity className="w-6 h-6 text-emerald-300" />
            {data.workflow_name} — Runs
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Every time this workflow fired, with per-node status and full payloads. Auto-refreshes every 30 s.
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-slate-200"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Stat label="Total runs" value={data.total} accent="#94a3b8" />
        <Stat label="Successful" value={stats.ok} accent="#10b981" />
        <Stat label="Errored" value={stats.err} accent="#ef4444" />
        <Stat label="Skipped" value={stats.skip} accent="#f59e0b" />
      </div>

      {data.runs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">
          <Zap className="w-8 h-8 mx-auto mb-2 text-slate-600" />
          No runs yet. The next time the trigger fires (or you Run it manually) it&apos;ll appear here.
        </div>
      ) : (
        <div className="space-y-2">
          {data.runs.map((run) => (
            <RunCard
              key={run.id}
              run={run}
              isOpen={expanded.has(run.id)}
              onToggle={() => toggle(run.id)}
              wsId={wsId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-2xl font-bold mt-1" style={{ color: accent }}>{value.toLocaleString()}</div>
    </div>
  );
}

function RunCard({ run, isOpen, onToggle, wsId }: { run: RunRow; isOpen: boolean; onToggle: () => void; wsId: string }) {
  const outcomeMeta = {
    ok:      { color: '#10b981', label: 'Success',  Icon: CheckCircle2 },
    error:   { color: '#ef4444', label: 'Errored',  Icon: XCircle },
    skipped: { color: '#f59e0b', label: 'Skipped',  Icon: AlertCircle },
  }[run.outcome] || { color: '#94a3b8', label: run.outcome, Icon: AlertCircle };
  const OutcomeIcon = outcomeMeta.Icon;

  return (
    <article className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-white/[0.03]"
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${outcomeMeta.color}22`, color: outcomeMeta.color, border: `1px solid ${outcomeMeta.color}44` }}
        >
          <OutcomeIcon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-white">Run #{run.id}</span>
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full font-bold"
                  style={{ backgroundColor: `${outcomeMeta.color}1f`, color: outcomeMeta.color, border: `1px solid ${outcomeMeta.color}55` }}>
              {outcomeMeta.label}
            </span>
            <span className="text-[10px] text-slate-500">
              {run.steps_ok} ok · {run.steps_error} error · {run.steps_skipped} skipped
            </span>
            {run.duration_ms > 0 && (
              <span className="text-[10px] text-slate-500 inline-flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDuration(run.duration_ms)}
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 truncate">
            <UserIcon className="w-3 h-3 inline mr-1" />
            <Link href={`/w/${wsId}/leads/${run.lead}`} className="hover:text-emerald-300" onClick={(e) => e.stopPropagation()}>
              {run.lead_name}
            </Link>
            {run.lead_email && <span className="text-slate-500"> · {run.lead_email}</span>}
            <span className="text-slate-600 mx-1">·</span>
            {new Date(run.ran_at).toLocaleString()}
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="px-4 pb-4 border-t border-white/5">
          <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mt-3 mb-2">
            Steps ({run.steps.length})
          </div>
          {run.steps.length === 0 ? (
            <div className="text-xs text-slate-500 italic">No steps recorded.</div>
          ) : (
            <ol className="space-y-2">
              {run.steps.map((s) => (
                <StepRowCard key={s.id} step={s} />
              ))}
            </ol>
          )}

          {Object.keys(run.trigger_snapshot || {}).length > 0 && (
            <details className="mt-3 rounded-lg border border-white/5 bg-white/[0.02]">
              <summary className="px-3 py-1.5 text-[11px] text-slate-400 cursor-pointer hover:text-white">
                <FileJson className="w-3 h-3 inline mr-1" /> Trigger snapshot
              </summary>
              <pre className="px-3 pb-3 text-[10.5px] text-slate-300 font-mono whitespace-pre-wrap break-all">
{JSON.stringify(run.trigger_snapshot, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </article>
  );
}

function StepRowCard({ step }: { step: StepRow }) {
  const [showPayloads, setShowPayloads] = useState(false);
  const statusMeta = {
    ok:      { color: '#10b981', Icon: CheckCircle2, label: 'OK' },
    error:   { color: '#ef4444', Icon: XCircle, label: 'Error' },
    skipped: { color: '#f59e0b', Icon: AlertCircle, label: 'Skipped' },
    stopped: { color: '#94a3b8', Icon: AlertTriangle, label: 'Stopped' },
  }[step.status] || { color: '#94a3b8', Icon: AlertCircle, label: step.status };
  const StatusIcon = statusMeta.Icon;

  return (
    <li className="rounded-lg border bg-white/[0.02]" style={{ borderColor: `${statusMeta.color}33` }}>
      <div className="flex items-start gap-3 p-3">
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5"
          style={{ backgroundColor: `${statusMeta.color}22`, color: statusMeta.color, border: `1px solid ${statusMeta.color}44` }}
        >
          <StatusIcon className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider text-slate-500">#{step.position}</span>
            <span className="text-sm font-bold text-white">{step.node_label || step.node_code}</span>
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full font-bold"
                  style={{ backgroundColor: `${statusMeta.color}1f`, color: statusMeta.color, border: `1px solid ${statusMeta.color}55` }}>
              {statusMeta.label}
            </span>
            {step.duration_ms > 0 && (
              <span className="text-[10px] text-slate-500 inline-flex items-center gap-1">
                <Clock className="w-3 h-3" />{formatDuration(step.duration_ms)}
              </span>
            )}
            <code className="text-[10px] text-slate-500">{step.node_code}</code>
          </div>
          {step.summary && (
            <div className="text-[11.5px] text-slate-300 mt-1">{step.summary}</div>
          )}
          {step.error_message && (
            <div className="mt-2 rounded-md border border-red-500/30 bg-red-500/[0.06] p-2 text-[11px] text-red-200">
              <strong className="block text-red-300 mb-0.5">{step.error_message}</strong>
              {step.error_traceback && (
                <pre className="text-[10.5px] mt-1 font-mono whitespace-pre-wrap break-all max-h-32 overflow-y-auto opacity-80">
{step.error_traceback}
                </pre>
              )}
            </div>
          )}
          <button
            onClick={() => setShowPayloads((v) => !v)}
            className="mt-2 inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-white"
          >
            <ChevronRight className={`w-3 h-3 transition-transform ${showPayloads ? 'rotate-90' : ''}`} />
            {showPayloads ? 'Hide' : 'Show'} input / output
          </button>
          {showPayloads && (
            <div className="mt-2 grid grid-cols-1 lg:grid-cols-2 gap-2">
              <PayloadBlock title="Input" payload={step.input_payload} accent="#06b6d4" />
              <PayloadBlock title="Output" payload={step.output_payload} accent="#10b981" />
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function PayloadBlock({ title, payload, accent }: { title: string; payload: Record<string, unknown>; accent: string }) {
  const empty = !payload || Object.keys(payload).length === 0;
  return (
    <div className="rounded-md border border-white/5 bg-[#080e1c] p-2">
      <div className="text-[9px] uppercase tracking-wider font-bold mb-1" style={{ color: accent }}>{title}</div>
      {empty ? (
        <div className="text-[10px] text-slate-500 italic">(empty)</div>
      ) : (
        <pre className="text-[10.5px] text-slate-300 font-mono whitespace-pre-wrap break-all max-h-56 overflow-y-auto">
{JSON.stringify(payload, null, 2)}
        </pre>
      )}
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}
