'use client';

/**
 * Knowledge-base detail page -- the "click into a KB to see everything"
 * surface.
 *
 * Why a separate route from /knowledge/<docId>:
 *   * That page is per-DOCUMENT (one trained PDF / text / URL).
 *   * THIS page is per-KNOWLEDGE-BASE -- shows the entire bucket:
 *     - The KB's name + LLM model + description
 *     - Every Q&A pair in this KB (with delete + add-more)
 *     - Every document in this KB (with click-through to detail)
 *     - A chat playground scoped to JUST this KB
 *
 * "Add more data" here opens the full train page with kb=<id> so any
 * mode (Q&A / text / file / URL) attaches to THIS KB.
 */

import { useCallback, useEffect, useRef, useState, use as reactUse } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Plus, Trash2, Sparkles, FileText, Send,
  MessageCircle, Database, ChevronDown, Type as TypeIcon, Globe,
  X, RefreshCw, CheckCircle2, PauseCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { OrganizationService } from '@/services/organization.service';
import { PageSkeleton } from '@/components/workspace/Skeleton';

type KB = {
  id: number;
  name: string;
  description: string;
  system_prompt: string;
  model: string;
  color: string;
  is_active: boolean;
  document_count: number;
  qa_count: number;
  chunk_count: number;
  created_at: string;
  updated_at: string;
  documents?: Array<{
    id: number;
    title: string;
    source_kind: string;
    source_filename: string;
    source_url: string;
    chunk_count: number;
    char_count: number;
    status: string;
  }>;
  qa_pairs?: Array<{
    id: number;
    questions: string[];
    answer: string;
    match_mode: string;
    priority: number;
    hit_count: number;
  }>;
};

type ChatTurn = {
  role: 'user' | 'assistant';
  content: string;
  citations?: Array<{ index: number; title: string; source: string; score: number }>;
  confidence?: number;
  source?: 'qa_pair' | 'rag' | 'no_match';
};

const LLM_OPTIONS = [
  // MoreTech AI first -- the platform's own managed Qwen. ``provider:
  // 'moretech_ai'`` is gated by the subscription (not a Channel), so
  // the picker only includes it when the workspace has unlocked it.
  { id: 'moretech_ai',             name: 'MoreTech AI',      hint: 'Managed Qwen · private', provider: 'moretech_ai' },
  { id: 'gpt-4o-mini',             name: 'GPT-4o mini',      hint: 'Fast + cheap', provider: 'openai' },
  { id: 'gpt-4o',                  name: 'GPT-4o',           hint: 'Best quality', provider: 'openai' },
  { id: 'claude-3-5-sonnet',       name: 'Claude Sonnet',    hint: 'Nuanced',      provider: 'anthropic' },
  { id: 'gemini-1.5-flash',        name: 'Gemini Flash',     hint: 'Free tier',    provider: 'gemini' },
  { id: 'llama3.2',                name: 'Llama 3.2 Ollama', hint: 'Self-hosted',  provider: 'ollama' },
  { id: 'llama-3.1-70b-versatile', name: 'Llama 70B Groq',   hint: 'Sub-200ms',    provider: 'groq' },
  { id: 'mistral-large-latest',    name: 'Mistral Large',    hint: 'European',     provider: 'mistral' },
  { id: 'command-r-plus',          name: 'Cohere Command R+',hint: 'RAG-strong',   provider: 'cohere' },
];

