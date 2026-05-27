'use client';

import { useCallback, useEffect, useState, use as reactUse } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Plus, FileText, Globe, Type as TypeIcon, RefreshCw, Trash2, AlertTriangle,
  CheckCircle2, Brain, Sparkles, X, Database, ExternalLink, KeyRound,
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

function KnowledgeInner({ wsId }: { wsId: string }) {
  const searchParams = useSearchParams();
  const [docs, setDocs] = useState<KBDoc[]>([]);
  const [status, setStatus] = useState<KBStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [docsRes, statusRes] = await Promise.all([
        OrganizationService.kbListDocuments(),
        OrganizationService.kbStatus(),
      ]);
      if (docsRes?.success) setDocs(docsRes.data);
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
          <Link
            href={`/w/${wsId}/knowledge/chat`}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-sm font-semibold text-white"
          >
            <Sparkles className="w-4 h-4 text-cyan-300" />
            Chat playground
          </Link>
          <button
            onClick={() => setShowAdd(true)}
            disabled={status !== null && !status.ready}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            title={status && !status.ready ? status.message : undefined}
          >
            <Plus className="w-4 h-4" />
            Train new
          </button>
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
      ) : docs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center">
          <Brain className="w-10 h-10 mx-auto mb-3 text-slate-600" />
          <p className="text-sm text-slate-400">
            No documents trained yet. Click <strong>Train new</strong> to ingest your first one.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
    <article className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 flex items-center justify-center shrink-0">
          <SourceIcon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-white truncate">{doc.title}</h3>
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

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-white/[0.02] border border-white/5 p-2">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-xs font-semibold text-white truncate">{value}</div>
    </div>
  );
}

function AddDocumentModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [kind, setKind] = useState<'text' | 'url'>('text');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (kind === 'text' && !content.trim()) { toast.error('Paste some content first.'); return; }
    if (kind === 'url' && !url.trim()) { toast.error('Enter a URL.'); return; }
    setSaving(true);
    try {
      const res = await OrganizationService.kbCreateDocument({
        kind,
        title: title.trim() || undefined,
        content: kind === 'text' ? content : undefined,
        url: kind === 'url' ? url : undefined,
      });
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0a1020]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between px-6 py-5 border-b border-white/5">
          <div>
            <h2 className="text-xl font-bold text-white">Train AI on new data</h2>
            <p className="text-xs text-slate-400 mt-1">
              The content is chunked, embedded, and stored in your workspace&apos;s vector index.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-white/[0.06] text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Kind selector */}
          <div className="grid grid-cols-2 gap-3">
            {(['text', 'url'] as const).map((k) => {
              const active = kind === k;
              const Icon = k === 'text' ? TypeIcon : Globe;
              return (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className={`rounded-xl border p-3 text-left transition-colors flex items-center gap-3 ${
                    active ? 'border-cyan-500/60 bg-cyan-500/[0.08]' : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${active ? 'text-cyan-300' : 'text-slate-400'}`} />
                  <div>
                    <div className="text-sm font-semibold text-white">{k === 'text' ? 'Paste text' : 'Crawl URL'}</div>
                    <div className="text-[11px] text-slate-400">
                      {k === 'text' ? 'FAQs, brand voice, policies' : 'Public page or knowledge article'}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Title */}
          <div>
            <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-1">
              Title <span className="text-slate-500">(optional — auto-derived)</span>
            </div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Return policy, Q1 product launch FAQ"
              className="w-full rounded-xl bg-white/[0.02] border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50"
            />
          </div>

          {kind === 'text' ? (
            <div>
              <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-1">Content</div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={12}
                placeholder="Paste anything — handbook, FAQ pairs, product specs, brand voice, sample replies."
                className="w-full rounded-xl bg-[#080e1c] border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 resize-none font-mono leading-relaxed"
              />
              <div className="mt-1 text-[10.5px] text-slate-500">
                {content.length.toLocaleString()} characters
              </div>
            </div>
          ) : (
            <div>
              <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-1">URL</div>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://acme.com/faq"
                className="w-full rounded-xl bg-white/[0.02] border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50"
              />
              <div className="mt-1 text-[10.5px] text-slate-500">
                We fetch the page, strip HTML, and embed the extracted text. Max 2 MB per page.
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/5">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-white/[0.04]">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="px-5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-50 inline-flex items-center gap-2"
          >
            {saving ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Embedding…</>
            ) : (
              <><Plus className="w-4 h-4" /> Train</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
