'use client';

/**
 * Per-document knowledge-base detail page.
 *
 * One trained document = one focused workspace. The page surfaces:
 *   1. Header   -- title + source + status + LLM picker
 *   2. Stats    -- chunks / chars / trained-at / embed model
 *   3. Chunks   -- preview of what was actually indexed (lets you
 *                  verify training data, not just count it)
 *   4. Add more -- pop the same Train modal but with this doc's
 *                  KB pre-selected so additions land here
 *   5. Chat playground -- queries scoped to THIS document only via
 *                  ``document_ids=[doc.id]``, so the reply can ONLY
 *                  pull from this training data. No cross-KB bleed.
 *
 * Why per-document scoping (not per-KB scoping):
 *   The current data model has one KB per workspace by default, with
 *   many KnowledgeDocument rows attached. Users perceive each
 *   uploaded PDF as a self-contained "trained AI" -- so we scope
 *   the chat to ONE document at a time. The backend's
 *   ``document_ids`` filter on /knowledge/chat/ already supports
 *   this; no new endpoint needed.
 */

import { useCallback, useEffect, useRef, useState, use as reactUse } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, FileText, Globe, Type as TypeIcon, RefreshCw, Trash2,
  AlertTriangle, CheckCircle2, Send, Sparkles, MessageCircle, Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { OrganizationService } from '@/services/organization.service';
import { PageSkeleton } from '@/components/workspace/Skeleton';

type KBDoc = {
  id: number;
  title: string;
  source_kind: 'text' | 'url' | 'file' | 'past_conversations';
  source_url: string;
  source_filename: string;
  status: 'pending' | 'processing' | 'ready' | 'error';
  error_message: string;
  chunk_count: number;
  char_count: number;
  embedding_model: string;
  // KB that owns this document. Q&A pairs / further training routes
  // through this id so they stay scoped to the same bucket.
  knowledge_base: number | null;
  created_at: string;
  updated_at: string;
  chunks?: Array<{ id: number; position: number; content: string; token_count: number }>;
  chunks_total?: number;
};

// Q&A pair shown in the per-doc detail page. Loaded separately from
// chunks because they're a different entity (rule-based answers, not
// embedded vectors) and have their own hit-count telemetry.
type QAPair = {
  id: number;
  questions: string[];
  answer: string;
  match_mode: 'contains' | 'exact' | 'regex' | 'semantic';
  priority: number;
  is_active: boolean;
  hit_count: number;
  last_hit_at: string | null;
  created_at: string;
};

// LLM options surfaced in the per-KB picker. ``provider`` is the
// Channel kind that must be connected for the model to actually run
// -- the picker filters down to options the tenant can use.
const LLM_OPTIONS: Array<{
  id: string; name: string; hint: string; provider: string;
}> = [
  { id: 'gpt-4o-mini',             name: 'GPT-4o mini',        hint: 'Fast + cheap (recommended)', provider: 'openai' },
  { id: 'gpt-4o',                  name: 'GPT-4o',             hint: 'Best quality, slower',       provider: 'openai' },
  { id: 'claude-3-5-sonnet',       name: 'Claude Sonnet',      hint: 'Nuanced, long context',      provider: 'anthropic' },
  { id: 'gemini-1.5-flash',        name: 'Gemini Flash',       hint: 'Fast, free tier',            provider: 'gemini' },
  { id: 'llama3.2',                name: 'Llama 3.2 (Ollama)', hint: 'Self-hosted, free',          provider: 'ollama' },
  { id: 'llama-3.1-70b-versatile', name: 'Llama 70B (Groq)',   hint: 'Sub-200ms inference',        provider: 'groq' },
  { id: 'mistral-large-latest',    name: 'Mistral Large',      hint: 'Strong European model',      provider: 'mistral' },
  { id: 'command-r-plus',          name: 'Cohere Command R+',  hint: 'Strong on RAG retrieval',    provider: 'cohere' },
  { id: 'openrouter/auto',         name: 'OpenRouter (auto)',  hint: 'One key, every model',       provider: 'openrouter' },
  { id: 'meta-llama/Llama-3-70b',  name: 'Llama 3 70B',        hint: 'Hosted via Together AI',     provider: 'together_ai' },
];