export default function KBDetailPage({ params }: { params: Promise<{ id: string; kbId: string }> }) {
  const { id: wsId, kbId } = reactUse(params);
  const [kb, setKb] = useState<KB | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingModel, setSavingModel] = useState(false);
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [connectedProviders, setConnectedProviders] = useState<string[]>([]);
  // Document-detail popup -- replaces the standalone /knowledge/<docId>
  // page. Clicking a doc row sets ``openDocId``; the modal fetches its
  // chunks + metadata and shows them in an overlay.
  const [openDocId, setOpenDocId] = useState<number | null>(null);
  const chatRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await OrganizationService.kbGetBase(Number(kbId));
      if (res?.success) setKb(res.data);
    } finally { setLoading(false); }
  }, [kbId]);

  useEffect(() => { load(); }, [load]);

  // Connected provider kinds → filters the LLM picker. We also fold
  // in MoreTech AI as a virtual "connected provider" when the
  // workspace has an active subscription, so the searchable picker
  // offers it alongside the credential-backed models.
  useEffect(() => {
    Promise.all([
      OrganizationService.listChannels().catch(() => null),
      OrganizationService.moretechAIStatus().catch(() => null),
    ]).then(([chRes, mtRes]) => {
      const kinds = new Set<string>();
      if (chRes?.success && Array.isArray(chRes.data)) {
        for (const ch of chRes.data as Array<{ kind: string; is_active: boolean; is_connected: boolean }>) {
          if (ch.is_active !== false && ch.is_connected !== false) kinds.add(ch.kind);
        }
      }
      // MoreTech AI is gated by subscription, not a Channel -- add it
      // as an available provider only when unlocked.
      if (mtRes?.success && mtRes.data?.has_access) kinds.add('moretech_ai');
      setConnectedProviders(Array.from(kinds));
    });
  }, []);

  useEffect(() => {
    const el = chatRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [history.length]);

  const changeModel = async (newModel: string) => {
    if (!kb || savingModel || newModel === kb.model) return;
    setSavingModel(true);
    try {
      const res = await OrganizationService.kbUpdateBase(kb.id, { model: newModel });
      if (res?.success) {
        setKb({ ...kb, model: newModel });
        toast.success(`Replies will now use ${newModel}.`);
      } else { toast.error(res?.message || 'Could not update model.'); }
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Could not update model.');
    } finally { setSavingModel(false); }
  };

  /**
   * Flip the KB's active state. When inactive, the chat engine skips
   * this KB's documents during retrieval -- a soft "pause" without
   * deleting the training data. Optimistic toggle with rollback on
   * error so the switch feels instant.
   */
  const [togglingActive, setTogglingActive] = useState(false);
  const toggleActive = async () => {
    if (!kb || togglingActive) return;
    const next = !kb.is_active;
    setTogglingActive(true);
    setKb({ ...kb, is_active: next });   // optimistic
    try {
      const res = await OrganizationService.kbUpdateBase(kb.id, { is_active: next });
      if (res?.success) {
        toast.success(next ? 'Knowledge base activated.' : 'Knowledge base paused.');
      } else {
        setKb({ ...kb, is_active: !next });   // rollback
        toast.error(res?.message || 'Could not update status.');
      }
    } catch {
      setKb({ ...kb, is_active: !next });
      toast.error('Could not update status.');
    } finally { setTogglingActive(false); }
  };

  const deleteDoc = async (doc: { id: number; title: string }) => {
    if (!window.confirm(`Delete "${doc.title}" and all its chunks?`)) return;
    const res = await OrganizationService.kbDeleteDocument(doc.id);
    if (res?.success) {
      if (kb) {
        setKb({
          ...kb,
          documents: (kb.documents || []).filter((d) => d.id !== doc.id),
          document_count: Math.max(0, (kb.document_count || 1) - 1),
        });
      }
      toast.success('Document deleted.');
    } else { toast.error(res?.message || 'Delete failed.'); }
  };

  const ask = async () => {
    const q = question.trim();
    if (!q || !kb || asking) return;
    setAsking(true);
    setHistory((h) => [...h, { role: 'user', content: q }]);
    setQuestion('');
    try {
      const res = await OrganizationService.kbChat({
        query: q,
        kb_id: kb.id,
        history: history.map((t) => ({ role: t.role, content: t.content })),
      });
      if (res?.success && res.data) {
        const ans = res.data;
        setHistory((h) => [...h, {
          role: 'assistant',
          content: ans.answer || '(no answer)',
          citations: ans.citations || [],
          confidence: ans.confidence,
          source: ans.source,
        }]);
      } else {
        setHistory((h) => [...h, { role: 'assistant', content: res?.message || 'Failed.' }]);
      }
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      setHistory((h) => [...h, {
        role: 'assistant',
        content: err.response?.data?.message || 'Network error.',
      }]);
    } finally { setAsking(false); }
  };

  if (loading || !kb) return <PageSkeleton />;

  const availableModels = LLM_OPTIONS.filter((m) =>
    connectedProviders.includes(m.provider) || m.id === kb.model,
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Link
        href={`/w/${wsId}/knowledge`}
        className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-300 mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to all knowledge bases
      </Link>

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.06] to-white/[0.01] p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center shrink-0">
            <Database className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold text-white">{kb.name}</h1>
              {/* Status pill mirrors the toggle below -- green when
                  active, slate when paused. */}
              <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full border ${
                kb.is_active
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-500/15 text-slate-400 border-slate-500/40'
              }`}>
                {kb.is_active ? <CheckCircle2 className="w-3 h-3" /> : <PauseCircle className="w-3 h-3" />}
                {kb.is_active ? 'Active' : 'Paused'}
              </span>
            </div>
            {kb.description && (
              <p className="text-sm text-slate-400 mt-1">{kb.description}</p>
            )}
            <div className="flex items-center gap-3 mt-3 text-[12px] text-slate-400">
              <span>Created {new Date(kb.created_at).toLocaleDateString()}</span>
              <span>·</span>
              <span>Updated {new Date(kb.updated_at).toLocaleDateString()}</span>
            </div>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-3">
            {/* Active / paused toggle. A paused KB keeps all its data
                but is skipped by the chat engine's retrieval, so the
                user can mute a KB temporarily without deleting it. */}
            <button
              onClick={toggleActive}
              disabled={togglingActive}
              className="inline-flex items-center gap-2 text-[12px] text-slate-300 disabled:opacity-50"
              title={kb.is_active ? 'Pause this KB (chat will skip it)' : 'Activate this KB'}
            >
              <span className={kb.is_active ? 'text-emerald-300' : 'text-slate-500'}>
                {kb.is_active ? 'Active' : 'Paused'}
              </span>
              <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                kb.is_active ? 'bg-emerald-500/70' : 'bg-slate-600/70'
              }`}>
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  kb.is_active ? 'translate-x-[18px]' : 'translate-x-[3px]'
                }`} />
              </span>
            </button>
            <Link
              href={`/w/${wsId}/knowledge/train?kb=${kb.id}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold"
            >
              <Plus className="w-4 h-4" />
              Add more data
            </Link>
          </div>
        </div>

        {/* Stats -- Q&A removed (it's workspace-wide, not per-KB). */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          <Stat label="Documents" value={kb.document_count} />
          <Stat label="Chunks" value={kb.chunk_count} />
          <Stat label="Model" value={kb.model} />
        </div>

        {/* LLM picker -- searchable dropdown filtered to connected
            providers + MoreTech AI (when subscribed). The current
            model is always selectable even if its provider went away. */}
        <div className="mt-5 pt-5 border-t border-white/5">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-2">
            AI model for replies
          </div>
          <LLMSearchSelect
            value={kb.model}
            onChange={changeModel}
            options={availableModels}
            connectedProviders={connectedProviders}
            disabled={savingModel}
          />
        </div>
      </div>

      {/* Q&A pairs are workspace-wide (managed via the "Train Q&A"
          button on the main page), NOT per-KB -- so this detail page
          deliberately does NOT show a Q&A section. A KB is purely a
          bucket of documents + a chat scope. */}

      {/* ── Training sources grouped by TYPE ───────────────────────
          Three separate sections so the user can see at a glance what
          kind of data they've trained: uploaded files, pasted text,
          and crawled URLs. Each section only renders when it has at
          least one doc (or, for the "Add" affordance, always shows the
          add link in its header). */}
      {(() => {
        const docs = kb.documents || [];
        const fileDocs = docs.filter((d) => d.source_kind === 'file');
        const textDocs = docs.filter((d) => d.source_kind === 'text' || d.source_kind === 'past_conversations');
        const urlDocs  = docs.filter((d) => d.source_kind === 'url');

        const Row = (d: NonNullable<KB['documents']>[number]) => (
          <div key={d.id} className="group/doc flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5 hover:border-cyan-500/30 transition-colors">
            {/* Row body opens the doc-detail POPUP (was a link to a
                standalone /knowledge/<docId> page, now removed). */}
            <button
              onClick={() => setOpenDocId(d.id)}
              className="flex-1 min-w-0 text-left cursor-pointer"
            >
              <div className="text-sm font-semibold text-white truncate hover:text-cyan-200">{d.title}</div>
              <div className="text-[11px] text-slate-400 truncate">
                {d.source_filename || d.source_url || d.source_kind} · {d.chunk_count} chunks · {d.char_count.toLocaleString()} chars
              </div>
            </button>
            <button
              onClick={() => deleteDoc(d)}
              className="opacity-0 group-hover/doc:opacity-100 transition-opacity p-1.5 rounded text-slate-400 hover:text-rose-300 hover:bg-rose-500/10"
              title="Delete this document"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        );

        const Section = ({
          icon: Icon, title, color, items, addMode, emptyHint,
        }: {
          icon: typeof FileText;
          title: string;
          color: string;
          items: NonNullable<KB['documents']>;
          addMode: 'file' | 'text' | 'url';
          emptyHint: string;
        }) => (
          <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4" style={{ color }} />
                <h2 className="text-sm font-bold text-white">{title}</h2>
                <span className="text-[11px] text-slate-400">
                  {items.length} item{items.length === 1 ? '' : 's'}
                </span>
              </div>
              <Link
                href={`/w/${wsId}/knowledge/train?kb=${kb.id}&mode=${addMode}`}
                className="text-[11px] hover:opacity-80 inline-flex items-center gap-1"
                style={{ color }}
              >
                <Plus className="w-3 h-3" /> Add
              </Link>
            </div>
            {items.length === 0 ? (
              <p className="text-center text-xs text-slate-500 py-5">{emptyHint}</p>
            ) : (
              <div className="space-y-2">{items.map(Row)}</div>
            )}
          </section>
        );

        return (
          <>
            <Section
              icon={FileText} title="Uploaded files" color="#06b6d4"
              items={fileDocs} addMode="file"
              emptyHint="No files uploaded yet. PDF / DOCX / TXT / MD."
            />
            <Section
              icon={TypeIcon} title="Pasted text" color="#a855f7"
              items={textDocs} addMode="text"
              emptyHint="No pasted text yet. Handbooks, policies, FAQs."
            />
            <Section
              icon={Globe} title="Crawled URLs" color="#f59e0b"
              items={urlDocs} addMode="url"
              emptyHint="No URLs crawled yet. Public pages or articles."
            />
          </>
        );
      })()}

      {/* ── Chat playground scoped to THIS KB only ─────────────── */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
        <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-300" />
          <h2 className="text-sm font-bold text-white">Chat playground</h2>
          <span className="text-[10.5px] text-slate-500">
            answers use only this knowledge base
          </span>
        </div>
        <div ref={chatRef} className="overflow-y-auto p-4 space-y-3 min-h-[300px] max-h-[460px]">
          {history.length === 0 ? (
            <div className="text-center text-xs text-slate-500 py-8">
              <MessageCircle className="w-8 h-8 mx-auto mb-2 text-slate-600" />
              <p>Ask anything about <strong className="text-slate-300">{kb.name}</strong>.</p>
              <p className="mt-1 text-[10.5px]">Q&A pairs fire instantly. Otherwise the AI synthesises from your documents.</p>
            </div>
          ) : (
            history.map((turn, i) => (
              <div key={i} className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3.5 py-2 rounded-2xl text-[13.5px] ${
                  turn.role === 'user' ? 'bg-emerald-600 text-white rounded-br-md' : 'bg-white/[0.06] text-slate-100 rounded-bl-md'
                }`}>
                  <p className="whitespace-pre-wrap break-words">{turn.content}</p>
                  {turn.role === 'assistant' && turn.source === 'qa_pair' && (
                    <div className="mt-1 text-[10px] text-emerald-300/80">★ Direct Q&A match</div>
                  )}
                  {turn.role === 'assistant' && turn.confidence != null && turn.source !== 'qa_pair' && (
                    <div className="mt-1 text-[10px] text-slate-400">
                      Confidence {Math.round((turn.confidence || 0) * 100)}%
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          {asking && (
            <div className="flex justify-start">
              <div className="bg-white/[0.06] rounded-2xl rounded-bl-md px-3.5 py-2 inline-flex items-center gap-2 text-[12.5px] text-slate-300">
                <div className="w-3 h-3 border-2 border-cyan-300 border-t-transparent rounded-full animate-spin" />
                Thinking…
              </div>
            </div>
          )}
        </div>
        <div className="px-3 py-3 border-t border-white/5 flex items-center gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); } }}
            disabled={asking}
            placeholder={`Ask about ${kb.name}…`}
            className="flex-1 rounded-full bg-[#080e1c] border border-white/10 px-4 py-2 text-[13px] text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 disabled:opacity-50"
          />
          <button
            onClick={ask}
            disabled={asking || !question.trim()}
            className="w-9 h-9 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* Document-detail popup -- shows the trained chunks for one
          doc without leaving the KB page. Replaces the old standalone
          /knowledge/<docId> route. */}
      {openDocId != null && (
        <DocumentDetailModal
          docId={openDocId}
          onClose={() => setOpenDocId(null)}
          onDeleted={() => {
            setOpenDocId(null);
            load();   // refresh the KB so the deleted doc disappears
          }}
        />
      )}
    </div>
  );
}


/**
 * Document-detail popup. Fetches one document's metadata + indexed
 * chunks and renders them in an overlay. Lets the user inspect what
 * was actually trained (chunk-by-chunk) + retrain / delete -- all the
 * things the removed /knowledge/<docId> page used to do, now inline.
 */
function DocumentDetailModal({
  docId, onClose, onDeleted,
}: {
  docId: number;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [doc, setDoc] = useState<{
    id: number; title: string; source_kind: string; source_filename: string;
    source_url: string; status: string; chunk_count: number; char_count: number;
    embedding_model: string; created_at: string; updated_at: string;
    chunks?: Array<{ id: number; position: number; content: string; token_count: number }>;
    chunks_total?: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await OrganizationService.kbGetDocument(docId);
        if (!cancelled && res?.success) setDoc(res.data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [docId]);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const retrain = async () => {
    if (!doc || busy) return;
    setBusy(true);
    try {
      const res = await OrganizationService.kbRetrainDocument(doc.id);
      if (res?.success) {
        toast.success('Re-trained.');
        const fresh = await OrganizationService.kbGetDocument(doc.id);
        if (fresh?.success) setDoc(fresh.data);
      } else { toast.error(res?.message || 'Retrain failed.'); }
    } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!doc || busy) return;
    if (!window.confirm(`Delete "${doc.title}" and all its chunks?`)) return;
    setBusy(true);
    try {
      const res = await OrganizationService.kbDeleteDocument(doc.id);
      if (res?.success) { toast.success('Deleted.'); onDeleted(); }
      else { toast.error(res?.message || 'Delete failed.'); setBusy(false); }
    } catch {
      toast.error('Delete failed.'); setBusy(false);
    }
  };

  const sourceLabel = doc
    ? (doc.source_kind === 'url' ? doc.source_url
       : doc.source_kind === 'file' ? doc.source_filename
       : 'Pasted text')
    : '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-2xl border border-white/10 bg-[#0a1020] my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-white/5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 flex items-center justify-center shrink-0">
              {doc?.source_kind === 'url' ? <Globe className="w-5 h-5" />
               : doc?.source_kind === 'file' ? <FileText className="w-5 h-5" />
               : <TypeIcon className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-white truncate">{doc?.title || 'Loading…'}</h2>
              <div className="text-[11px] text-slate-400 truncate">{sourceLabel}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-white/[0.06] text-slate-400 hover:text-white shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading || !doc ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">
            <div className="w-6 h-6 border-2 border-cyan-300 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading training data…
          </div>
        ) : (
          <div className="px-6 py-5">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <Stat label="Chunks" value={doc.chunk_count} />
              <Stat label="Chars" value={doc.char_count.toLocaleString()} />
              <Stat label="Trained" value={new Date(doc.created_at).toLocaleDateString()} />
            </div>
            {doc.embedding_model && (
              <div className="text-[11px] text-slate-500 italic mb-4">
                Embedded with {doc.embedding_model}
              </div>
            )}

            {/* Chunk list */}
            <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-2">
              Indexed chunks {doc.chunks_total != null ? `(${(doc.chunks || []).length} of ${doc.chunks_total})` : ''}
            </div>
            <div className="max-h-[360px] overflow-y-auto space-y-2 pr-1">
              {(!doc.chunks || doc.chunks.length === 0) ? (
                <p className="text-center text-xs text-slate-500 py-6">No chunks indexed.</p>
              ) : (
                doc.chunks.map((c) => (
                  <div key={c.id} className="rounded-lg bg-white/[0.02] border border-white/5 p-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-mono text-slate-500">#{c.position}</span>
                      <span className="text-[10px] text-slate-500">{c.token_count} tokens</span>
                    </div>
                    <p className="text-[12.5px] text-slate-300 leading-relaxed">{c.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Footer actions */}
        {doc && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/5">
            <button
              onClick={remove}
              disabled={busy}
              className="px-3 py-1.5 rounded-lg border border-white/10 hover:border-red-500/50 text-xs text-slate-300 hover:text-red-300 inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
            <button
              onClick={retrain}
              disabled={busy}
              className="px-3 py-1.5 rounded-lg border border-white/10 hover:border-cyan-500/50 text-xs text-slate-300 hover:text-cyan-300 inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} /> Retrain
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Searchable LLM picker. Filters to providers the workspace has
 * connected (channels) + MoreTech AI (subscription). Type-ahead on
 * name / hint / provider. Same component pattern as the train page.
 */
function LLMSearchSelect({
  value, onChange, options, connectedProviders, disabled,
}: {
  value: string;
  onChange: (id: string) => void;
  options: Array<{ id: string; name: string; hint: string; provider: string }>;
  connectedProviders: string[];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const selected = options.find((o) => o.id === value);
  const q = search.trim().toLowerCase();
  const filtered = q
    ? options.filter((o) =>
        o.name.toLowerCase().includes(q)
        || o.hint.toLowerCase().includes(q)
        || o.provider.toLowerCase().includes(q))
    : options;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left rounded-lg border border-white/10 bg-[#080e1c] px-3 py-2.5 flex items-center justify-between hover:border-emerald-500/40 disabled:opacity-50"
      >
        <div className="min-w-0 flex-1">
          {selected ? (
            <>
              <div className="text-[13px] font-semibold text-white truncate flex items-center gap-1.5">
                {selected.name}
                {!connectedProviders.includes(selected.provider) && (
                  <span className="text-[9px] text-amber-300 font-normal">(no key)</span>
                )}
              </div>
              <div className="text-[10.5px] text-slate-400 truncate">{selected.hint}</div>
            </>
          ) : (
            <div className="text-[13px] text-slate-500">Select a model…</div>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 ml-2 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-20 left-0 right-0 mt-2 rounded-lg border border-white/15 bg-[#080e1c] shadow-2xl shadow-black/50 overflow-hidden">
          <div className="p-2 border-b border-white/5">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search models…"
              className="w-full bg-transparent text-[12.5px] text-white placeholder:text-slate-600 px-2 py-1.5 focus:outline-none"
            />
          </div>
          <div className="max-h-[260px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-[12px] text-slate-500">
                {q ? `No models match "${q}".` : 'No connected providers yet.'}
              </div>
            ) : (
              filtered.map((m) => {
                const active = m.id === value;
                const connected = connectedProviders.includes(m.provider);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => { onChange(m.id); setOpen(false); setSearch(''); }}
                    className={`w-full text-left px-3 py-2 hover:bg-white/[0.05] flex items-start justify-between gap-3 ${
                      active ? 'bg-emerald-500/[0.08]' : ''
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className={`text-[12.5px] font-semibold truncate flex items-center gap-1 ${active ? 'text-emerald-200' : 'text-white'}`}>
                        {m.name}
                        {!connected && <span className="text-[9px] text-amber-300 font-normal">(no key)</span>}
                      </div>
                      <div className="text-[10.5px] text-slate-400 truncate">{m.hint}</div>
                    </div>
                    <span className="text-[9.5px] font-mono text-slate-500 shrink-0 mt-0.5">{m.provider}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}


function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3 text-center">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{label}</div>
      <div className="text-base font-bold text-white mt-1">{value}</div>
    </div>
  );
}
