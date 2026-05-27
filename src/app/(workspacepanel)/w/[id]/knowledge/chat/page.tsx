'use client';

import { useEffect, useRef, useState, use as reactUse } from 'react';
import Link from 'next/link';
import {
  Send, Sparkles, Database, ArrowLeft, FileText, AlertTriangle,
  Brain, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { OrganizationService } from '@/services/organization.service';

/**
 * RAG Chat playground.
 *
 * Two modes (toggle pill at top):
 *   - Knowledge base (RAG) — AI grounds its answer in your trained docs,
 *     and lists the sources it used.
 *   - Plain AI — vanilla LLM call with no retrieval.
 *
 * The same /knowledge/chat/ endpoint serves both; the toggle just flips
 * `use_kb`. Useful for A/B sanity-checking — "is the model giving the
 * right answer because it learned it, or because it guessed?"
 */

interface Source {
  score: number;
  chunk_id: number;
  document_id: number;
  document_title: string;
  content: string;
  position: number;
}
interface Turn {
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  used_kb?: boolean;
  provider?: string;
}

export default function KnowledgeChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard required="crm.leads_edit" workspaceId={wsId} skeleton="detail">
      <ChatInner wsId={wsId} />
    </PermissionGuard>
  );
}

function ChatInner({ wsId }: { wsId: string }) {
  const [useKB, setUseKB] = useState(true);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{
    ready: boolean; embedding_provider: string | null; chat_provider: string | null;
    ready_document_count: number; message: string;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    OrganizationService.kbStatus().then((res) => {
      if (res?.success) setStatus(res.data);
    });
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [turns, busy]);

  const send = async () => {
    const q = input.trim();
    if (!q || busy) return;
    setBusy(true);
    setInput('');
    const userTurn: Turn = { role: 'user', content: q };
    setTurns((t) => [...t, userTurn]);
    try {
      const history = turns.map((t) => ({ role: t.role, content: t.content }));
      const res = await OrganizationService.kbChat({
        query: q, use_kb: useKB, history,
      });
      if (res?.success) {
        setTurns((t) => [...t, {
          role: 'assistant',
          content: res.data.answer,
          sources: res.data.sources,
          used_kb: res.data.used_kb,
          provider: res.data.provider,
        }]);
      } else {
        toast.error(res?.message || 'Chat failed');
        setTurns((t) => [...t, { role: 'assistant', content: `(error) ${res?.message || 'request failed'}` }]);
      }
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      const msg = err.response?.data?.message || 'Chat failed';
      toast.error(msg);
      setTurns((t) => [...t, { role: 'assistant', content: `(error) ${msg}` }]);
    } finally { setBusy(false); }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-180px)]">
      <div className="mb-4 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href={`/w/${wsId}/knowledge`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-white"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Documents
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1 inline-flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-cyan-300" />
            Chat playground
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Ask any question. Toggle below to compare RAG (knowledge-base-grounded) vs plain AI.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ModeToggle useKB={useKB} setUseKB={setUseKB} />
        </div>
      </div>

      {status && !status.ready && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/[0.05] p-3 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-200 flex-1">
            {status.message}{' '}
            <Link href={`/w/${wsId}/leads/credentials`} className="text-cyan-300 font-semibold hover:underline">
              Open Credentials →
            </Link>
          </div>
        </div>
      )}
      {status && status.ready && useKB && status.ready_document_count === 0 && (
        <div className="mb-4 rounded-xl border border-cyan-500/30 bg-cyan-500/[0.05] p-3 flex items-start gap-3">
          <Brain className="w-4 h-4 text-cyan-300 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-200 flex-1">
            No documents trained yet — the AI will say it doesn&apos;t have any information.
            <Link href={`/w/${wsId}/knowledge?new=1`} className="ml-1 text-cyan-300 font-semibold hover:underline">
              Train one now →
            </Link>
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
        {turns.length === 0 && !busy && (
          <div className="text-center text-slate-500 italic mt-12">
            Ask anything. e.g. <em>&quot;What&apos;s your return policy?&quot;</em>, <em>&quot;How do I cancel a booking?&quot;</em>
          </div>
        )}
        {turns.map((t, i) => (
          <Bubble key={i} turn={t} />
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-cyan-300 text-xs italic">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Thinking{useKB ? ' (retrieving sources)' : ''}…
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="mt-4 flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
          }}
          placeholder="Ask a question…"
          rows={2}
          className="flex-1 rounded-xl bg-[#080e1c] border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 resize-none"
        />
        <button
          onClick={send}
          disabled={busy || !input.trim()}
          className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-40 inline-flex items-center gap-1.5"
        >
          <Send className="w-4 h-4" />
          Ask
        </button>
      </div>
    </div>
  );
}

function ModeToggle({ useKB, setUseKB }: { useKB: boolean; setUseKB: (b: boolean) => void }) {
  return (
    <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.02] p-1">
      <button
        onClick={() => setUseKB(true)}
        className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 ${
          useKB ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40' : 'text-slate-400 hover:text-white'
        }`}
      >
        <Database className="w-3.5 h-3.5" />
        Knowledge Base (RAG)
      </button>
      <button
        onClick={() => setUseKB(false)}
        className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 ${
          !useKB ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40' : 'text-slate-400 hover:text-white'
        }`}
      >
        <Sparkles className="w-3.5 h-3.5" />
        Plain AI
      </button>
    </div>
  );
}

function Bubble({ turn }: { turn: Turn }) {
  if (turn.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-emerald-500/15 border border-emerald-500/30 px-4 py-2.5 text-sm text-white whitespace-pre-wrap">
          {turn.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-start gap-2">
      <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-white/[0.04] border border-white/10 px-4 py-3 text-sm text-white whitespace-pre-wrap">
        {turn.content}
      </div>
      {turn.provider && (
        <div className="text-[10px] uppercase tracking-wider text-slate-500 ml-1">
          via {turn.provider}{turn.used_kb ? ' · with knowledge base' : ' · no retrieval'}
        </div>
      )}
      {turn.sources && turn.sources.length > 0 && (
        <div className="w-full max-w-[85%] space-y-1.5">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mt-1">
            Sources cited
          </div>
          {turn.sources.map((s, i) => (
            <div key={s.chunk_id} className="rounded-lg border border-cyan-500/15 bg-cyan-500/[0.04] p-2.5">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                <div className="text-[11px] font-semibold text-cyan-200">
                  [{i + 1}] {s.document_title}
                </div>
                <span className="ml-auto text-[10px] text-slate-500">
                  {Math.round(s.score * 100)}% match
                </span>
              </div>
              <div className="text-[11px] text-slate-300 line-clamp-3">{s.content}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
