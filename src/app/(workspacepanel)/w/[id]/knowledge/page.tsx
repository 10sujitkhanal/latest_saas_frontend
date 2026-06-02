'use client';

import { useCallback, useEffect, useRef, useState, use as reactUse } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Plus, FileText, Globe, Type as TypeIcon, RefreshCw, Trash2, AlertTriangle,
  CheckCircle2, Brain, Sparkles, X, Database, ExternalLink, KeyRound,
  FileUp,
} from 'lucide-react';
import { toast } from 'sonner';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import QuotaBadge from '@/components/QuotaBadge';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { OrganizationService } from '@/services/organization.service';

/**
 * Knowledge Base — train AI on your own data + manage trained documents.
 *
 * Flow:
 *   1. Connect an OpenAI (or Cohere/Anthropic) credential on /leads/credentials.
 *   2. Upload a document (paste text or crawl a URL).
 *   3. The backend chunks + embeds it; status flips from PROCESSING → READY.
 *   4. Click "Chat playground" to ask questions; the answer cites the
 *      sources it pulled from.
 */

interface KBDoc {
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
}

interface KBStatus {
  ready: boolean;
  // ``degraded`` = a credential row exists but the provider rejected
  // the key (401 / forbidden / "api_key" in the error message), so
  // training will keep failing until the user fixes it. Backend sets
  // this when recent docs all errored with an auth-style message.
  degraded?: boolean;
  last_auth_error?: string;
  embedding_provider: string | null;
  chat_provider: string | null;
  document_count: number;
  ready_document_count: number;
  chunk_count: number;
  message: string;
}

export default function KnowledgePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard required="crm.leads_view" workspaceId={wsId} skeleton="grid">
      <KnowledgeInner wsId={wsId} />
    </PermissionGuard>
  );
}

type KBBase = {
  id: number;
  name: string;
  description: string;
  model: string;
  color: string;
  is_active: boolean;
  document_count: number;
  qa_count: number;
  chunk_count: number;
  created_at: string;
  updated_at: string;
};

