'use client';

import { useCallback, useEffect, useState, use as reactUse } from 'react';
import {
  Plus, Trash2, Zap, Mail, Phone, MessageCircle, Calendar as CalendarIcon,
  CheckSquare, ArrowRight, Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageSpinner } from '@/components/StateViews';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { OrganizationService } from '@/services/organization.service';

/** Lead automation builder.
 *
 * UX: a vertical list of sources on the left, the selected source's flow
 * (ordered FollowUpRule rows) on the right. Each rule says "after N hours,
 * do <kind>". Add / edit / delete rules inline; rules are saved on blur.
 */

interface LeadSource { id: number; name: string; color: string; slug: string; rules_count: number; }
interface LeadStage { id: number; name: string; slug: string; color: string; }
interface FollowUpRule {
  id: number;
  source: number;
  kind: 'call' | 'email' | 'whatsapp' | 'meeting' | 'task' | 'move_stage';
  delay_hours: number;
  title: string;
  note: string;
  target_stage: number | null;
  target_stage_name: string | null;
  is_active: boolean;
  order: number;
}

const KIND_META: Record<string, { label: string; Icon: React.ComponentType<{ className?: string }>; color: string }> = {
  call:       { label: 'Phone call',      Icon: Phone,         color: '#06b6d4' },
  email:      { label: 'Email',           Icon: Mail,          color: '#3b82f6' },
  whatsapp:   { label: 'WhatsApp',        Icon: MessageCircle, color: '#10b981' },
  meeting:    { label: 'Meeting',         Icon: CalendarIcon,  color: '#8b5cf6' },
  task:       { label: 'Task / reminder', Icon: CheckSquare,   color: '#f59e0b' },
  move_stage: { label: 'Move to stage',   Icon: ArrowRight,    color: '#ec4899' },
};

export default function LeadAutomationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard required="crm.leads_edit" workspaceId={wsId} skeleton="detail">
      <LeadAutomationInner />
    </PermissionGuard>
  );
}

