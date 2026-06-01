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
  AlertTriangle, CheckCircle2, Send, Sparkles, MessageCircle,
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
  created_at: string;
  updated_at: string;
  chunks?: Array<{ id: number; position: number; content: string; token_count: number }>;
  chunks_total?: number;
};

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
  const [loading, setLoading] = useState(true);
  // Chat state -- in-memory only. Reload the page to clear.
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const chatRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await OrganizationService.kbGetDocument(Number(docId));
      if (res?.success) setDoc(res.data);
    } finally { setLoading(false); }
  }, [docId]);

  useEffect(() => { load(); }, [load]);

  // Auto-scroll chat to the latest turn.
  useEffect(() => {
    const el = chatRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [history.length]);

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
      </div>

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
              <div className="text-center text-xs text-slate-500 py-8">
                <MessageCircle className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                <p>Ask anything about <strong className="text-slate-300">{doc.title}</strong>.</p>
                <p className="mt-1 text-[10.5px]">
                  Try: "what is this about?", "give me a summary", "what are the key points?"
                </p>
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
