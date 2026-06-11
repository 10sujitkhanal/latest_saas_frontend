"use client";

/**
 * StorefrontAssistant — a floating, customer-facing AI chat widget for the
 * public store. Powered by the store's OWN trained knowledge base (the same
 * engine the owner trains in /w/<id>/knowledge), via the public, throttled
 * /public/storefront/<schema>/assistant endpoint.
 *
 * Self-contained + self-gating: on mount it asks the backend whether an
 * assistant is available for this store (a KB is trained + the tenant has an
 * active MoreTech AI subscription). If not, it renders nothing — so it is safe
 * to mount on every storefront regardless of industry or setup state.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { MessageCircle, X, Send, Sparkles } from "lucide-react";
import {
  getAssistantStatus,
  askAssistant,
  askAssistantStream,
  type AssistantTurn,
} from "@/lib/storefront/storefrontPublicApi";

/** Greeting in the customer's browser language (Swedish stores read in Swedish).
 *  Falls back to the backend-provided (English) greeting for other languages. */
function localizedGreeting(name: string, backendGreeting: string): string {
  const lang = (typeof navigator !== "undefined" ? navigator.language : "en").toLowerCase();
  if (lang.startsWith("sv")) {
    return `Hej! Jag är ${name || "butikens"} assistent — fråga mig om produkter, öppettider, policyer eller annat.`;
  }
  return backendGreeting || (name ? `Hi! I'm the ${name} assistant — ask me anything.` : "Hi! How can I help?");
}

interface Props {
  slug: string;
  /** Store display name — used in the header + greeting fallback. */
  name?: string;
  /** Store brand colour — themes the button + header. */
  accent?: string;
}

type Msg = { role: "user" | "assistant"; content: string; pending?: boolean };

export default function StorefrontAssistant({ slug, name, accent = "#10b981" }: Props) {
  const [available, setAvailable] = useState(false);
  const [open, setOpen] = useState(false);
  const [greeting, setGreeting] = useState("");
  const [storeName, setStoreName] = useState(name || "");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Availability check — keep the widget invisible unless the store has a
  // working assistant. Failures degrade to "not available" (never throws).
  useEffect(() => {
    let alive = true;
    (async () => {
      const s = await getAssistantStatus(slug);
      if (!alive) return;
      setAvailable(s.available);
      setGreeting(s.greeting);
      if (s.name) setStoreName(s.name);
    })();
    return () => { alive = false; };
  }, [slug]);

  // Seed the greeting the first time the panel opens (in the customer's language).
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ role: "assistant", content: localizedGreeting(storeName, greeting) }]);
    }
  }, [open, greeting, storeName, messages.length]);

  // Keep the latest message in view + focus the input when opening.
  useEffect(() => {
    if (open) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      inputRef.current?.focus();
    }
  }, [open, messages]);

  const send = useCallback(async () => {
    const q = input.trim();
    if (!q || busy) return;
    setInput("");
    const history: AssistantTurn[] = messages
      .filter((m) => !m.pending)
      .map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [
      ...prev,
      { role: "user", content: q },
      { role: "assistant", content: "", pending: true },
    ]);
    setBusy(true);

    // Append a streamed delta to the last (assistant) bubble; first token
    // clears the pending dots.
    const appendToLast = (delta: string) =>
      setMessages((prev) => {
        const next = prev.slice();
        const last = next[next.length - 1];
        next[next.length - 1] = {
          role: "assistant",
          content: (last?.pending ? "" : last?.content || "") + delta,
          pending: false,
        };
        return next;
      });
    const replaceLast = (text: string) =>
      setMessages((prev) => {
        const next = prev.slice();
        next[next.length - 1] = { role: "assistant", content: text, pending: false };
        return next;
      });

    try {
      // Stream the answer out live.
      await askAssistantStream(slug, q, history, appendToLast);
      // Guard against an empty stream (no tokens) — show a graceful message.
      setMessages((prev) => {
        const next = prev.slice();
        const last = next[next.length - 1];
        if (last?.pending || !last?.content) {
          next[next.length - 1] = {
            role: "assistant",
            content:
              "I'm not sure about that one — could you rephrase, or reach out to the team directly?",
            pending: false,
          };
        }
        return next;
      });
    } catch {
      // SSE unavailable → fall back to the blocking endpoint.
      try {
        const reply = await askAssistant(slug, q, history);
        replaceLast(
          reply.answer ||
            "I'm not sure about that one — could you rephrase, or reach out to the team directly?",
        );
      } catch {
        replaceLast("Sorry — I couldn't answer just now. Please try again in a moment.");
      }
    } finally {
      setBusy(false);
    }
  }, [input, busy, messages, slug]);

  if (!available) return null;

  return (
    <>
      {/* Launcher */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Chat with the store assistant"
          className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 h-12 rounded-full pl-4 pr-5 text-white text-sm font-semibold shadow-xl transition-transform hover:scale-105"
          style={{ backgroundColor: accent }}
        >
          <MessageCircle className="w-5 h-5" />
          Ask us
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-5 right-5 z-50 flex w-[min(380px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-black/5 bg-white shadow-2xl">
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 text-white"
            style={{ backgroundColor: accent }}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              <div className="leading-tight">
                <div className="text-sm font-semibold">{storeName || "Assistant"}</div>
                <div className="text-[11px] opacity-80">AI assistant</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="rounded-full p-1 hover:bg-white/20"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-3 py-3" style={{ maxHeight: "min(60vh, 460px)", minHeight: 220 }}>
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[80%] rounded-2xl rounded-br-sm px-3.5 py-2 text-sm text-white"
                      : "max-w-[85%] rounded-2xl rounded-bl-sm bg-white px-3.5 py-2 text-sm text-slate-700 shadow-sm"
                  }
                  style={m.role === "user" ? { backgroundColor: accent } : undefined}
                >
                  {m.pending ? (
                    <span className="inline-flex gap-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
                    </span>
                  ) : (
                    <span className="whitespace-pre-wrap">{m.content}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Composer */}
          <div className="flex items-center gap-2 border-t border-slate-100 bg-white px-3 py-2.5">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Ask a question…"
              maxLength={1000}
              style={{ color: "#0f172a", caretColor: "#0f172a", WebkitTextFillColor: "#0f172a" }}
              className="flex-1 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 caret-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-300"
            />
            <button
              type="button"
              onClick={send}
              disabled={busy || !input.trim()}
              aria-label="Send"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white transition-opacity disabled:opacity-40"
              style={{ backgroundColor: accent }}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <div className="bg-white pb-2 text-center text-[10px] text-slate-400">
            Powered by AI · answers may not be perfect
          </div>
        </div>
      )}
    </>
  );
}
