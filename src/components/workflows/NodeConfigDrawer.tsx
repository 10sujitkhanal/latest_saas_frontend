'use client';

/**
 * Node configuration drawer — three tabs (Setup / Variables / Test Step).
 *
 * SETUP   — typed fields rendered from NODE_SCHEMAS. Each field can opt
 *           into variable insertion (supportsVariables). Unknown nodes
 *           fall back to the legacy JSON editor.
 * VARIABLES — walks the graph upstream from the selected node and lists
 *             every variable produced by an ancestor. Click a variable
 *             to copy `{{var.path}}` to the clipboard; or focus a field
 *             first to insert it directly.
 * TEST STEP — placeholder for v1; live test-run support coming in the
 *             next iteration.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Settings, X, Trash2, Database, PlayCircle, Sliders, Copy, Info, AlertTriangle, ExternalLink, Plug } from 'lucide-react';
import { toast } from 'sonner';
import type { Node, Edge } from '@xyflow/react';
import { OrganizationService } from '@/services/organization.service';
import { schemaFor, type NodeFieldSpec, type NodeOutput } from './nodeSchemas';

export interface ChannelLite {
  id: number;
  kind: string;
  name: string;
  is_connected: boolean;
  is_active: boolean;
}

export interface NodeData extends Record<string, unknown> {
  label: string;
  code: string;
  category: string;
  params: Record<string, unknown>;
}

type Tab = 'setup' | 'variables' | 'test';

export function NodeConfigDrawer({
  node, allNodes, allEdges, channels, wsId,
  onClose, onUpdate, onDelete,
}: {
  node: Node<NodeData>;
  allNodes: Node<NodeData>[];
  allEdges: Edge[];
  channels: ChannelLite[];
  wsId: string;
  onClose: () => void;
  onUpdate: (patch: Partial<NodeData>) => void;
  onDelete: () => void;
}) {
  const [tab, setTab] = useState<Tab>('setup');
  const schema = schemaFor(node.data.code);
  const accent = schema?.accent || '#10b981';

  // Refs to focused field — variables tab inserts at the active input.
  const focusedFieldRef = useRef<{ key: string; setValue: (v: string) => void } | null>(null);

  const upstreamOutputs = useMemo(
    () => collectUpstreamOutputs(node.id, allNodes, allEdges),
    [node.id, allNodes, allEdges]
  );

  const params = (node.data.params || {}) as Record<string, unknown>;

  const setParam = (key: string, value: unknown) => {
    onUpdate({ params: { ...params, [key]: value } });
  };

  // Allow the variables tab to insert into the currently-focused field.
  const insertVariable = (variableKey: string) => {
    if (focusedFieldRef.current) {
      const ref = focusedFieldRef.current;
      const current = String(params[ref.key] ?? '');
      ref.setValue(current + `{{${variableKey}}}`);
      setTab('setup');
      toast.success(`Inserted {{${variableKey}}}`);
    } else {
      navigator.clipboard.writeText(`{{${variableKey}}}`).then(
        () => toast.success(`Copied {{${variableKey}}} — paste into a field`),
        () => toast.error('Could not copy'),
      );
    }
  };

  return (
    <aside className="w-[360px] shrink-0 border-l border-white/5 bg-[#070d1b] flex flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-white/5">
        <div className="flex items-start gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${accent}22`, color: accent, border: `1px solid ${accent}44` }}
          >
            <Settings className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Configure node</div>
            <div className="text-lg font-bold text-white truncate uppercase tracking-wide">
              {node.data.label}
            </div>
            {schema?.category_label && (
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-0.5">
                {schema.category_label}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onDelete}
              title="Delete node"
              className="p-1.5 rounded text-slate-400 hover:text-red-300 hover:bg-red-500/[0.08]"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-white/[0.04] text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {schema?.description && (
          <p className="mt-2 text-[11px] text-slate-400 leading-relaxed">{schema.description}</p>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex items-stretch border-b border-white/5">
        <TabButton active={tab === 'setup'} accent={accent} onClick={() => setTab('setup')} icon={<Sliders className="w-3.5 h-3.5" />}>
          Setup
        </TabButton>
        <TabButton active={tab === 'variables'} accent={accent} onClick={() => setTab('variables')} icon={<Database className="w-3.5 h-3.5" />}>
          Variables{upstreamOutputs.length > 0 && <span className="ml-1 opacity-70">({upstreamOutputs.length})</span>}
        </TabButton>
        <TabButton active={tab === 'test'} accent={accent} onClick={() => setTab('test')} icon={<PlayCircle className="w-3.5 h-3.5" />}>
          Test step
        </TabButton>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 text-xs">
        {tab === 'setup' && (
          schema ? (
            <SetupForm
              schema={schema}
              params={params}
              label={node.data.label}
              channels={channels}
              wsId={wsId}
              onLabelChange={(v) => onUpdate({ label: v })}
              onParamChange={setParam}
              onFieldFocus={(key, setValue) => { focusedFieldRef.current = { key, setValue }; }}
              onFieldBlur={() => { /* keep focusedFieldRef so variables tab can still insert */ }}
            />
          ) : (
            <FallbackJSON params={params} onUpdate={onUpdate} />
          )
        )}
        {tab === 'variables' && (
          <VariablesTab
            outputs={upstreamOutputs}
            onPick={insertVariable}
          />
        )}
        {tab === 'test' && (
          <TestStepTab node={node} schema={schema} />
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-white/5">
        <button
          onClick={onClose}
          className="w-full px-3 py-2 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-[11px] font-bold uppercase tracking-wider text-slate-300"
        >
          Close panel
        </button>
      </div>
    </aside>
  );
}

