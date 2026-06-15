'use client';

/**
 * n8n-style visual workflow builder.
 *
 * Layout:
 *   ┌────────────┬──────────────────────────────────┬──────────────┐
 *   │            │                                  │              │
 *   │  Add Node  │           React Flow             │  Node config │
 *   │  sidebar   │           canvas                 │  drawer      │
 *   │  (drill-in)│                                  │  (on select) │
 *   │            │                                  │              │
 *   └────────────┴──────────────────────────────────┴──────────────┘
 *
 * Three ways to build a flow:
 *   1. Generate from prompt — paste plain English, hit Generate, the parser
 *      returns nodes+edges, dagre auto-lays them out on the canvas.
 *   2. Drag nodes from the Add Node sidebar onto the canvas, then connect
 *      output handles to input handles by dragging.
 *   3. Click any node to open the right drawer and edit its params inline.
 *
 * Validation: every flow needs exactly one starting (trigger) node. The
 * Save button is disabled with a clear message until that's satisfied.
 *
 * Persistence: save sends the full graph + the lifted `{trigger, actions}`
 * structure so the headless executor can run it without ever touching
 * React Flow.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ReactFlow, ReactFlowProvider, MiniMap, Controls, Background, BackgroundVariant,
  Handle, Position, useNodesState, useEdgesState, addEdge,
  type Node, type Edge, type Connection, type NodeProps, type OnNodesDelete,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { toast } from 'sonner';
import {
  Sparkles, Wand2, Zap, GitBranch, Clock, StopCircle, Mail, MessageCircle,
  Calendar as CalendarIcon, CheckSquare, ArrowRight, Tag, User as UserIcon,
  TrendingUp, Bell, Database, Brain, Play, AlertTriangle, X, Save,
  ChevronDown, ChevronLeft, ArrowLeft, Trash2, Settings, PlayCircle,
  ClipboardList, Webhook, Plug, Search,
} from 'lucide-react';
import { OrganizationService } from '@/services/organization.service';
import { NodeConfigDrawer, type ChannelLite } from './NodeConfigDrawer';
import { schemaFor } from './nodeSchemas';

type LucideIcon = React.ComponentType<{ className?: string; style?: React.CSSProperties }>;

interface NodeData extends Record<string, unknown> {
  label: string;
  code: string;
  category: string;
  params: Record<string, unknown>;
}

interface PaletteNode {
  code: string;
  icon?: string;
  label: string;
  help?: string;
  example: string;
  starting?: boolean;
}
interface PaletteProvider {
  code: string; label: string; subtitle?: string; icon: string; accent: string;
  nodes: PaletteNode[];
}
interface PaletteCategory {
  code: string; label: string; icon: string; accent: string; description?: string;
  nodes?: PaletteNode[];
  providers?: PaletteProvider[];
}
interface Palette {
  triggers: PaletteNode[];
  conditions: PaletteNode[];
  actions: PaletteNode[];
  categories: PaletteCategory[];
}

const ICON: Record<string, LucideIcon> = {
  sparkles: Sparkles, arrow: ArrowRight, trending: TrendingUp, alert: AlertTriangle,
  tag: Tag, message: MessageCircle, calendar: CalendarIcon, play: Play,
  mail: Mail, user: UserIcon, bell: Bell, task: CheckSquare,
  link: ArrowRight, clock: Clock, stop: StopCircle, branch: GitBranch,
  zap: Zap, 'git-branch': GitBranch, brain: Brain, database: Database,
  plug: Plug, users: UserIcon, split: GitBranch, wand: Wand2,
  clipboard: ClipboardList, webhook: Webhook,
};

// Category-derived colors for nodes on the canvas.
const CATEGORY_ACCENT: Record<string, string> = {
  triggers: '#10b981',
  logic: '#3b82f6',
  timer: '#f59e0b',
  ai_tools: '#10b981',
  knowledge: '#06b6d4',
  apps: '#8b5cf6',
  crm: '#ec4899',
};

// ──────────────────────────────────────────────────────────────────────────
//                              CUSTOM NODE TYPES
// ──────────────────────────────────────────────────────────────────────────

function NodeShell({
  data, badgeLabel, badgeColor, accent, IconComp,
  inHandle = true, outHandle = true, extraHandles,
}: {
  data: NodeData;
  badgeLabel: string;
  badgeColor: string;
  accent: string;
  IconComp: LucideIcon;
  inHandle?: boolean;
  outHandle?: boolean;
  extraHandles?: { id: string; label: string; color: string; left: string }[];
}) {
  return (
    <div
      className="rounded-lg border bg-[#0a1020] shadow-lg min-w-[220px] max-w-[260px]"
      style={{ borderColor: `${accent}66` }}
    >
      {inHandle && (
        <Handle type="target" position={Position.Top} id="in" style={{ background: '#64748b' }} />
      )}
      <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider"
           style={{ backgroundColor: `${badgeColor}22`, color: badgeColor, borderBottom: `1px solid ${accent}44` }}>
        {badgeLabel}
      </div>
      <div className="px-3 py-2.5 flex items-center gap-2">
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${accent}22`, color: accent }}
        >
          <IconComp className="w-3.5 h-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-bold text-white uppercase tracking-wide truncate">{data.label}</div>
          <div className="text-[10px] text-slate-500 truncate">{data.code}</div>
        </div>
      </div>
      {extraHandles && (
        <div className="px-3 pb-2 flex items-center justify-around text-[9px] uppercase tracking-wider">
          {extraHandles.map((h) => (
            <span key={h.id} style={{ color: h.color }}>{h.label}</span>
          ))}
        </div>
      )}
      {outHandle && !extraHandles && (
        <Handle type="source" position={Position.Bottom} id="out" style={{ background: '#64748b' }} />
      )}
      {extraHandles?.map((h) => (
        <Handle
          key={h.id}
          type="source"
          position={Position.Bottom}
          id={h.id}
          style={{ background: h.color, left: h.left }}
        />
      ))}
    </div>
  );
}

function TriggerNode({ data }: NodeProps<Node<NodeData>>) {
  return (
    <NodeShell
      data={data}
      badgeLabel="TRIGGER"
      badgeColor="#10b981"
      accent="#10b981"
      IconComp={Zap}
      inHandle={false}
    />
  );
}

function ActionNode({ data }: NodeProps<Node<NodeData>>) {
  const accent = CATEGORY_ACCENT[data.category] || '#64748b';
  const label = (data.category || 'action').toUpperCase().replace('_', ' ');
  return (
    <NodeShell
      data={data}
      badgeLabel={label}
      badgeColor={accent}
      accent={accent}
      IconComp={Sparkles}
    />
  );
}

function ConditionNode({ data }: NodeProps<Node<NodeData>>) {
  return (
    <NodeShell
      data={data}
      badgeLabel="LOGIC"
      badgeColor="#3b82f6"
      accent="#3b82f6"
      IconComp={GitBranch}
      extraHandles={[
        { id: 'true', label: 'TRUE', color: '#10b981', left: '25%' },
        { id: 'false', label: 'FALSE', color: '#ef4444', left: '75%' },
      ]}
    />
  );
}

function WaitNode({ data }: NodeProps<Node<NodeData>>) {
  return (
    <NodeShell data={data} badgeLabel="TIMER" badgeColor="#f59e0b" accent="#f59e0b" IconComp={Clock} />
  );
}

function StopNode({ data }: NodeProps<Node<NodeData>>) {
  return (
    <NodeShell data={data} badgeLabel="STOP" badgeColor="#ef4444" accent="#ef4444" IconComp={StopCircle} outHandle={false} />
  );
}

const nodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  condition: ConditionNode,
  wait: WaitNode,
  stop: StopNode,
};

// ──────────────────────────────────────────────────────────────────────────
//                              DAGRE AUTO-LAYOUT
// ──────────────────────────────────────────────────────────────────────────

/** BFS from a starting node following edge direction. Returns every
 *  reachable node in visit order, excluding the start itself. Used by
 *  the save pipeline to lift the canvas into an ordered action list. */