function LeadAutomationInner() {
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [stages, setStages] = useState<LeadStage[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [rules, setRules] = useState<FollowUpRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRules, setLoadingRules] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, st] = await Promise.all([
        OrganizationService.listLeadSources(),
        OrganizationService.listLeadStages(),
      ]);
      if (s?.success) {
        setSources(s.data);
        if (s.data.length && active == null) setActive(s.data[0].id);
      }
      if (st?.success) setStages(st.data);
    } finally { setLoading(false); }
  }, [active]);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const loadRules = useCallback(async (sourceId: number) => {
    setLoadingRules(true);
    try {
      const res = await OrganizationService.listSourceRules(sourceId);
      if (res?.success) setRules(res.data);
    } finally { setLoadingRules(false); }
  }, []);

  useEffect(() => {
    if (active != null) loadRules(active);
  }, [active, loadRules]);

  const addRule = async () => {
    if (active == null) return;
    const order = rules.length ? Math.max(...rules.map((r) => r.order)) + 10 : 10;
    const payload = {
      kind: 'task' as const,
      delay_hours: 24,
      title: '',
      order,
      is_active: true,
    };
    const res = await OrganizationService.createSourceRule(active, payload);
    if (res?.success) {
      setRules((rs) => [...rs, res.data]);
      // Bump count on the sidebar
      setSources((ss) => ss.map((s) => s.id === active ? { ...s, rules_count: s.rules_count + 1 } : s));
    } else toast.error(res?.message || 'Failed');
  };

  const updateRule = async (id: number, patch: Partial<FollowUpRule>) => {
    // Optimistic
    setRules((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } as FollowUpRule : r)));
    try {
      const res = await OrganizationService.updateRule(id, patch);
      if (!res?.success) {
        toast.error(res?.message || 'Save failed');
        if (active != null) loadRules(active);
      }
    } catch {
      toast.error('Save failed');
      if (active != null) loadRules(active);
    }
  };

  const removeRule = async (id: number) => {
    if (!confirm('Delete this rule?')) return;
    const res = await OrganizationService.deleteRule(id);
    if (res?.success) {
      setRules((rs) => rs.filter((r) => r.id !== id));
      if (active != null) {
        setSources((ss) => ss.map((s) => s.id === active ? { ...s, rules_count: Math.max(0, s.rules_count - 1) } : s));
      }
      toast.success('Rule deleted');
    } else toast.error(res?.message || 'Failed');
  };

  if (loading) return <PageSkeleton kind="detail" />;

  const activeSrc = sources.find((s) => s.id === active);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Lead automation</h1>
        <p className="text-sm text-slate-400 mt-1">
          Design the follow-up flow that runs every time a lead arrives. Choose a source on
          the left, then add the steps that fire when a lead is created.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px,1fr] gap-6">
        {/* Sources rail */}
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-3 h-fit">
          <div className="px-2 mb-2 text-[10px] uppercase tracking-[0.12em] text-slate-500 font-semibold">
            Sources
          </div>
          <div className="space-y-1">
            {sources.map((s) => {
              const isActive = s.id === active;
              return (
                <button
                  key={s.id}
                  onClick={() => setActive(s.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                    isActive ? 'bg-emerald-500/10 text-white border border-emerald-500/20' : 'text-slate-300 hover:bg-white/[0.04] border border-transparent'
                  }`}
                >
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="flex-1 truncate">{s.name}</span>
                  <span className="text-[10px] text-slate-500 px-1.5 py-0.5 rounded bg-white/5">
                    {s.rules_count}
                  </span>
                </button>
              );
            })}
            {sources.length === 0 && (
              <div className="text-xs text-slate-500 px-2 py-3">No sources yet.</div>
            )}
          </div>
        </div>

        {/* Flow editor */}
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 min-h-[300px]">
          {activeSrc ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${activeSrc.color}26`, color: activeSrc.color }}
                  >
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{activeSrc.name} flow</div>
                    <div className="text-[11px] text-slate-500">
                      {rules.length} {rules.length === 1 ? 'step' : 'steps'} run when a lead arrives from this source
                    </div>
                  </div>
                </div>
                <button
                  onClick={addRule}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-2"
                >
                  <Plus className="w-3.5 h-3.5" /> Add step
                </button>
              </div>

              {loadingRules ? (
                <PageSpinner />
              ) : rules.length === 0 ? (
                <div className="text-center py-12 text-sm text-slate-500">
                  No steps yet. Add one to start automating follow-ups.
                </div>
              ) : (
                <div className="relative pl-6">
                  {/* Timeline line */}
                  <div className="absolute left-2 top-2 bottom-2 w-px bg-white/10" />
                  <ol className="space-y-3">
                    {rules.map((rule, idx) => (
                      <RuleRow
                        key={rule.id}
                        rule={rule}
                        index={idx}
                        stages={stages}
                        onChange={(patch) => updateRule(rule.id, patch)}
                        onDelete={() => removeRule(rule.id)}
                      />
                    ))}
                  </ol>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-slate-500 text-sm">
              Pick a source to configure its flow.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RuleRow({
  rule, index, stages, onChange, onDelete,
}: {
  rule: FollowUpRule;
  index: number;
  stages: LeadStage[];
  onChange: (patch: Partial<FollowUpRule>) => void;
  onDelete: () => void;
}) {
  const meta = KIND_META[rule.kind] ?? KIND_META.task;
  const KindIcon = meta.Icon;

  return (
    <li className="relative">
      {/* Timeline dot */}
      <div
        className="absolute -left-[18px] top-3 w-3 h-3 rounded-full border-2 border-[#030712]"
        style={{ backgroundColor: meta.color }}
      />
      <div className="rounded-xl border border-white/5 bg-[#0c1424] p-4">
        <div className="flex items-start gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${meta.color}26`, color: meta.color }}
          >
            <KindIcon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] uppercase tracking-wider text-slate-500">Step {index + 1}</span>
              <select
                value={rule.kind}
                onChange={(e) => onChange({ kind: e.target.value as FollowUpRule['kind'] })}
                className="px-2 py-1 rounded bg-[#080e1c] border border-white/10 text-xs text-white"
              >
                {Object.entries(KIND_META).map(([k, m]) => (
                  <option value={k} key={k}>{m.label}</option>
                ))}
              </select>
              <span className="text-[11px] text-slate-500 inline-flex items-center gap-1">
                <Clock className="w-3 h-3" /> after
              </span>
              <input
                type="number"
                min={0}
                value={rule.delay_hours}
                onChange={(e) => onChange({ delay_hours: Math.max(0, Number(e.target.value)) })}
                className="w-20 px-2 py-1 rounded bg-[#080e1c] border border-white/10 text-xs text-white text-right"
              />
              <span className="text-[11px] text-slate-500">hours</span>
              <label className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rule.is_active}
                  onChange={(e) => onChange({ is_active: e.target.checked })}
                  className="accent-emerald-500"
                />
                Active
              </label>
              <button onClick={onDelete} className="p-1 rounded text-slate-500 hover:text-red-300 hover:bg-red-500/10">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <input
              type="text"
              value={rule.title}
              placeholder={`e.g. ${meta.label} the new lead`}
              onChange={(e) => onChange({ title: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-[#080e1c] border border-white/10 text-sm text-white placeholder:text-slate-600"
            />

            {rule.kind === 'move_stage' && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>Move lead to:</span>
                <select
                  value={rule.target_stage ?? ''}
                  onChange={(e) => onChange({ target_stage: e.target.value ? Number(e.target.value) : null })}
                  className="px-2 py-1 rounded bg-[#080e1c] border border-white/10 text-xs text-white"
                >
                  <option value="">— pick stage —</option>
                  {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}

            {rule.note !== undefined && (
              <textarea
                rows={1}
                value={rule.note}
                placeholder="Internal note (optional)"
                onChange={(e) => onChange({ note: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[#080e1c] border border-white/5 text-[12px] text-slate-300 placeholder:text-slate-600"
              />
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