// ───────────────────────────────────────────────────────────────────────
//  Tab button
// ───────────────────────────────────────────────────────────────────────

function TabButton({
  active, onClick, icon, children, accent,
}: {
  active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode; accent: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-3 py-2.5 text-[10px] uppercase tracking-wider font-bold inline-flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
        active ? 'text-white' : 'border-transparent text-slate-500 hover:text-white hover:bg-white/[0.02]'
      }`}
      style={active ? { borderColor: accent, color: accent } : undefined}
    >
      {icon}
      {children}
    </button>
  );
}

// ───────────────────────────────────────────────────────────────────────
//  SETUP — typed form renderer
// ───────────────────────────────────────────────────────────────────────

function SetupForm({
  schema, params, label, channels, wsId,
  onLabelChange, onParamChange, onFieldFocus, onFieldBlur,
}: {
  schema: ReturnType<typeof schemaFor> & object;
  params: Record<string, unknown>;
  label: string;
  channels: ChannelLite[];
  wsId: string;
  onLabelChange: (v: string) => void;
  onParamChange: (key: string, value: unknown) => void;
  onFieldFocus: (key: string, setValue: (v: string) => void) => void;
  onFieldBlur: () => void;
}) {
  return (
    <div className="space-y-4">
      {schema!.fields.map((f) => (
        <FieldRenderer
          key={f.key}
          field={f}
          value={f.key === 'label' ? label : (params[f.key] ?? f.default ?? '')}
          channels={channels}
          wsId={wsId}
          onChange={(v) => f.key === 'label' ? onLabelChange(String(v ?? '')) : onParamChange(f.key, v)}
          onFocus={(setValue) => onFieldFocus(f.key, setValue)}
          onBlur={onFieldBlur}
        />
      ))}
    </div>
  );
}

function FieldRenderer({
  field, value, channels, wsId, onChange, onFocus, onBlur,
}: {
  field: NodeFieldSpec;
  value: unknown;
  channels: ChannelLite[];
  wsId: string;
  onChange: (v: unknown) => void;
  onFocus: (setValue: (v: string) => void) => void;
  onBlur: () => void;
}) {
  const baseInput =
    'w-full rounded-lg bg-[#080e1c] border border-white/10 px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50';

  const setValue = (v: string | number) => onChange(v);

  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1.5 flex items-center gap-1">
        {field.label}
        {field.required && <span className="text-red-400">*</span>}
        {field.supportsVariables && (
          <span title="Supports {{variables}} from upstream nodes"
                className="text-[8px] px-1 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 ml-1">
            VAR
          </span>
        )}
      </div>

      {field.type === 'text' && (
        <input
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => onFocus((v) => setValue(v))}
          onBlur={onBlur}
          placeholder={field.placeholder}
          className={baseInput}
        />
      )}

      {field.type === 'multiline' && (
        <textarea
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => onFocus((v) => setValue(v))}
          onBlur={onBlur}
          placeholder={field.placeholder}
          rows={4}
          className={`${baseInput} resize-none leading-relaxed`}
        />
      )}

      {field.type === 'number' && (
        <input
          type="number"
          value={Number(value ?? 0)}
          onChange={(e) => onChange(Number(e.target.value))}
          placeholder={field.placeholder}
          className={baseInput}
        />
      )}

      {field.type === 'switch' && (
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            className="sr-only peer"
          />
          <span className="w-8 h-4 rounded-full bg-slate-700 peer-checked:bg-emerald-500 relative transition-colors">
            <span className="absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform peer-checked:translate-x-4" />
          </span>
          <span className="text-xs text-slate-300">{value ? 'On' : 'Off'}</span>
        </label>
      )}

      {field.type === 'select' && (
        <Select
          value={String(value ?? '')}
          onChange={(v) => onChange(v)}
          options={field.options || []}
          placeholder={field.placeholder || 'Choose…'}
        />
      )}

      {field.type === 'channel_kind' && (
        <Select
          value={String(value ?? '')}
          onChange={(v) => onChange(v)}
          options={[
            { value: '',          label: 'Any channel' },
            { value: 'instagram', label: 'Instagram' },
            { value: 'facebook',  label: 'Facebook / Messenger' },
            { value: 'whatsapp',  label: 'WhatsApp' },
            { value: 'linkedin',  label: 'LinkedIn' },
            { value: 'tiktok',    label: 'TikTok' },
            { value: 'email',     label: 'Email' },
            { value: 'sms',       label: 'SMS' },
            { value: 'webchat',   label: 'Website chat' },
          ]}
        />
      )}

      {field.type === 'ai_provider' && (
        <Select
          value={String(value ?? '')}
          onChange={(v) => onChange(v)}
          options={[
            { value: '',          label: 'Auto-pick connected provider' },
            { value: 'openai',    label: 'OpenAI (ChatGPT / GPT-4)' },
            { value: 'anthropic', label: 'Anthropic (Claude)' },
            { value: 'gemini',    label: 'Google Gemini' },
            { value: 'mistral',   label: 'Mistral' },
            { value: 'groq',      label: 'Groq' },
            { value: 'cohere',    label: 'Cohere' },
          ]}
        />
      )}

      {field.type === 'stage_slug' && (
        <input
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. qualified"
          className={baseInput}
        />
      )}

      {field.type === 'tag' && (
        <input
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value.toLowerCase())}
          placeholder={field.placeholder || 'hot-lead'}
          className={baseInput}
        />
      )}

      {field.type === 'duration_hours' && (
        <DurationPicker hours={Number(value ?? 0)} onChange={(n) => onChange(n)} />
      )}

      {field.type === 'credential_picker' && (
        <CredentialPicker
          value={value as number | string | null}
          onChange={onChange}
          channels={channels}
          acceptedKinds={field.credential_kinds || []}
          credentialLabel={field.credential_label || 'credential'}
          wsId={wsId}
        />
      )}

      {field.help && (
        <div className="text-[10px] text-slate-500 mt-1 italic">{field.help}</div>
      )}
    </div>
  );
}

/** Renders a real-credential picker that filters the workspace's
 *  connected Channel rows by the field's acceptedKinds. When none of
 *  the accepted kinds are connected, shows a red callout with a deep
 *  link to the credentials page — the parent flow blocks Save when
 *  this is empty + required. */
function CredentialPicker({
  value, onChange, channels, acceptedKinds, credentialLabel, wsId,
}: {
  value: number | string | null;
  onChange: (v: unknown) => void;
  channels: ChannelLite[];
  acceptedKinds: string[];
  credentialLabel: string;
  wsId: string;
}) {
  const eligible = useMemo(
    () => channels.filter((c) =>
      c.is_active && c.is_connected && acceptedKinds.includes(c.kind),
    ),
    [channels, acceptedKinds],
  );

  if (eligible.length === 0) {
    // Filter on inactive matches too — useful to nudge users that they
    // have something half-set-up rather than nothing at all.
    const inactiveMatches = channels.filter((c) => acceptedKinds.includes(c.kind));
    return (
      <div className="rounded-lg border border-rose-500/30 bg-rose-500/[0.06] p-3">
        <div className="flex items-start gap-2 mb-2">
          <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-[11.5px] font-bold text-white">
              No {credentialLabel} connected
            </div>
            <p className="text-[10.5px] text-slate-300 mt-0.5">
              {inactiveMatches.length > 0
                ? `You have a ${inactiveMatches[0].kind} credential but it isn't fully connected. Finish setup before using this node.`
                : `Add one of: ${acceptedKinds.slice(0, 6).join(', ')}${acceptedKinds.length > 6 ? '…' : ''}. Save is disabled until a credential is picked.`}
            </p>
          </div>
        </div>
        <Link
          href={`/w/${wsId}/leads/credentials`}
          target="_blank"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold uppercase tracking-wider"
        >
          <Plug className="w-3.5 h-3.5" />
          Add credential
          <ExternalLink className="w-3 h-3 opacity-70" />
        </Link>
      </div>
    );
  }

  const current = Number(value);
  const found = eligible.find((c) => c.id === current);

  return (
    <div>
      <select
        value={current || ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        className="w-full rounded-lg bg-[#080e1c] border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50"
      >
        <option value="" className="bg-[#0a1020]">Choose a credential…</option>
        {eligible.map((c) => (
          <option key={c.id} value={c.id} className="bg-[#0a1020]">
            {c.name} · {c.kind}
          </option>
        ))}
      </select>
      {found ? (
        <div className="mt-1.5 inline-flex items-center gap-1.5 text-[10px] text-emerald-300">
          ✓ Connected to <strong>{found.name}</strong>
        </div>
      ) : (
        <div className="mt-1.5 inline-flex items-center gap-1.5 text-[10px] text-amber-300">
          <AlertTriangle className="w-3 h-3" />
          Pick a credential — save is disabled until you do.
        </div>
      )}
      <Link
        href={`/w/${wsId}/leads/credentials`}
        target="_blank"
        className="ml-2 inline-flex items-center gap-1 text-[10px] text-cyan-300 hover:text-cyan-200"
      >
        <ExternalLink className="w-3 h-3" />
        Manage
      </Link>
    </div>
  );
}

