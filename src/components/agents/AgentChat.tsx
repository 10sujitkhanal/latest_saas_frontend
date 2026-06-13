'use client';

import { useState, useRef, useEffect } from 'react';
import { Bot, Send, Loader2 } from 'lucide-react';
import { AgentsService } from '@/services/agents.service';
import { agentModule } from '@/lib/agents/modules';

type Msg = { role: 'user' | 'agent'; text: string; agent?: string | null };

const EXAMPLES = ["Who's overdue?", 'Draft a post for the weekend', 'Analyse my finances', "How's my loyalty?"];

/**
 * Ask-your-AI-staff chatroom. A plain-language request is routed (backend) to ONE
 * agent's action and run; the reply names the agent that handled it. Read-only /
 * draft / propose only — sends + money changes stay one-click on the agent cards.
 */
export default function AgentChat({ workspaceId, onActed }: { workspaceId: string | number; onActed?: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  const send = async (text?: string) => {
    const m = (text ?? input).trim();
    if (!m || busy) return;
    setInput('');
    setMsgs((x) => [...x, { role: 'user', text: m }]);
    setBusy(true);
    try {
      const r = await AgentsService.chat(workspaceId, m);
      if (r.success && r.data) {
        setMsgs((x) => [...x, { role: 'agent', text: r.data.reply, agent: r.data.agent }]);
        onActed?.();
      } else {
        setMsgs((x) => [...x, { role: 'agent', text: r.message || 'Something went wrong.' }]);
      }
    } catch {
      setMsgs((x) => [...x, { role: 'agent', text: 'Could not reach your AI staff right now.' }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-indigo-200 bg-gradient-to-b from-indigo-50/50 to-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Bot className="h-4 w-4 text-indigo-600" />
        <h2 className="text-sm font-semibold text-slate-900">Ask your AI staff</h2>
        <span className="ml-auto hidden text-[11px] text-slate-400 sm:block">Type a task — it routes to the right agent</span>
      </div>

      {msgs.length > 0 && (
        <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
          {msgs.map((m, i) => m.role === 'user' ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-indigo-600 px-3 py-2 text-sm text-white">{m.text}</div>
            </div>
          ) : (
            <div key={i} className="flex items-start gap-2">
              {(() => {
                const meta = m.agent ? agentModule(m.agent) : null;
                return (
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg ${meta?.chip || 'bg-slate-100 text-slate-500'}`}>
                    {meta ? <meta.Icon className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                  </span>
                );
              })()}
              <div className="max-w-[85%] whitespace-pre-line rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200">{m.text}</div>
            </div>
          ))}
          {busy && <div className="flex items-center gap-2 pl-8 text-xs text-slate-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Working…</div>}
          <div ref={endRef} />
        </div>
      )}

      {msgs.length === 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {EXAMPLES.map((e) => (
            <button key={e} type="button" onClick={() => send(e)} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600 hover:border-indigo-300 hover:text-indigo-700">{e}</button>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
          placeholder="e.g. who's overdue? · draft a post · analyse my finances"
          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-300" />
        <button type="button" onClick={() => send()} disabled={busy || !input.trim()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send
        </button>
      </div>
    </div>
  );
}