function KnowledgeInner({ wsId }: { wsId: string }) {
  const searchParams = useSearchParams();
  const [docs, setDocs] = useState<KBDoc[]>([]);
  // KnowledgeBase rows -- shown as their own card type so Q&A
  // collections show up alongside trained documents. Each KB card
  // links into the same detail flow + tells the user how many docs
  // AND Q&A pairs live inside.
  const [bases, setBases] = useState<KBBase[]>([]);
  const [status, setStatus] = useState<KBStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [docsRes, basesRes, statusRes] = await Promise.all([
        OrganizationService.kbListDocuments(),
        OrganizationService.kbListBases().catch(() => null),
        OrganizationService.kbStatus(),
      ]);
      if (docsRes?.success) setDocs(docsRes.data);
      // Show EVERY KB as its own card (was previously filtered to
      // KBs with at least one Q&A pair). Surfacing all KBs lets the
      // user click into any of them to see their full content -- docs,
      // Q&A pairs, and chat -- not just the ones that happen to have
      // direct-match rules trained.
      if (basesRes?.success) {
        setBases(basesRes.data as KBBase[]);
      }
      if (statusRes?.success) setStatus(statusRes.data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (searchParams?.get('new') === '1') setShowAdd(true);
  }, [searchParams]);

  const remove = async (d: KBDoc) => {
    if (!confirm(`Delete "${d.title}"? This removes all its embedded chunks.`)) return;
    const res = await OrganizationService.kbDeleteDocument(d.id);
    if (res?.success) { toast.success('Deleted'); load(); }
  };

  const retrain = async (d: KBDoc) => {
    toast.loading('Re-embedding…', { id: `retrain-${d.id}` });
    const res = await OrganizationService.kbRetrainDocument(d.id);
    toast.dismiss(`retrain-${d.id}`);
    if (res?.success) { toast.success('Re-trained'); load(); }
    else toast.error(res?.message || 'Retrain failed');
  };

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-white inline-flex items-center gap-3 flex-wrap">
            <Database className="w-7 h-7 text-cyan-300" />
            Knowledge Base
            <QuotaBadge quota="knowledge_docs" label="documents" />
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Train the AI on your own company data — handbooks, FAQs, policies, web pages, past conversations.
            Then customers get grounded, accurate answers based on what you actually told the AI.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Chat playground moved INSIDE each KB (per-KB scoping).
              The old global chat button used to send queries across
              ALL workspace docs which leaked context between KBs.
              Now clicking a KB card opens its scoped chat tab. */}
          {/* Train new -- now navigates to the full-page training
              experience (was a popup modal). The page route shows
              live samples for each mode + the LLM picker without
              fighting for vertical space inside a modal. */}
          <Link
            href={`/w/${wsId}/knowledge/train`}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-500/20 ${
              (status !== null && !status.ready) ? 'opacity-50 pointer-events-none' : ''
            }`}
            title={status && !status.ready ? status.message : undefined}
            aria-disabled={status !== null && !status.ready}
          >
            <Plus className="w-4 h-4" />
            Train new
          </Link>
        </div>
      </div>

      {/* Readiness strip — three states:
          1. ``ready``    → green. Provider connected and at least one
                            doc has finished embedding (or none have
                            failed). Safe to train.
          2. ``degraded`` → red. A credential row exists but the
                            provider rejected the API key; training
                            will keep failing until the user updates
                            the key on Credentials.
          3. neither      → amber. No provider connected yet. */}
      {status && (
        status.degraded ? (
          <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/[0.06] p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-300 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white">
                {status.embedding_provider
                  ? `Your ${status.embedding_provider} key was rejected`
                  : 'AI provider credentials are broken'}
              </div>
              <p className="text-xs text-slate-300 mt-1">{status.message}</p>
              {status.last_auth_error && (
                <p className="text-[11px] text-red-200/70 mt-1 italic">
                  Provider said: “{status.last_auth_error}”
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                <Link
                  href={`/w/${wsId}/leads/credentials`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-400 text-white text-xs font-semibold"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  Fix credentials
                </Link>
                <span className="text-[11px] text-slate-400 self-center">
                  Then click <strong>Train new</strong> again — old failed docs can be retried from their card.
                </span>
              </div>
            </div>
          </div>
        ) : status.ready ? (
          <div className="mb-5 rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.06] via-cyan-500/[0.04] to-transparent p-4 flex items-center gap-4">
            <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white">
                {status.message}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Embeddings via <strong>{status.embedding_provider}</strong> · Chat via <strong>{status.chat_provider}</strong> ·
                {' '}{status.ready_document_count} of {status.document_count} documents ready · {status.chunk_count} chunks indexed.
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/[0.05] p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white">Set up an AI provider to start training</div>
              <p className="text-xs text-slate-300 mt-1">{status.message}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Link
                  href={`/w/${wsId}/leads/credentials`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open Credentials
                </Link>
                <span className="text-[11px] text-slate-400 self-center">
                  Embeddings: OpenAI or Cohere · Chat: OpenAI or Anthropic.
                </span>
              </div>
            </div>
          </div>
        )
      )}

      {loading ? (
        <PageSkeleton kind="grid" />
      ) : docs.length === 0 && bases.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center">
          <Brain className="w-10 h-10 mx-auto mb-3 text-slate-600" />
          <p className="text-sm text-slate-400">
            No training data yet. Click <strong>Train new</strong> to add your first Q&A pairs or document.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {/* Q&A pair collections shown FIRST -- they're the most
              accurate training type and the most-edited surface, so
              they belong at the top of the list visually. */}
          {bases.map((kb) => (
            <QACollectionCard key={`qa-${kb.id}`} kb={kb} wsId={wsId} />
          ))}
          {docs.map((d) => (
            <DocCard key={d.id} doc={d} wsId={wsId} onDelete={() => remove(d)} onRetrain={() => retrain(d)} />
          ))}
        </div>
      )}

      {showAdd && (
        <AddDocumentModal
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); load(); }}
        />
      )}
    </div>
  );
}

function DocCard({ doc, wsId, onDelete, onRetrain }: {
  doc: KBDoc;
  wsId: string;
  onDelete: () => void;
  onRetrain: () => void;
}) {
  const statusMeta = {
    pending:    { color: '#94a3b8', label: 'Pending',    Icon: RefreshCw },
    processing: { color: '#06b6d4', label: 'Processing', Icon: RefreshCw },
    ready:      { color: '#10b981', label: 'Ready',      Icon: CheckCircle2 },
    error:      { color: '#ef4444', label: 'Error',      Icon: AlertTriangle },
  }[doc.status];
  const StatusIcon = statusMeta.Icon;
  const SourceIcon = doc.source_kind === 'url' ? Globe
                   : doc.source_kind === 'file' ? FileText : TypeIcon;
  const sourceLabel = doc.source_kind === 'url' ? doc.source_url
                    : doc.source_kind === 'file' ? doc.source_filename
                    : 'Pasted text';

  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 hover:border-cyan-500/40 hover:bg-white/[0.04] transition-colors cursor-pointer group"
      onClick={(e) => {
        // Don't intercept clicks on the action buttons (retrain / delete)
        // -- only navigate when the card body itself is clicked.
        const target = e.target as HTMLElement;
        if (target.closest('button, a, [data-stop-nav]')) return;
        if (typeof window !== 'undefined') {
          window.location.href = `/w/${wsId}/knowledge/${doc.id}`;
        }
      }}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 flex items-center justify-center shrink-0">
          <SourceIcon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-white truncate group-hover:text-cyan-200">{doc.title}</h3>
          <div className="text-[11px] text-slate-400 mt-0.5 truncate" title={sourceLabel}>{sourceLabel}</div>
        </div>
        <span
          className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-md"
          style={{ backgroundColor: `${statusMeta.color}22`, color: statusMeta.color, border: `1px solid ${statusMeta.color}55` }}
        >
          <StatusIcon className={`w-3 h-3 ${doc.status === 'processing' ? 'animate-spin' : ''}`} />
          {statusMeta.label}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat label="Chunks" value={doc.chunk_count} />
        <Stat label="Chars" value={doc.char_count.toLocaleString()} />
        <Stat label="Trained" value={new Date(doc.created_at).toLocaleDateString()} />
      </div>

      {doc.status === 'error' && doc.error_message && (() => {
        // Detect "credential" errors (401 / API key / Unauthorized
        // wording from any provider) so we can show a "Fix credentials"
        // CTA instead of leaving the user staring at an opaque message.
        const msg = doc.error_message;
        const isAuthError = /401|unauthor|api[\s_-]*key|access.*forbidden|forbidden|credential/i.test(msg);
        const isNoProvider = /no embedding provider connected/i.test(msg);
        return (
          <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/[0.05] p-3 text-[11.5px] text-red-200 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <p className="leading-snug">{msg}</p>
            </div>
            {(isAuthError || isNoProvider) && (
              <div className="flex items-center gap-2 pt-1">
                <Link
                  href={`/w/${wsId}/leads/credentials`}
                  className="px-2.5 py-1 rounded-md bg-red-500/20 hover:bg-red-500/30 text-red-100 text-[11px] font-semibold inline-flex items-center gap-1"
                >
                  <KeyRound className="w-3 h-3" />
                  {isNoProvider ? 'Connect an AI provider' : 'Fix credentials'}
                </Link>
                <button
                  onClick={onRetrain}
                  className="px-2.5 py-1 rounded-md border border-white/10 text-slate-200 text-[11px] font-semibold inline-flex items-center gap-1 hover:bg-white/[0.04]"
                >
                  <RefreshCw className="w-3 h-3" />
                  Retry training
                </button>
              </div>
            )}
          </div>
        );
      })()}

      <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
        <span className="text-[10px] text-slate-500 italic">{doc.embedding_model || '—'}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={onRetrain}
            title="Re-embed this document"
            className="p-1.5 rounded text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/[0.08]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded text-slate-500 hover:text-red-300 hover:bg-red-500/[0.08]"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
}

/**
 * Card for a knowledge-base's Q&A collection. Surfaces:
 *   - Total Q&A pair count + total hit count (telemetry)
 *   - Direct link into the train flow with this KB pre-selected
 *   - LLM model the KB is pinned to (so users see at a glance)
 *
 * Lives on the main KB list page next to the document cards so Q&A
 * collections aren't buried -- they're the most accurate training
 * type and operators edit them most often.
 */
function QACollectionCard({ kb, wsId }: { kb: KBBase; wsId: string }) {
  // Card → KB detail page (NOT the train page) so the click reveals
  // the FULL contents of the KB (docs + Q&A + chat + delete controls).
  // Only the explicit "+ Add more" pill inside the card jumps to the
  // train flow with the right KB pre-selected.
  return (
    <article className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.06] to-emerald-500/[0.01] p-5 hover:border-emerald-400/60 hover:from-emerald-500/[0.10] transition-colors cursor-pointer group"
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest('button, a, [data-stop-nav]')) return;
        if (typeof window !== 'undefined') {
          window.location.href = `/w/${wsId}/knowledge/kb/${kb.id}`;
        }
      }}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-white truncate group-hover:text-emerald-200">
            {kb.name} · Q&A pairs
          </h3>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Instant replies · no LLM call · 100% confidence
          </div>
        </div>
        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-md bg-emerald-500/20 text-emerald-200 border border-emerald-500/40">
          <CheckCircle2 className="w-3 h-3" />
          Active
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat label="Q&A pairs" value={kb.qa_count} />
        <Stat label="Documents" value={kb.document_count} />
        <Stat label="Chunks" value={kb.chunk_count} />
      </div>

      <div className="mt-3 pt-3 border-t border-emerald-500/20 flex items-center justify-between">
        <span className="text-[11px] italic text-slate-400 truncate" title={`Replies via ${kb.model}`}>
          {kb.model}
        </span>
        <Link
          href={`/w/${wsId}/knowledge/train?kb=${kb.id}&mode=qa`}
          data-stop-nav
          className="text-[11px] text-emerald-300 hover:text-emerald-200 inline-flex items-center gap-1"
        >
          <Plus className="w-3 h-3" /> Add more
        </Link>
      </div>
    </article>
  );
}


function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-white/[0.02] border border-white/5 p-2">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-xs font-semibold text-white truncate">{value}</div>
    </div>
  );
}

type TrainMode = 'qa' | 'text' | 'file' | 'url';

/**
 * Redesigned training modal.
 *
 * Four modes laid out as big, equal-weight cards across the top so
 * the user picks the SHAPE of their data first ("Q&A pair" /
 * "Paste text" / "Upload file" / "Crawl URL") and the form below
 * adapts. The previous design only exposed Paste text + Crawl URL,
 * which forced users to encode FAQ pairs as freeform prose -- the
 * RAG layer's worst-case input.
 *
 * The Q&A mode is FIRST because it's the single biggest accuracy
 * lever: for greetings, fixed FAQs, and price questions, a hand-
 * written Q&A pair beats embedding-fuzzy retrieval 100% of the time
 * AND burns zero LLM tokens.
 */
function AddDocumentModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [mode, setMode] = useState<TrainMode>('qa');
  // LLM that will be used to answer questions about this training data.
  // Set on the KB row when we create / update -- chat replies for this
  // KB use whichever model is picked here. Defaults to the cheap-and-
  // fast OpenAI option; Ollama for fully on-prem; Claude for nuance.
  const [llmModel, setLlmModel] = useState<string>('gpt-4o-mini');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  // Q&A state -- list of {question patterns (newline-separated), answer}.
  // Pre-seeded with one empty row so the form looks "lived in" and the
  // user can start typing immediately without clicking Add.
  type QAPair = { questions: string; answer: string };
  const [qaPairs, setQaPairs] = useState<QAPair[]>([{ questions: '', answer: '' }]);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const addQA = () => setQaPairs((rows) => [...rows, { questions: '', answer: '' }]);
  const updateQA = (i: number, patch: Partial<QAPair>) =>
    setQaPairs((rows) => rows.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  const removeQA = (i: number) =>
    setQaPairs((rows) => rows.length === 1 ? [{ questions: '', answer: '' }] : rows.filter((_, idx) => idx !== i));

  const submit = async () => {
    // ── Per-mode validation -- friendly messages instead of "missing field"
    if (mode === 'qa') {
      const valid = qaPairs.filter((r) => r.questions.trim() && r.answer.trim());
      if (valid.length === 0) {
        toast.error('Add at least one Q&A pair with a question AND an answer.');
        return;
      }
    }
    if (mode === 'text' && !content.trim()) { toast.error('Paste some content first.'); return; }
    if (mode === 'url' && !url.trim())       { toast.error('Enter a URL.'); return; }
    if (mode === 'file' && !file)            { toast.error('Pick a file to upload.'); return; }

    setSaving(true);
    try {
      let res;
      if (mode === 'qa') {
        // Q&A pairs go to the bulk endpoint -- each row becomes one
        // KnowledgeQA record. ``questions`` is split on newlines so
        // the user can type alternative phrasings one per line:
        //     hello
        //     hi
        //     good morning
        // → all three trigger the same answer.
        const pairs = qaPairs
          .filter((r) => r.questions.trim() && r.answer.trim())
          .map((r) => ({
            questions: r.questions.split('\n').map((q) => q.trim()).filter(Boolean),
            answer:    r.answer.trim(),
            match_mode: 'contains' as const,
          }));
        res = await OrganizationService.kbCreateQAPairs(pairs);
      } else if (mode === 'file' && file) {
        res = await OrganizationService.kbUploadFile({
          file, title: title.trim() || undefined,
        });
      } else {
        res = await OrganizationService.kbCreateDocument({
          kind: mode,
          title: title.trim() || undefined,
          content: mode === 'text' ? content : undefined,
          url:     mode === 'url'  ? url     : undefined,
        });
      }
      if (res?.success) {
        toast.success(res.message || 'Trained.');
        onSaved();
      } else {
        toast.error(res?.message || 'Training failed');
      }
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Training failed');
    } finally { setSaving(false); }
  };

  // The four mode chips, in priority order. Q&A is intentionally first
  // because it's the highest-accuracy path for FAQ-style questions.
  const modes: { id: TrainMode; label: string; tagline: string; icon: typeof TypeIcon }[] = [
    { id: 'qa',   label: 'Q&A pairs',  tagline: 'Greetings, FAQs, fixed replies',     icon: Sparkles },
    { id: 'text', label: 'Paste text', tagline: 'Handbook, policies, brand voice',    icon: TypeIcon },
    { id: 'file', label: 'Upload file', tagline: 'PDF, DOCX, TXT, Markdown',          icon: FileUp },
    { id: 'url',  label: 'Crawl URL',  tagline: 'Public page or knowledge article',   icon: Globe },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-[#0a1020] my-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between px-6 py-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/30 to-emerald-500/30 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-cyan-200" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Train your AI</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Pick the shape of your data — we&apos;ll handle the chunking, embedding, and retrieval.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-white/[0.06] text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* ── Mode picker -- 4 equal-weight cards ─────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {modes.map((m) => {
              const active = mode === m.id;
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`relative rounded-xl border p-3 text-left transition-all ${
                    active
                      ? 'border-cyan-500/70 bg-cyan-500/[0.10] shadow-[0_0_0_3px_rgba(34,211,238,0.10)]'
                      : 'border-white/10 bg-white/[0.02] hover:border-white/25'
                  }`}
                >
                  <Icon className={`w-5 h-5 mb-2 ${active ? 'text-cyan-300' : 'text-slate-400'}`} />
                  <div className="text-[13px] font-semibold text-white">{m.label}</div>
                  <div className="text-[10.5px] text-slate-400 mt-0.5 leading-tight">{m.tagline}</div>
                  {m.id === 'qa' && !active && (
                    <span className="absolute top-2 right-2 text-[9px] font-bold text-emerald-300 bg-emerald-500/15 px-1.5 py-0.5 rounded-full">
                      MOST ACCURATE
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Mode-specific form body ─────────────────────────── */}
          {mode === 'qa' && (
            <div className="space-y-3">
              <div className="rounded-lg bg-emerald-500/[0.06] border border-emerald-500/20 px-3 py-2.5 text-[12px] text-emerald-100/90 leading-relaxed">
                <strong className="text-emerald-300">Tip:</strong> Type alternative phrasings one per line.
                When ANY of them matches what the user typed, the answer fires instantly — no AI guessing.
              </div>
              {qaPairs.map((pair, i) => (
                <div key={i} className="rounded-xl border border-white/10 bg-white/[0.015] p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                      Pair {i + 1}
                    </div>
                    {qaPairs.length > 1 && (
                      <button onClick={() => removeQA(i)} className="text-[11px] text-rose-300 hover:text-rose-200">
                        Remove
                      </button>
                    )}
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-1">
                      Questions (one per line)
                    </div>
                    <textarea
                      value={pair.questions}
                      onChange={(e) => updateQA(i, { questions: e.target.value })}
                      rows={3}
                      placeholder={'hello\nhi\nhey\ngood morning'}
                      className="w-full rounded-lg bg-[#080e1c] border border-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 resize-none"
                    />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-1">
                      Answer
                    </div>
                    <textarea
                      value={pair.answer}
                      onChange={(e) => updateQA(i, { answer: e.target.value })}
                      rows={2}
                      placeholder="Hi there! 👋 How can I help you today?"
                      className="w-full rounded-lg bg-[#080e1c] border border-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 resize-none"
                    />
                  </div>
                </div>
              ))}
              <button
                onClick={addQA}
                className="w-full rounded-lg border border-dashed border-white/15 hover:border-cyan-500/40 py-2.5 text-[12.5px] text-slate-400 hover:text-cyan-300 inline-flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Add another Q&A pair
              </button>
            </div>
          )}

          {mode === 'text' && (
            <>
              <div>
                <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-1">
                  Title <span className="text-slate-500">(optional)</span>
                </div>
                <input
                  value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Return policy, Q1 product launch FAQ"
                  className="w-full rounded-xl bg-white/[0.02] border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50"
                />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-1">Content</div>
                <textarea
                  value={content} onChange={(e) => setContent(e.target.value)}
                  rows={12}
                  placeholder="Paste anything — handbook, policies, product specs, brand voice."
                  className="w-full rounded-xl bg-[#080e1c] border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 resize-none font-mono leading-relaxed"
                />
                <div className="mt-1 text-[10.5px] text-slate-500">
                  {content.length.toLocaleString()} characters · we&apos;ll split into ~500-char chunks with overlap
                </div>
              </div>
            </>
          )}

          {mode === 'file' && (
            <>
              <div>
                <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-1">
                  Title <span className="text-slate-500">(optional — defaults to filename)</span>
                </div>
                <input
                  value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. 2026 Pricing Sheet"
                  className="w-full rounded-xl bg-white/[0.02] border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50"
                />
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt,.md"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full rounded-xl border-2 border-dashed border-white/15 hover:border-cyan-500/50 bg-white/[0.01] py-10 text-center transition-colors"
                >
                  <FileUp className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                  {file ? (
                    <>
                      <div className="text-sm font-semibold text-white">{file.name}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {(file.size / 1024).toFixed(1)} KB · click to change
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-sm font-semibold text-white">Click to upload a file</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">PDF · DOCX · TXT · MD · max 10 MB</div>
                    </>
                  )}
                </button>
              </div>
            </>
          )}

          {mode === 'url' && (
            <>
              <div>
                <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-1">
                  Title <span className="text-slate-500">(optional — auto-derived)</span>
                </div>
                <input
                  value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. ACME Help Center"
                  className="w-full rounded-xl bg-white/[0.02] border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50"
                />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-1">URL</div>
                <input
                  value={url} onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://acme.com/faq"
                  className="w-full rounded-xl bg-white/[0.02] border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50"
                />
                <div className="mt-1 text-[10.5px] text-slate-500">
                  We fetch the page, strip HTML, and embed the extracted text. Max 2 MB per page.
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── LLM picker ─────────────────────────────────────────
            Which model answers questions about THIS training data.
            Hidden for Q&A-only mode (Q&A pairs are direct-match and
            don't call an LLM at all). Stored on the KB row so chat
            replies for THIS data use the chosen model. */}
        {mode !== 'qa' && (
          <div className="px-6 pb-5 border-t border-white/5 pt-5">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-2">
              AI model for replies on this data
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: 'gpt-4o-mini',           name: 'GPT-4o mini',  hint: 'Fast + cheap (recommended)' },
                { id: 'gpt-4o',                name: 'GPT-4o',       hint: 'Best quality, slower' },
                { id: 'claude-3-5-sonnet',     name: 'Claude Sonnet', hint: 'Nuanced, long context' },
                { id: 'gemini-1.5-flash',      name: 'Gemini Flash',  hint: 'Fast, free tier' },
                { id: 'llama3.2',              name: 'Llama 3.2',     hint: 'Self-hosted via Ollama' },
                { id: 'llama-3.1-70b-versatile', name: 'Llama 70B (Groq)', hint: 'Sub-200ms inference' },
              ].map((m) => {
                const active = llmModel === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setLlmModel(m.id)}
                    type="button"
                    className={`text-left rounded-lg border p-2.5 transition-colors ${
                      active
                        ? 'border-emerald-500/60 bg-emerald-500/[0.08]'
                        : 'border-white/10 bg-white/[0.02] hover:border-white/25'
                    }`}
                  >
                    <div className={`text-[12px] font-semibold ${active ? 'text-emerald-200' : 'text-white'}`}>
                      {m.name}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{m.hint}</div>
                  </button>
                );
              })}
            </div>
            <div className="text-[10.5px] text-slate-500 mt-2">
              You can change this later from the knowledge-base detail page.
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-white/5">
          <div className="text-[11px] text-slate-500">
            {mode === 'qa' && (
              <>Direct match — instant reply, zero LLM tokens.</>
            )}
            {mode !== 'qa' && (
              <>Chunked + embedded into the vector index · model: <span className="text-slate-300">{llmModel}</span></>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-white/[0.04]">
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={saving}
              className="px-5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-50 inline-flex items-center gap-2"
            >
              {saving ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {mode === 'qa' ? 'Saving…' : 'Embedding…'}</>
              ) : (
                <><Plus className="w-4 h-4" /> {mode === 'qa' ? 'Save pairs' : 'Train'}</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