function walkForward<TData extends Record<string, unknown>>(
  nodes: Node<TData>[], edges: Edge[], startId: string | undefined,
): Node<TData>[] {
  if (!startId) {
    // Disconnected start — fall back to spatial order so the user at
    // least sees their nodes in some reasonable sequence.
    return [...nodes].sort((a, b) => (a.position.y - b.position.y) || (a.position.x - b.position.x));
  }
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const out: { source: string }[] = edges.map((e) => ({ ...e, source: e.source }));
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source)!.push(e.target);
  }
  const visited = new Set<string>([startId]);
  const result: Node<TData>[] = [];
  const queue: string[] = [startId];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const next of adj.get(cur) || []) {
      if (visited.has(next)) continue;
      visited.add(next);
      const node = nodeById.get(next);
      if (node) result.push(node);
      queue.push(next);
    }
  }
  // Catch any orphan nodes (user added but didn't connect) — append in
  // spatial order so they aren't silently dropped from save.
  const orphans = nodes
    .filter((n) => !visited.has(n.id) && n.type !== 'trigger')
    .sort((a, b) => (a.position.y - b.position.y) || (a.position.x - b.position.x));
  void out;
  return [...result, ...orphans];
}

function autoLayout<TData extends Record<string, unknown> = Record<string, unknown>>(
  nodes: Node<TData>[], edges: Edge[], direction: 'TB' | 'LR' = 'TB',
): Node<TData>[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 50, ranksep: 80, marginx: 20, marginy: 20 });
  nodes.forEach((n) => g.setNode(n.id, { width: 240, height: 90 }));
  edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);
  return nodes.map((n) => {
    const pos = g.node(n.id);
    return pos
      ? { ...n, position: { x: pos.x - 120, y: pos.y - 45 } }
      : n;
  });
}

