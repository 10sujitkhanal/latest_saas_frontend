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
  { id: 'gpt-4o-mini',             name: 'GPT-4o mini',      hint: 'Fast + cheap', provider: 'openai' },
  { id: 'gpt-4o',                  name: 'GPT-4o',           hint: 'Best quality', provider: 'openai' },
  { id: 'claude-3-5-sonnet',       name: 'Claude Sonnet',    hint: 'Nuanced',      provider: 'anthropic' },
  { id: 'gemini-1.5-flash',        name: 'Gemini Flash',     hint: 'Free tier',    provider: 'gemini' },
  { id: 'llama3.2',                name: 'Llama 3.2 Ollama', hint: 'Self-hosted',  provider: 'ollama' },
  { id: 'llama-3.1-70b-versatile', name: 'Llama 70B Groq',   hint: 'Sub-200ms',    provider: 'groq' },
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
  const chatRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await OrganizationService.kbGetBase(Number(kbId));
      if (res?.success) setKb(res.data);
    } finally { setLoading(false); }
  }, [kbId]);

  useEffect(() => { load(); }, [load]);

  // Connected provider kinds → filters the LLM picker.
  useEffect(() => {
    OrganizationService.listChannels().then((res) => {
      if (res?.success && Array.isArray(res.data)) {
        const kinds = new Set<string>();
        for (const ch of res.data as Array<{ kind: string; is_active: boolean; is_connected: boolean }>) {
          if (ch.is_active !== false && ch.is_connected !== false) kinds.add(ch.kind);
        }
        setConnectedProviders(Array.from(kinds));
      }
    }).catch(() => {});
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

  const deleteQA = async (qa: { id: number; questions: string[]; answer: string }) => {
    const first = qa.questions[0] || '(empty)';
    if (!window.confirm(`Delete this Q&A pair?\n"${first}" → "${qa.answer.slice(0, 60)}…"`)) return;
    const res = await OrganizationService.kbDeleteQA(qa.id);
    if (res?.success) {
      if (kb) {
        setKb({
          ...kb,
          qa_pairs: (kb.qa_pairs || []).filter((p) => p.id !== qa.id),
          qa_count: Math.max(0, (kb.qa_count || 1) - 1),
        });
      }
      toast.success('Q&A pair deleted.');
    } else { toast.error(res?.message || 'Delete failed.'); }
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
            <h1 className="text-2xl font-bold text-white">{kb.name}</h1>
            {kb.description && (
              <p className="text-sm text-slate-400 mt-1">{kb.description}</p>
            )}
            <div className="flex items-center gap-3 mt-3 text-[12px] text-slate-400">
              <span>Created {new Date(kb.created_at).toLocaleDateString()}</span>
              <span>·</span>
              <span>Updated {new Date(kb.updated_at).toLocaleDateString()}</span>
            </div>
          </div>
          <div className="shrink-0">
            {/* "Add more" -> full train page with this KB pre-selected.
                When called from inside a KB detail page like this, the
                user is already committed to a specific KB so we route
                them straight to the full-power train page instead of
                a cramped modal -- they can pick mode + load samples +
                inspect sidebar guidance. */}
            <Link
              href={`/w/${wsId}/knowledge/train?kb=${kb.id}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold"
            >
              <Plus className="w-4 h-4" />
              Add more data
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          <Stat label="Q&A pairs" value={kb.qa_count} />
          <Stat label="Documents" value={kb.document_count} />
          <Stat label="Chunks" value={kb.chunk_count} />
        </div>

        {/* LLM picker -- only visible providers (with current always shown) */}
        <div className="mt-5 pt-5 border-t border-white/5">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-2">
            AI model for replies
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {availableModels.map((m) => {
              const active = kb.model === m.id;
              const connected = connectedProviders.includes(m.provider);
              return (
                <button
                  key={m.id}
                  onClick={() => changeModel(m.id)}
                  disabled={savingModel}
                  className={`text-left rounded-lg border p-2.5 transition-colors disabled:opacity-50 ${
                    active ? 'border-emerald-500/60 bg-emerald-500/[0.08]' : 'border-white/10 bg-white/[0.02] hover:border-white/25'
                  }`}
                >
                  <div className={`text-[12px] font-semibold flex items-center gap-1 ${active ? 'text-emerald-200' : 'text-white'}`}>
                    {m.name}
                    {!connected && (
                      <span className="text-[9px] text-amber-300 font-normal">(no key)</span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{m.hint}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Q&A pairs (full list, deletable inline) ────────────── */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-300" />
            <h2 className="text-sm font-bold text-white">Q&A pairs</h2>
            <span className="text-[11px] text-slate-400">
              {(kb.qa_pairs || []).length} pair{(kb.qa_pairs || []).length === 1 ? '' : 's'} · instant replies, no LLM call
            </span>
          </div>
          <Link
            href={`/w/${wsId}/knowledge/train?kb=${kb.id}&mode=qa`}
            className="text-[11px] text-emerald-300 hover:text-emerald-200 inline-flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Add Q&A
          </Link>
        </div>
        {(kb.qa_pairs || []).length === 0 ? (
          <p className="text-center text-xs text-slate-500 py-6">
            No Q&A pairs yet. Click <strong>+ Add Q&A</strong> to create instant-reply rules.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(kb.qa_pairs || []).map((qa) => (
              <div key={qa.id} className="group/qa rounded-lg bg-white/[0.03] border border-white/5 p-3 relative">
                <button
                  onClick={() => deleteQA(qa)}
                  className="absolute top-2 right-2 opacity-0 group-hover/qa:opacity-100 transition-opacity p-1 rounded text-slate-400 hover:text-rose-300 hover:bg-rose-500/10"
                  title="Delete this Q&A pair"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <div className="flex items-center justify-between mb-1.5 pr-7">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                    Match: {qa.match_mode}
                  </span>
                  {qa.hit_count > 0 && (
                    <span className="text-[10px] text-emerald-300">🔥 {qa.hit_count}</span>
                  )}
                </div>
                <div className="space-y-1 mb-2">
                  {qa.questions.slice(0, 3).map((q, i) => (
                    <div key={i} className="text-[12px] text-slate-300 font-mono truncate">{q}</div>
                  ))}
                  {qa.questions.length > 3 && (
                    <div className="text-[10px] text-slate-500">+ {qa.questions.length - 3} more</div>
                  )}
                </div>
                <div className="rounded-md bg-emerald-500/[0.10] border border-emerald-500/20 px-2 py-1.5 text-[12px] text-emerald-100">
                  {qa.answer.length > 140 ? qa.answer.slice(0, 140) + '...' : qa.answer}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

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
            <Link href={`/w/${wsId}/knowledge/${d.id}`} className="flex-1 min-w-0 cursor-pointer">
              <div className="text-sm font-semibold text-white truncate hover:text-cyan-200">{d.title}</div>
              <div className="text-[11px] text-slate-400 truncate">
                {d.source_filename || d.source_url || d.source_kind} · {d.chunk_count} chunks · {d.char_count.toLocaleString()} chars
              </div>
            </Link>
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