type ChatTurn = {
  role: 'user' | 'assistant';
  content: string;
  citations?: Array<{ index: number; title: string; source: string; score: number; snippet: string }>;
  confidence?: number;
  source?: 'qa_pair' | 'rag' | 'no_match';
};

export default function KBDocumentDetailPage({ params }: {
  params: Promise<{ id: string; docId: string }>;
}) {
  const { id: wsId, docId } = reactUse(params);
  const [doc, setDoc] = useState<KBDoc | null>(null);
  const [qaPairs, setQaPairs] = useState<QAPair[]>([]);
  const [kbModel, setKbModel] = useState<string>('gpt-4o-mini');
  const [savingModel, setSavingModel] = useState(false);
  // Connected AI providers (Channel kinds) -- filters the LLM picker
  // to models the tenant can actually run.
  const [connectedProviders, setConnectedProviders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    OrganizationService.listChannels().then((res) => {
      if (res?.success && Array.isArray(res.data)) {
        const kinds = new Set<string>();
        for (const ch of res.data as Array<{ kind: string; is_active: boolean; is_connected: boolean }>) {
          if (ch.is_active !== false && ch.is_connected !== false) {
            kinds.add(ch.kind);
          }
        }
        setConnectedProviders(Array.from(kinds));
      }
    }).catch(() => { /* offline -- picker keeps current value */ });
  }, []);

  // Models the user can pick -- only ones whose provider Channel is
  // wired up. Always include the CURRENT model even if its provider
  // isn't connected (so the picker can still show what the KB is
  // pinned to + let the user switch).
  const availableModels = LLM_OPTIONS.filter((m) =>
    connectedProviders.includes(m.provider) || m.id === kbModel,
  );
  // Chat state -- in-memory only. Reload the page to clear.
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const chatRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await OrganizationService.kbGetDocument(Number(docId));
      if (res?.success) {
        setDoc(res.data);
        // After the doc loads we know which KB it belongs to -- fetch
        // the Q&A pairs scoped to THAT KB only. The /qa/ endpoint for
        // a kb returns pairs ordered by priority desc, id asc -- same
        // order the chat engine uses, so the UI mirrors runtime behaviour.
        if (res.data?.knowledge_base) {
          try {
            const qaRes = await OrganizationService.kbListQAPairs(res.data.knowledge_base);
            if (qaRes?.success) setQaPairs(qaRes.data || []);
          } catch {
            // Non-fatal: doc detail still works without QA list.
          }
          // Load the KB itself so we know which model it's pinned to
          // (for the LLM picker below). Falls back to gpt-4o-mini on
          // error so the picker always renders SOMETHING selected.
          try {
            const kbRes = await OrganizationService.kbGetBase(res.data.knowledge_base);
            if (kbRes?.success && kbRes.data?.model) setKbModel(kbRes.data.model);
          } catch { /* non-fatal */ }
        }
      }
    } finally { setLoading(false); }
  }, [docId]);

  useEffect(() => { load(); }, [load]);

  // Auto-scroll chat to the latest turn.
  useEffect(() => {
    const el = chatRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [history.length]);

  /**
   * Update the LLM model used by THIS knowledge base for chat replies.
   * PATCHes the KnowledgeBase row -- every doc attached to the same KB
   * inherits the change, so updating the model on one detail page
   * applies to all sibling docs immediately on the next chat.
   */
  const changeModel = async (newModel: string) => {
    if (!doc?.knowledge_base || savingModel || newModel === kbModel) return;
    setSavingModel(true);
    try {
      const res = await OrganizationService.kbUpdateBase(doc.knowledge_base, { model: newModel });
      if (res?.success) {
        setKbModel(newModel);
        toast.success(`Replies will now use ${newModel}.`);
      } else {
        toast.error(res?.message || 'Could not update the model.');
      }
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Could not update the model.');
    } finally {
      setSavingModel(false);
    }
  };

  const retrain = async () => {
    if (!doc) return;
    toast.info('Re-embedding…');
    const res = await OrganizationService.kbRetrainDocument(doc.id);
    if (res?.success) { toast.success('Re-trained.'); load(); }
    else toast.error(res?.message || 'Retrain failed.');
  };

  const remove = async () => {
    if (!doc) return;
    if (!window.confirm(`Delete "${doc.title}" and all its training data?`)) return;
    const res = await OrganizationService.kbDeleteDocument(doc.id);
    if (res?.success) {
      toast.success('Deleted.');
      window.location.href = `/w/${wsId}/knowledge`;
    } else {
      toast.error(res?.message || 'Delete failed.');
    }
  };

  /**
   * Delete a single Q&A pair. Confirms first because the rule + its
   * hit-count telemetry get wiped. Optimistic removal -- the row
   * disappears immediately on success, no full re-fetch needed.
   */
  const deleteQA = async (qa: QAPair) => {
    const firstQ = (qa.questions || [])[0] || '(empty)';
    if (!window.confirm(`Delete this Q&A pair?\n\n"${firstQ}" → "${qa.answer.slice(0, 60)}…"\n\nThe rule will stop firing immediately.`)) {
      return;
    }
    try {
      const res = await OrganizationService.kbDeleteQA(qa.id);
      if (res?.success) {
        setQaPairs((rows) => rows.filter((r) => r.id !== qa.id));
        toast.success('Q&A pair deleted.');
      } else {
        toast.error(res?.message || 'Delete failed.');
      }
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Delete failed.');
    }
  };

  /**
   * Send one chat turn, scoped to THIS document only.
   * The backend's ``/knowledge/chat/`` accepts ``document_ids`` --
   * we pass [doc.id] so the retrieval layer only walks chunks from
   * this single document. No leakage from other trained docs.
   */
  const ask = async () => {
    const q = question.trim();
    if (!q || !doc || asking) return;
    setAsking(true);
    // Optimistic: append the user message immediately so the input
    // can clear and the UI feels responsive.
    const userTurn: ChatTurn = { role: 'user', content: q };
    setHistory((h) => [...h, userTurn]);
    setQuestion('');
    try {
      const res = await OrganizationService.kbChat({
        query: q,
        document_ids: [doc.id],
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
        setHistory((h) => [...h, {
          role: 'assistant',
          content: res?.message || 'Failed to generate an answer.',
        }]);
      }
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      setHistory((h) => [...h, {
        role: 'assistant',
        content: err.response?.data?.message || 'Network error -- please retry.',
      }]);
    } finally {
      setAsking(false);
    }
  };

  if (loading || !doc) {
    return <PageSkeleton />;
  }

  const SourceIcon = doc.source_kind === 'url' ? Globe
                   : doc.source_kind === 'file' ? FileText : TypeIcon;
  const sourceLabel = doc.source_kind === 'url' ? doc.source_url
                    : doc.source_kind === 'file' ? doc.source_filename
                    : 'Pasted text';

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Back link */}
      <Link
        href={`/w/${wsId}/knowledge`}
        className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-300 mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to all training data
      </Link>

      {/* ── Header card ─────────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 flex items-center justify-center shrink-0">
            <SourceIcon className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-white">{doc.title}</h1>
            <div className="text-sm text-slate-400 mt-0.5 truncate" title={sourceLabel}>{sourceLabel}</div>
            <div className="flex items-center gap-3 mt-3 flex-wrap text-[12px]">
              {doc.status === 'ready' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10.5px] font-bold uppercase tracking-wider">
                  <CheckCircle2 className="w-3 h-3" /> Ready
                </span>
              )}
              {doc.status === 'error' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/15 text-red-300 border border-red-500/30 text-[10.5px] font-bold uppercase tracking-wider">
                  <AlertTriangle className="w-3 h-3" /> Error
                </span>
              )}
              {doc.embedding_model && (
                <span className="text-slate-500">
                  Embedded with <span className="text-slate-300">{doc.embedding_model}</span>
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Add more training data -- routes to the train page
                with this doc's KB id pre-attached. The train page
                reads ``?kb=<id>`` and pins all created Q&A pairs +
                documents to THAT specific KB, so they show up in
                this doc's chat playground (not the workspace default
                where they'd get lost). */}
            <Link
              href={
                doc.knowledge_base
                  ? `/w/${wsId}/knowledge/train?kb=${doc.knowledge_base}`
                  : `/w/${wsId}/knowledge/train`
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs text-white font-semibold"
              title="Train more data into the same knowledge base."
            >
              <Plus className="w-3.5 h-3.5" />
              Add more data
            </Link>
            <button
              onClick={retrain}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 hover:border-cyan-500/50 text-xs text-slate-300 hover:text-cyan-300"
              title="Re-chunk + re-embed using the current AI provider."
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retrain
            </button>
            <button
              onClick={remove}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 hover:border-red-500/50 text-xs text-slate-300 hover:text-red-300"
              title="Delete this training data permanently."
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </div>
        </div>

        {/* ── Stats row ────────────────────────────────────────── */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Chunks indexed" value={doc.chunk_count} />
          <Stat label="Total chars" value={doc.char_count.toLocaleString()} />
          <Stat label="Trained" value={new Date(doc.created_at).toLocaleDateString()} />
          <Stat label="Last updated" value={new Date(doc.updated_at).toLocaleDateString()} />
        </div>

        {doc.status === 'error' && doc.error_message && (
          <div className="mt-4 rounded-lg bg-red-500/[0.08] border border-red-500/30 px-3 py-2 text-[12px] text-red-200">
            <strong className="block mb-0.5">Ingest error:</strong>
            {doc.error_message}
          </div>
        )}

        {/* ── LLM picker for THIS knowledge base ────────────────────
            Per-KB model selection. Changing this PATCHes the KB row
            and every doc in the same KB inherits the new model on
            the next chat -- no retrain needed (we only re-route the
            chat-time LLM call, not the embedding model). */}
        {doc.knowledge_base && (
          <div className="mt-5 pt-5 border-t border-white/5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                  AI model for replies
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Used when this data answers a chat. Embeddings stay the same -- no retrain needed.
                </div>
              </div>
              {savingModel && (
                <div className="inline-flex items-center gap-1.5 text-[11px] text-cyan-300">
                  <div className="w-3 h-3 border-2 border-cyan-300 border-t-transparent rounded-full animate-spin" />
                  Saving…
                </div>
              )}
            </div>
            {availableModels.length === 0 ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.05] p-3 text-[12px] text-amber-100">
                No AI providers connected yet. Add one in{' '}
                <Link href={`/w/${wsId}/leads/credentials`} className="underline hover:text-amber-50">
                  Credentials
                </Link>{' '}
                to enable model picking.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {availableModels.map((m) => {
                  const active = kbModel === m.id;
                  // Show a small "(disconnected)" hint when the model
                  // matches the saved KB value but its provider isn't
                  // currently connected -- still selectable so the
                  // user knows what's set.
                  const providerConnected = connectedProviders.includes(m.provider);
                  return (
                    <button
                      key={m.id}
                      onClick={() => changeModel(m.id)}
                      disabled={savingModel}
                      className={`text-left rounded-lg border p-2.5 transition-colors disabled:opacity-50 ${
                        active
                          ? 'border-emerald-500/60 bg-emerald-500/[0.08]'
                          : 'border-white/10 bg-white/[0.02] hover:border-white/25'
                      }`}
                    >
                      <div className={`text-[12px] font-semibold flex items-center gap-1 ${active ? 'text-emerald-200' : 'text-white'}`}>
                        {m.name}
                        {!providerConnected && (
                          <span className="text-[9px] text-amber-300 font-normal" title="Provider not connected">
                            (no key)
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{m.hint}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Q&A pairs scoped to THIS knowledge base ───────────── */}
      {qaPairs.length > 0 && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-300" />
              <h2 className="text-sm font-bold text-white">Q&A pairs</h2>
              <span className="text-[11px] text-emerald-200/80">
                {qaPairs.length} pair{qaPairs.length === 1 ? '' : 's'} · instant replies, no LLM call
              </span>
            </div>
            <Link
              href={doc.knowledge_base ? `/w/${wsId}/knowledge/train?kb=${doc.knowledge_base}&mode=qa` : `/w/${wsId}/knowledge/train`}
              className="text-[11px] text-emerald-300 hover:text-emerald-200 inline-flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Add more
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {qaPairs.slice(0, 6).map((qa) => (
              <div
                key={qa.id}
                className="group/qa rounded-lg bg-white/[0.03] border border-white/5 p-3 relative"
              >
                {/* Hover-revealed delete button -- positioned absolutely
                    in the top-right so it doesn't shift the layout. */}
                <button
                  onClick={() => deleteQA(qa)}
                  className="absolute top-2 right-2 opacity-0 group-hover/qa:opacity-100 transition-opacity p-1 rounded text-slate-400 hover:text-rose-300 hover:bg-rose-500/10"
                  title="Delete this Q&A pair"
                  aria-label="Delete Q&A pair"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <div className="flex items-center justify-between mb-1.5 pr-7">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                    Match: {qa.match_mode}
                  </span>
                  {qa.hit_count > 0 && (
                    <span className="text-[10px] text-emerald-300">
                      🔥 {qa.hit_count} hit{qa.hit_count === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
                <div className="space-y-1 mb-2">
                  {qa.questions.slice(0, 3).map((q, i) => (
                    <div key={i} className="text-[12px] text-slate-300 font-mono truncate">{q}</div>
                  ))}
                  {qa.questions.length > 3 && (
                    <div className="text-[10px] text-slate-500">+ {qa.questions.length - 3} more phrasings</div>
                  )}
                </div>
                <div className="rounded-md bg-emerald-500/[0.10] border border-emerald-500/20 px-2 py-1.5 text-[12px] text-emerald-100">
                  {qa.answer.length > 140 ? qa.answer.slice(0, 140) + '...' : qa.answer}
                </div>
              </div>
            ))}
          </div>
          {qaPairs.length > 6 && (
            <div className="mt-2 text-center text-[11px] text-slate-500">
              Showing 6 of {qaPairs.length} pairs.
            </div>
          )}
        </div>
      )}

      {/* ── Two-column: chunks preview + chat playground ─────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chunks preview */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
          <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-300" />
              <h2 className="text-sm font-bold text-white">Indexed chunks</h2>
              <span className="text-[11px] text-slate-500">
                {doc.chunks_total != null ? `${doc.chunks?.length || 0} of ${doc.chunks_total}` : ''}
              </span>
            </div>
          </div>
          <div className="max-h-[480px] overflow-y-auto p-3 space-y-2">
            {(!doc.chunks || doc.chunks.length === 0) ? (
              <p className="text-center text-xs text-slate-500 py-8">
                No chunks indexed yet.
              </p>
            ) : (
              doc.chunks.slice(0, 30).map((c) => (
                <div key={c.id} className="rounded-lg bg-white/[0.02] border border-white/5 p-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono text-slate-500">#{c.position}</span>
                    <span className="text-[10px] text-slate-500">{c.token_count} tokens</span>
                  </div>
                  <p className="text-[12.5px] text-slate-300 leading-relaxed line-clamp-4">
                    {c.content}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Chat playground scoped to THIS document only ──── */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden flex flex-col">
          <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-300" />
            <h2 className="text-sm font-bold text-white">Chat playground</h2>
            <span className="text-[10.5px] text-slate-500">
              answers use ONLY this trained data
            </span>
          </div>

          {/* Conversation */}
          <div
            ref={chatRef}
            className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[400px] max-h-[480px]"
          >
            {history.length === 0 ? (
              <div className="text-xs text-slate-400 py-4 space-y-3">
                <div className="text-center">
                  <MessageCircle className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                  <p>Ask anything about <strong className="text-slate-300">{doc.title}</strong>.</p>
                </div>
                {/* Suggested questions -- generated from chunk content
                    keywords so the user has a real starting point
                    instead of staring at an empty composer. */}
                <SuggestedQuestions
                  chunks={doc.chunks || []}
                  onPick={(q) => { setQuestion(q); }}
                />
              </div>
            ) : (
              history.map((turn, i) => (
                <div key={i} className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] px-3.5 py-2 rounded-2xl text-[13.5px] leading-relaxed ${
                    turn.role === 'user'
                      ? 'bg-emerald-600 text-white rounded-br-md'
                      : 'bg-white/[0.06] text-slate-100 rounded-bl-md'
                  }`}>
                    <p className="whitespace-pre-wrap break-words">{turn.content}</p>
                    {turn.role === 'assistant' && turn.citations && turn.citations.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-white/10 space-y-1">
                        {turn.citations.slice(0, 3).map((c) => (
                          <div key={c.index} className="text-[10.5px] text-slate-400">
                            <span className="text-cyan-300 font-mono">[{c.index}]</span>{' '}
                            <span title={c.snippet}>{c.source || c.title}</span>{' '}
                            <span className="text-slate-500">· confidence {Math.round(c.score * 100)}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {turn.role === 'assistant' && turn.source === 'qa_pair' && (
                      <div className="mt-1 text-[10px] text-emerald-300/80">
                        ★ Direct Q&A match (no AI guessing)
                      </div>
                    )}
                    {turn.role === 'assistant' && turn.source === 'no_match' && (
                      <div className="mt-1 text-[10px] text-amber-300/80">
                        ⚠ Low confidence — answer was refused. Try a more specific question.
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

          {/* Composer */}
          <div className="px-3 py-3 border-t border-white/5 flex items-center gap-2">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); } }}
              disabled={asking}
              placeholder="Ask a question about this training data…"
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
        </div>
      </div>
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


/**
 * Suggested-questions helper — extracts likely user queries from the
 * trained chunk content so the empty chat composer has real starting
 * points. Heuristics:
 *
 *   1. Grab the first non-trivial sentences of each chunk.
 *   2. Pull out NOUN-LOOKING tokens (capitalised words, longer terms).
 *   3. Wrap them in template questions: "what is X?", "tell me about X",
 *      "how do I X" — that match common chatbot phrasings.
 *
 * This is intentionally simple (no LLM call needed). When the user
 * clicks a suggestion it pre-fills the composer so they can edit
 * before sending.
 */
function SuggestedQuestions({
  chunks, onPick,
}: {
  chunks: Array<{ content: string }>;
  onPick: (q: string) => void;
}) {
  // Pull key terms from the first few chunks. Capitalised multi-word
  // phrases are the highest-signal candidates (section headings,
  // product names, policy types).
  const text = chunks.slice(0, 3).map((c) => c.content).join(' ');
  const candidates = new Set<string>();
  // Match capitalised phrases of 1-3 words (e.g. "Refund Policy",
  // "Return Window", "ACME Corp").
  const phraseRe = /\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,}){0,2}\b/g;
  let m: RegExpExecArray | null;
  while ((m = phraseRe.exec(text)) !== null && candidates.size < 8) {
    const phrase = m[0].trim();
    if (phrase.split(' ').every((w) => w.length >= 3)) {
      candidates.add(phrase);
    }
  }

  const templates = [
    (k: string) => `What is the ${k.toLowerCase()}?`,
    (k: string) => `Tell me about ${k.toLowerCase()}`,
    (k: string) => `How does ${k.toLowerCase()} work?`,
  ];
  const suggestions: string[] = [];
  let i = 0;
  for (const phrase of candidates) {
    const tpl = templates[i % templates.length];
    suggestions.push(tpl(phrase));
    i += 1;
    if (suggestions.length >= 4) break;
  }
  // Fall through to generic questions when we couldn't extract any
  // capitalised phrases (short chunks, lowercase data).
  if (suggestions.length === 0) {
    suggestions.push(
      'What is this about?',
      'Give me a summary',
      'What are the key points?',
      'How do I get started?',
    );
  }

  return (
    <div>
      <p className="text-center text-[10.5px] text-slate-500 mb-2 uppercase tracking-wider font-semibold">
        Try one of these
      </p>
      <div className="flex flex-wrap gap-1.5 justify-center">
        {suggestions.map((q) => (
          <button
            key={q}
            onClick={() => onPick(q)}
            className="px-2.5 py-1 rounded-full bg-white/[0.05] hover:bg-cyan-500/15 border border-white/10 hover:border-cyan-500/40 text-[11px] text-slate-300 hover:text-cyan-200 transition-colors"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