// ──────────────────────────────────────────────────────────────────────────
//                              MAIN COMPONENT
// ──────────────────────────────────────────────────────────────────────────

export interface FlowBuilderProps {
  workflowId?: number;
  wsId: string;
  /** Pre-loaded workflow when editing. */
  initial?: {
    id: number;
    name: string;
    prompt: string;
    trigger: string;
    trigger_config: Record<string, unknown>;
    conditions: { field: string; op: string; value: unknown }[];
    actions: Record<string, unknown>[];
    graph?: { nodes: Node<NodeData>[]; edges: Edge[] };
    is_active: boolean;
  };
}

export function FlowBuilder({ workflowId, wsId, initial }: FlowBuilderProps) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name || 'Untitled workflow');
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  // Older saves stored `deletable: false` / `draggable: false` on the
  // trigger node — clear that on load so users can move and remove
  // their starting node freely.
  const _normalize = (n: Node<NodeData>): Node<NodeData> => ({
    ...n,
    deletable: true,
    draggable: true,
  });
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<NodeData>>(
    ((initial?.graph?.nodes as Node<NodeData>[]) || []).map(_normalize)
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial?.graph?.edges || []);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [palette, setPalette] = useState<Palette | null>(null);
  const [channels, setChannels] = useState<ChannelLite[]>([]);
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [saving, setSaving] = useState(false);
  // Keep the structured fields from the latest parse so we don't lose
  // them when the user manually edits the canvas (the executor reads
  // these — the canvas is for humans).
  const parsedRef = useRef<{
    trigger: string;
    trigger_config: Record<string, unknown>;
    conditions: { field: string; op: string; value: unknown }[];
    actions: Record<string, unknown>[];
    prompt: string;
  }>({
    trigger: initial?.trigger || 'manual',
    trigger_config: initial?.trigger_config || {},
    conditions: initial?.conditions || [],
    actions: initial?.actions || [],
    prompt: initial?.prompt || '',
  });

  useEffect(() => {
    OrganizationService.workflowPalette().then((r) => {
      if (r?.success) setPalette(r.data as Palette);
    });
    OrganizationService.listChannels().then((r) => {
      if (r?.success) setChannels(r.data as ChannelLite[]);
    }).catch(() => {});
  }, []);

  // Re-fetch channels whenever the drawer closes — covers the case
  // where the user opened the credentials page in a new tab, added a
  // new credential, and came back to find it.
  const refreshChannels = useCallback(() => {
    OrganizationService.listChannels().then((r) => {
      if (r?.success) setChannels(r.data as ChannelLite[]);
    }).catch(() => {});
  }, []);

  const onConnect = useCallback((conn: Connection) => {
    setEdges((eds) => addEdge({ ...conn, markerEnd: { type: MarkerType.ArrowClosed } }, eds));
  }, [setEdges]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) || null,
    [nodes, selectedNodeId]
  );

  const onPaneClick = useCallback(() => setSelectedNodeId(null), []);

  const onDeleteNodes: OnNodesDelete = useCallback((deleted) => {
    const ids = new Set(deleted.map((d) => d.id));
    if (ids.has(selectedNodeId || '')) setSelectedNodeId(null);
  }, [selectedNodeId]);

  // -------------- Add Node from sidebar -------------------------------
  const insertNodeFromPalette = useCallback((node: PaletteNode, category: PaletteCategory, provider?: PaletteProvider) => {
    const id = `${node.code}-${Date.now()}`;
    const isTrigger = category.code === 'triggers';
    if (isTrigger && nodes.some((n) => n.type === 'trigger')) {
      toast.error('Only one trigger per workflow. Delete the existing trigger first.');
      return;
    }
    const reactType = isTrigger ? 'trigger'
      : node.code === 'wait' ? 'wait'
      : node.code === 'stop' ? 'stop'
      : node.code === 'if_condition' || node.code === 'switch_case' || node.code === 'else_branch'
        ? 'condition'
        : 'action';
    const lastNode = nodes[nodes.length - 1];
    const x = lastNode ? lastNode.position.x : 280;
    const y = lastNode ? lastNode.position.y + 130 : 40;
    const newNode: Node<NodeData> = {
      id,
      type: reactType,
      position: { x, y },
      // Every node — trigger included — is deletable + draggable. Deleting
      // a trigger just means the sidebar swaps back to the Triggers
      // picker so the user can pick a different one. Save validation
      // still blocks committing a flow without a trigger.
      deletable: true,
      draggable: true,
      data: {
        label: node.label,
        code: node.code,
        category: provider ? 'apps' : category.code,
        params: provider ? { provider: provider.code } : {},
      },
    };
    setNodes((ns) => [...ns, newNode]);
    // Auto-connect to the previous node when there's something to chain to.
    if (lastNode && !isTrigger) {
      setEdges((es) => addEdge(
        {
          source: lastNode.id,
          target: id,
          sourceHandle: null,
          targetHandle: null,
          markerEnd: { type: MarkerType.ArrowClosed },
        } as Connection,
        es
      ));
    }
  }, [nodes, setNodes, setEdges]);

  // -------------- Generate from prompt --------------------------------
  const generateFromPrompt = useCallback(async (prompt: string) => {
    if (!prompt.trim()) return;
    try {
      const res = await OrganizationService.parseWorkflowPrompt(prompt);
      if (!res?.success) { toast.error(res?.message || 'Could not parse prompt'); return; }
      const parsed = res.data;
      const incomingNodes = (parsed.graph?.nodes || []) as Node<NodeData>[];
      const incomingEdges = (parsed.graph?.edges || []) as Edge[];
      // Re-layout with dagre so positions look good.
      const laidOut = autoLayout<NodeData>(
        incomingNodes.map((n) => ({
          ...n,
          type: n.type,
          data: n.data as NodeData,
          deletable: true,
          draggable: true,
        })),
        incomingEdges.map((e) => ({ ...e, markerEnd: { type: MarkerType.ArrowClosed } })),
      );
      setNodes(laidOut);
      setEdges(incomingEdges.map((e) => ({ ...e, markerEnd: { type: MarkerType.ArrowClosed } })));
      parsedRef.current = {
        trigger: parsed.trigger,
        trigger_config: parsed.trigger_config,
        conditions: parsed.conditions,
        actions: parsed.actions,
        prompt,
      };
      if (parsed.name && (!name || name === 'Untitled workflow')) setName(parsed.name);
      setShowPromptModal(false);
      toast.success(`Generated ${laidOut.length} nodes from prompt.`);
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Parse failed');
    }
  }, [name, setEdges, setNodes]);

  // -------------- Re-layout existing canvas ---------------------------
  const reLayout = useCallback(() => {
    setNodes((curr) => autoLayout<NodeData>(curr, edges));
  }, [edges, setNodes]);

  // -------------- Save -----------------------------------------------
  const triggerNode = nodes.find((n) => n.type === 'trigger');

  // Run validation across the whole graph and return both the message
  // AND the offending node id (so the inline chip can deep-link the
  // user straight into the broken node's drawer).
  const validation = useMemo<{ message: string | null; nodeId: string | null }>(() => {
    if (!triggerNode) {
      return { message: 'Add a starting node (trigger) before saving.', nodeId: null };
    }
    for (const n of nodes) {
      const schema = schemaFor(n.data.code);
      if (!schema) continue;
      for (const f of schema.fields) {
        if (f.type !== 'credential_picker' || !f.required) continue;
        const v = (n.data.params || {})[f.key];
        const credId = typeof v === 'number' ? v : (typeof v === 'string' && v ? Number(v) : null);
        const ok = credId && channels.some((c) =>
          c.id === credId && c.is_connected && c.is_active &&
          (f.credential_kinds || []).includes(c.kind)
        );
        if (!ok) {
          return {
            message: `"${n.data.label}" needs a ${f.credential_label || 'credential'}`,
            nodeId: n.id,
          };
        }
      }
    }
    return { message: null, nodeId: null };
  }, [triggerNode, nodes, channels]);
  const validationError = validation.message;

  const save = useCallback(async () => {
    if (validationError) { toast.error(validationError); return; }
    setSaving(true);
    try {
      // Lift the executable structure straight off the canvas — the
      // canvas is the source of truth, not the parser's last snapshot.
      // This fixes the case where the user drags a Lead Created node
      // manually: previously the saved workflow kept the old
      // (default 'manual') trigger and dispatch never matched.
      const triggerN = nodes.find((n) => n.type === 'trigger');
      const triggerCode = (triggerN?.data.code as string) || parsedRef.current.trigger || 'manual';
      const triggerCfg: Record<string, unknown> = {
        ...((triggerN?.data.params as Record<string, unknown>) || {}),
      };
      // Drop the 'label' key from trigger_config — it's the display
      // label, not an executor input.
      delete (triggerCfg as Record<string, unknown>)['label'];

      // Walk forward from the trigger in topological order so the
      // action list reflects the visible chain. Falls back to source
      // node order if the graph is disconnected.
      const orderedActionNodes = walkForward(nodes, edges, triggerN?.id);

      const conditions: { field: string; op: string; value: unknown }[] = [];
      const actions: Record<string, unknown>[] = [];
      for (const n of orderedActionNodes) {
        if (n.type === 'condition') {
          const p = (n.data.params || {}) as Record<string, unknown>;
          if (p.field && p.op) {
            conditions.push({
              field: String(p.field),
              op: String(p.op),
              value: p.value as unknown,
            });
          }
          continue;
        }
        const action: Record<string, unknown> = {
          type: n.data.code,
          ...((n.data.params as Record<string, unknown>) || {}),
        };
        delete action['label'];
        actions.push(action);
      }

      const payload: Record<string, unknown> = {
        name,
        is_active: isActive,
        prompt: parsedRef.current.prompt,
        trigger: triggerCode,
        trigger_config: triggerCfg,
        conditions,
        actions,
        graph: { nodes, edges },
      };
      const res = workflowId
        ? await OrganizationService.updateWorkflow(workflowId, payload)
        : await OrganizationService.createWorkflow(payload);
      if (res?.success) {
        toast.success(workflowId ? 'Saved.' : 'Workflow created.');
        if (!workflowId && res.data?.id) {
          router.replace(`/w/${wsId}/leads/workflows/builder/${res.data.id}`);
        }
      } else {
        toast.error(res?.message || 'Save failed');
      }
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  }, [validationError, name, isActive, nodes, edges, workflowId, router, wsId]);

  // AI-write the copy for every send step that's empty, then re-hydrate the
  // canvas. Saves the current flow first so no edits are lost.
  const [writingCopy, setWritingCopy] = useState(false);
  const aiWriteCopy = useCallback(async () => {
    if (!workflowId || writingCopy || saving) return;
    setWritingCopy(true);
    try {
      await save();  // persist the current canvas first
      const res = await OrganizationService.aiWriteWorkflowCopy(workflowId);
      if (res?.success) {
        const g = res.data?.graph as { nodes?: Node<NodeData>[]; edges?: Edge[] } | undefined;
        if (g?.nodes) {
          setNodes(g.nodes.map(_normalize));
          setEdges((g.edges || []).map((e) => ({ ...e, markerEnd: { type: MarkerType.ArrowClosed } })));
        }
        toast.success(res.message || 'AI wrote the copy.');
      } else {
        toast.error(res?.message || 'Could not write the copy.');
      }
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Could not write the copy.');
    } finally { setWritingCopy(false); }
  }, [workflowId, writingCopy, saving, save, setNodes, setEdges]);

  return (
    <ReactFlowProvider>
      <div className="fixed inset-0 z-30 bg-[#070d1b] text-white flex flex-col">
        {/* Top bar */}
        <header className="h-16 px-5 border-b border-white/5 flex items-center gap-4 bg-[#0a1020]">
          <button
            onClick={() => router.push(`/w/${wsId}/leads/workflows`)}
            className="p-2 rounded-lg hover:bg-white/[0.04] text-slate-400 hover:text-white"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-transparent text-lg font-bold text-white focus:outline-none w-full max-w-md border-b border-transparent focus:border-emerald-500/40"
              placeholder="Workflow name…"
            />
            <div className="text-[10px] uppercase tracking-wider text-slate-500 flex items-center gap-2 flex-wrap">
              {triggerNode ? (
                <>
                  <span>Starts on: {triggerNode.data.label}</span>
                  <span className="text-slate-700">·</span>
                  <span className="text-slate-600">
                    canvas trigger: <code className="text-emerald-400">{String(triggerNode.data.code)}</code>
                  </span>
                  {initial?.trigger && initial.trigger !== triggerNode.data.code && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold">
                      <AlertTriangle className="w-3 h-3" />
                      Saved as &quot;{initial.trigger}&quot; — click Save to update
                    </span>
                  )}
                </>
              ) : (
                <span>No starting node yet</span>
              )}
            </div>
          </div>
          <label className="inline-flex items-center cursor-pointer gap-2">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="sr-only peer"
            />
            <span className="w-9 h-5 rounded-full bg-slate-700 peer-checked:bg-emerald-500 relative transition-colors">
              <span className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4" />
            </span>
            <span className="text-xs text-slate-300">{isActive ? 'Active' : 'Inactive'}</span>
          </label>
          <button
            onClick={() => setShowPromptModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-200 text-xs font-semibold hover:bg-emerald-500/[0.15]"
          >
            <Wand2 className="w-3.5 h-3.5" />
            Generate from prompt
          </button>
          <button
            onClick={reLayout}
            disabled={nodes.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-slate-200 disabled:opacity-40"
          >
            Auto-layout
          </button>
          {workflowId && (
            <Link
              href={`/w/${wsId}/leads/workflows/${workflowId}/runs`}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-slate-200"
            >
              View runs
            </Link>
          )}
          {/* Visible reason chip — clicking it focuses the broken node
              so the user can fix it without hunting around the canvas. */}
          {validation.message && (
            <button
              type="button"
              onClick={() => {
                if (validation.nodeId) {
                  setSelectedNodeId(validation.nodeId);
                  toast.error(validation.message!);
                } else {
                  toast.error(validation.message!);
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-200 text-[11px] font-semibold hover:bg-amber-500/25 max-w-[280px]"
              title={validation.nodeId ? 'Click to open the node' : undefined}
            >
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{validation.message}</span>
              {validation.nodeId && (
                <span className="text-[9px] uppercase tracking-wider opacity-70 shrink-0">Fix</span>
              )}
            </button>
          )}
          {workflowId && (
            <button
              onClick={aiWriteCopy}
              disabled={writingCopy || saving || !!validationError}
              title="Let AI write on-brand copy for every send step that's empty"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-white/15 text-white/90 hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-4 h-4" />
              {writingCopy ? 'Writing…' : 'Write copy with AI'}
            </button>
          )}
          <button
            onClick={save}
            disabled={saving || !!validationError}
            title={validationError || undefined}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving…' : 'Save flow'}
          </button>
        </header>

        {/* Body: sidebar + canvas + drawer */}
        <div className="flex-1 flex overflow-hidden">
          <AddNodeSidebar
            palette={palette}
            onInsert={insertNodeFromPalette}
            hasTrigger={!!triggerNode}
          />

          <div className="flex-1 relative">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              onNodesDelete={onDeleteNodes}
              nodeTypes={nodeTypes}
              fitView
              colorMode="dark"
              defaultEdgeOptions={{
                animated: false,
                style: { stroke: '#64748b', strokeWidth: 1.5 },
              }}
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#1e293b" />
              <Controls className="!bg-[#0a1020] !border !border-white/10" />
              <MiniMap
                className="!bg-[#0a1020] !border !border-white/10"
                nodeColor={(n) => CATEGORY_ACCENT[(n.data as NodeData)?.category] || '#64748b'}
                maskColor="rgba(0,0,0,.5)"
              />
            </ReactFlow>

            {nodes.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center max-w-sm pointer-events-auto">
                  <Zap className="w-10 h-10 mx-auto mb-3 text-emerald-300" />
                  <h3 className="text-lg font-bold text-white">Add a starting node first</h3>
                  <p className="text-sm text-slate-400 mt-1">
                    Every workflow begins with a trigger — pick one from the left sidebar
                    (Manual or Message Received are the most common). Other node types unlock
                    after that.
                  </p>
                  <p className="text-xs text-slate-500 mt-3 italic">
                    Or skip the manual setup and let AI build it for you:
                  </p>
                  <button
                    onClick={() => setShowPromptModal(true)}
                    className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                  >
                    <Wand2 className="w-4 h-4" />
                    Generate from prompt
                  </button>
                </div>
              </div>
            )}
            {nodes.length > 0 && !triggerNode && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs font-semibold inline-flex items-center gap-1.5 pointer-events-none">
                <AlertTriangle className="w-3.5 h-3.5" />
                Add a starting node — the flow needs an entry point
              </div>
            )}
          </div>

          {selectedNode && (
            <NodeConfigDrawer
              node={selectedNode}
              allNodes={nodes}
              allEdges={edges}
              channels={channels}
              wsId={wsId}
              onClose={() => { setSelectedNodeId(null); refreshChannels(); }}
              onUpdate={(patch) => {
                setNodes((ns) => ns.map((n) => n.id === selectedNode.id
                  ? { ...n, data: { ...n.data, ...patch } }
                  : n));
              }}
              onDelete={() => {
                setNodes((ns) => ns.filter((n) => n.id !== selectedNode.id));
                setEdges((es) => es.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
                setSelectedNodeId(null);
              }}
            />
          )}
        </div>

        {showPromptModal && (
          <PromptModal
            onClose={() => setShowPromptModal(false)}
            onGenerate={generateFromPrompt}
            initialPrompt={parsedRef.current.prompt}
          />
        )}
      </div>
    </ReactFlowProvider>
  );
}

// ──────────────────────────────────────────────────────────────────────────
//                            ADD NODE SIDEBAR
// ──────────────────────────────────────────────────────────────────────────

function AddNodeSidebar({
  palette, onInsert, hasTrigger,
}: {
  palette: Palette | null;
  onInsert: (node: PaletteNode, category: PaletteCategory, provider?: PaletteProvider) => void;
  hasTrigger: boolean;
}) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeProvider, setActiveProvider] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Rule: when a trigger is already on the canvas we hide the Triggers
  // category (only one starting node per workflow). Everything else is
  // always browsable — users can drop action nodes before picking a
  // trigger if they want; save validation still requires a trigger.
  const visibleCategories = useMemo(() => {
    if (!palette?.categories) return [];
    if (!hasTrigger) return palette.categories;
    return palette.categories.filter((c) => c.code !== 'triggers');
  }, [palette, hasTrigger]);

  // If the user was browsing the Triggers category and just added a
  // trigger, drop back to the categories overview so the (now hidden)
  // Triggers list isn't left dangling.
  useEffect(() => {
    if (hasTrigger && activeCategory === 'triggers') {
      setActiveCategory(null);
      setActiveProvider(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasTrigger]);

  const cat = visibleCategories.find((c) => c.code === activeCategory) || null;
  const prov = cat?.providers?.find((p) => p.code === activeProvider) || null;

  const flat = useMemo(() => {
    const out: { node: PaletteNode; category: PaletteCategory; provider?: PaletteProvider }[] = [];
    for (const c of visibleCategories) {
      if (c.nodes) for (const n of c.nodes) out.push({ node: n, category: c });
      if (c.providers) for (const p of c.providers) {
        for (const n of p.nodes) out.push({ node: n, category: c, provider: p });
      }
    }
    return out;
  }, [visibleCategories]);

  const filtered = useMemo(() => {
    if (!search.trim()) return flat;
    const q = search.toLowerCase();
    return flat.filter(({ node, provider }) =>
      node.label.toLowerCase().includes(q) ||
      (node.help || '').toLowerCase().includes(q) ||
      (provider?.label || '').toLowerCase().includes(q),
    );
  }, [flat, search]);

  const goBack = () => {
    if (prov) setActiveProvider(null);
    // Triggers must stay open when no trigger exists — block "back".
    else if (cat && (hasTrigger || cat.code !== 'triggers')) setActiveCategory(null);
  };

  return (
    <aside className="w-[280px] shrink-0 border-r border-white/5 bg-[#070d1b] flex flex-col">
      <div className="px-4 py-3 border-b border-white/5">
        <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Add Node</div>
        <div className="mt-2 relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search nodes…"
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#080e1c] border border-white/10 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {search.trim() ? (
          filtered.length === 0 ? (
            <div className="text-center text-slate-500 italic text-xs py-6">No matches</div>
          ) : (
            filtered.map(({ node, category, provider }, i) => (
              <SidebarNodeRow
                key={`${category.code}-${provider?.code || 'x'}-${node.code}-${i}`}
                node={node}
                accent={provider?.accent || category.accent}
                categoryLabel={provider ? `${category.label} · ${provider.label}` : category.label}
                onClick={() => onInsert(node, category, provider)}
              />
            ))
          )
        ) : !cat ? (
          (palette?.categories || []).map((c) => (
            <SidebarCategoryRow key={c.code} category={c} onClick={() => setActiveCategory(c.code)} />
          ))
        ) : (
          <>
            <button
              onClick={goBack}
              className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-300 hover:text-emerald-200 mb-2"
            >
              <ArrowLeft className="w-3 h-3" />
              {prov ? `Back to ${cat.label}` : 'Back to categories'}
            </button>
            {cat.providers && !prov ? (
              cat.providers.map((p) => (
                <SidebarProviderRow key={p.code} provider={p} onClick={() => setActiveProvider(p.code)} />
              ))
            ) : prov ? (
              <>
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                  {prov.label} · {prov.subtitle}
                </div>
                {prov.nodes.map((n, i) => (
                  <SidebarNodeRow
                    key={`${prov.code}-${n.code}-${i}`}
                    node={n}
                    accent={prov.accent}
                    onClick={() => onInsert(n, cat, prov)}
                  />
                ))}
              </>
            ) : (
              <>
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">{cat.label}</div>
                {(cat.nodes || []).map((n, i) => (
                  <SidebarNodeRow
                    key={`${cat.code}-${n.code}-${i}`}
                    node={n}
                    accent={cat.accent}
                    starting={n.starting}
                    onClick={() => onInsert(n, cat)}
                  />
                ))}
              </>
            )}
          </>
        )}
      </div>
    </aside>
  );
}

function SidebarCategoryRow({ category, onClick }: { category: PaletteCategory; onClick: () => void }) {
  const Icon = ICON[category.icon] || Sparkles;
  const count = (category.nodes?.length || 0)
    + (category.providers?.reduce((a, p) => a + p.nodes.length, 0) || 0);
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-2.5 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/20 transition-colors flex items-center gap-2.5"
    >
      <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
           style={{ backgroundColor: `${category.accent}22`, color: category.accent, border: `1px solid ${category.accent}44` }}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11.5px] font-bold text-white uppercase tracking-wider">{category.label}</div>
        <div className="text-[10px] text-slate-500">{count} nodes</div>
      </div>
      <ChevronDown className="w-3 h-3 text-slate-500 -rotate-90" />
    </button>
  );
}