function Select({
  value, onChange, options, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg bg-[#080e1c] border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50"
    >
      {placeholder && <option value="" className="bg-[#0a1020]">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-[#0a1020]">{o.label}</option>
      ))}
    </select>
  );
}

function DurationPicker({ hours, onChange }: { hours: number; onChange: (h: number) => void }) {
  // Decompose into days + hours + minutes for nicer entry.
  const days = Math.floor(hours / 24);
  const remainingH = hours % 24;
  const minutes = Math.round((hours - Math.floor(hours)) * 60);
  return (
    <div className="grid grid-cols-3 gap-2">
      <div>
        <input
          type="number" min={0} value={days}
          onChange={(e) => onChange(Number(e.target.value) * 24 + remainingH + minutes / 60)}
          className="w-full rounded-lg bg-[#080e1c] border border-white/10 px-2 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/50"
        />
        <div className="text-[9px] uppercase text-slate-500 mt-0.5 text-center">days</div>
      </div>
      <div>
        <input
          type="number" min={0} max={23} value={remainingH}
          onChange={(e) => onChange(days * 24 + Number(e.target.value) + minutes / 60)}
          className="w-full rounded-lg bg-[#080e1c] border border-white/10 px-2 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/50"
        />
        <div className="text-[9px] uppercase text-slate-500 mt-0.5 text-center">hours</div>
      </div>
      <div>
        <input
          type="number" min={0} max={59} value={minutes}
          onChange={(e) => onChange(days * 24 + remainingH + Number(e.target.value) / 60)}
          className="w-full rounded-lg bg-[#080e1c] border border-white/10 px-2 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/50"
        />
        <div className="text-[9px] uppercase text-slate-500 mt-0.5 text-center">min</div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
//  VARIABLES tab
// ───────────────────────────────────────────────────────────────────────

interface VariableEntry {
  nodeId: string;
  nodeLabel: string;
  nodeCode: string;
  accent: string;
  outputs: NodeOutput[];
}

function collectUpstreamOutputs(
  nodeId: string,
  allNodes: Node<NodeData>[],
  allEdges: Edge[],
): VariableEntry[] {
  // Walk edges backward from this node via BFS.
  const nodeMap = new Map(allNodes.map((n) => [n.id, n]));
  const incoming = new Map<string, string[]>();
  for (const e of allEdges) {
    if (!incoming.has(e.target)) incoming.set(e.target, []);
    incoming.get(e.target)!.push(e.source);
  }

  const visited = new Set<string>();
  const queue: string[] = [nodeId];
  const orderedAncestors: string[] = [];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const parent of incoming.get(cur) || []) {
      if (visited.has(parent)) continue;
      visited.add(parent);
      orderedAncestors.push(parent);
      queue.push(parent);
    }
  }

  const entries: VariableEntry[] = [];
  for (const ancestorId of orderedAncestors) {
    const node = nodeMap.get(ancestorId);
    if (!node) continue;
    const schema = schemaFor(node.data.code);
    if (!schema?.outputs?.length) continue;
    entries.push({
      nodeId: node.id,
      nodeLabel: node.data.label,
      nodeCode: node.data.code,
      accent: schema.accent,
      outputs: schema.outputs,
    });
  }
  return entries;
}