function SidebarProviderRow({ provider, onClick }: { provider: PaletteProvider; onClick: () => void }) {
  const Icon = ICON[provider.icon] || MessageCircle;
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-2.5 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition-colors flex items-center gap-2.5"
    >
      <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
           style={{ backgroundColor: `${provider.accent}22`, color: provider.accent, border: `1px solid ${provider.accent}44` }}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11.5px] font-bold text-white uppercase tracking-wider">{provider.label}</div>
        <div className="text-[10px] text-slate-500">{provider.subtitle || `${provider.nodes.length} actions`}</div>
      </div>
      <ChevronDown className="w-3 h-3 text-slate-500 -rotate-90" />
    </button>
  );
}

function SidebarNodeRow({
  node, accent, categoryLabel, starting, onClick,
}: {
  node: PaletteNode;
  accent: string;
  categoryLabel?: string;
  starting?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={node.help || ''}
      className="w-full text-left p-2 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
      style={starting ? { borderColor: `${accent}55`, backgroundColor: `${accent}0d` } : undefined}
    >
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: accent }} />
        <div className="text-[11.5px] font-bold text-white uppercase tracking-wider truncate flex-1">{node.label}</div>
        {starting && (
          <span className="text-[8px] font-bold uppercase px-1 py-0.5 rounded"
                style={{ backgroundColor: `${accent}26`, color: accent }}>
            Start
          </span>
        )}
      </div>
      {(node.help || categoryLabel) && (
        <div className="text-[9.5px] text-slate-500 mt-0.5 italic line-clamp-1">
          {categoryLabel ? `${categoryLabel} — ${node.help || ''}` : node.help}
        </div>
      )}
    </button>
  );
}