function VariablesTab({
  outputs, onPick,
}: { outputs: VariableEntry[]; onPick: (key: string) => void }) {
  if (outputs.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500 text-xs">
        <Info className="w-6 h-6 mx-auto mb-2 text-slate-600" />
        <div className="font-semibold mb-1 text-slate-300">No variables yet</div>
        <p className="leading-relaxed">
          Connect this node to an upstream node (trigger, AI reply, etc.) to access its outputs here.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <p className="text-[11px] text-slate-400 leading-relaxed">
        Click a variable to insert it into the focused field (or copy it). Use them like
        <code className="mx-1 px-1 rounded bg-black/40 text-cyan-300">{`{{lead.email}}`}</code>
        inside any text input.
      </p>
      {outputs.map((entry) => (
        <div key={entry.nodeId} className="rounded-lg border border-white/10 bg-white/[0.02]">
          <div
            className="px-3 py-2 border-b border-white/5 flex items-center gap-2"
            style={{ backgroundColor: `${entry.accent}10` }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.accent }} />
            <div className="text-[11px] font-bold text-white uppercase tracking-wide truncate flex-1">
              {entry.nodeLabel}
            </div>
            <div className="text-[9px] uppercase tracking-wider text-slate-500">{entry.nodeCode}</div>
          </div>
          <div className="p-2 space-y-1">
            {entry.outputs.map((o) => (
              <button
                key={o.key}
                onClick={() => onPick(o.key)}
                className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/[0.04] group"
              >
                <Copy className="w-3 h-3 text-slate-500 group-hover:text-cyan-300 shrink-0" />
                <code className="text-[10.5px] text-cyan-300 font-mono truncate">{`{{${o.key}}}`}</code>
                <span className="text-[10px] text-slate-500 truncate ml-auto">{o.label}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
//  TEST STEP tab — placeholder for v1
// ───────────────────────────────────────────────────────────────────────

function TestStepTab({
  node, schema,
}: { node: Node<NodeData>; schema: ReturnType<typeof schemaFor> }) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
        <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-2">
          Current configuration
        </div>
        <pre className="text-[11px] font-mono text-slate-300 leading-relaxed whitespace-pre-wrap break-all">
{JSON.stringify({
  type: node.type,
  code: node.data.code,
  label: node.data.label,
  params: node.data.params,
}, null, 2)}
        </pre>
      </div>
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.05] p-3 text-[11px] text-amber-100">
        <div className="font-bold mb-1">Live test runs coming soon</div>
        <p className="text-slate-300">
          The next iteration adds a <strong>Run this step</strong> button that fires just this
          node against a sample lead and shows the resulting payload — so you can verify
          inputs / outputs without running the whole flow.
        </p>
        {schema?.outputs?.length ? (
          <div className="mt-2">
            <div className="text-[9px] uppercase tracking-wider font-bold text-slate-400 mb-1">
              This node would produce
            </div>
            <ul className="ml-3 list-disc space-y-0.5 marker:text-slate-600">
              {schema.outputs.map((o) => (
                <li key={o.key}>
                  <code className="text-cyan-300">{`{{${o.key}}}`}</code>
                  <span className="text-slate-400"> — {o.label}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
//  Fallback raw-JSON editor (legacy nodes without a schema)
// ───────────────────────────────────────────────────────────────────────

function FallbackJSON({
  params, onUpdate,
}: { params: Record<string, unknown>; onUpdate: (patch: Partial<NodeData>) => void }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1.5">
        Parameters (JSON)
      </div>
      <textarea
        value={JSON.stringify(params, null, 2)}
        onChange={(e) => {
          try {
            const next = JSON.parse(e.target.value);
            onUpdate({ params: next });
          } catch { /* ignore until JSON is valid */ }
        }}
        rows={10}
        className="w-full rounded-lg bg-[#080e1c] border border-white/10 px-3 py-2 text-[11px] text-white font-mono focus:outline-none focus:border-emerald-500/50 resize-none"
      />
      <div className="text-[10px] text-slate-500 mt-1 italic">
        No typed schema for this node yet — edit params directly.
      </div>
    </div>
  );
}