// ──────────────────────────────────────────────────────────────────────────
//                            PROMPT MODAL
// ──────────────────────────────────────────────────────────────────────────

function PromptModal({
  onClose, onGenerate, initialPrompt = '',
}: { onClose: () => void; onGenerate: (p: string) => void; initialPrompt?: string }) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const examples = [
    'When a message comes from Instagram, reply with ChatGPT using my knowledge base.',
    'When a lead is created from Website, send welcome email immediately, wait 24 hours then send a follow-up email.',
    'When AI detects booking intent, book a meeting, then send the booking link.',
  ];
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl border border-emerald-500/20 bg-[#0a1020] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-white/5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
            <Wand2 className="w-4 h-4 text-emerald-300" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-white">Generate flow from prompt</h2>
            <p className="text-[11px] text-slate-400">
              Describe what you want in plain English — the AI parser will create the nodes.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-white/[0.04] text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. When a lead is created from Website, send welcome email immediately, wait 24 hours then send a follow-up email."
            rows={5}
            className="w-full rounded-xl bg-[#080e1c] border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 resize-none"
          />
          <div className="mt-3 text-[10px] uppercase tracking-wider font-semibold text-slate-400">Examples</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {examples.map((e, i) => (
              <button
                key={i}
                onClick={() => setPrompt(e)}
                className="text-[10.5px] px-2.5 py-1 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 border border-white/5"
              >
                {e.slice(0, 55)}…
              </button>
            ))}
          </div>
        </div>
        <div className="px-5 py-4 border-t border-white/5 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-white/[0.04]">
            Cancel
          </button>
          <button
            onClick={() => onGenerate(prompt)}
            disabled={!prompt.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold disabled:opacity-40"
          >
            <PlayCircle className="w-3.5 h-3.5" />
            Generate
          </button>
        </div>
      </div>
    </div>
  );
}
