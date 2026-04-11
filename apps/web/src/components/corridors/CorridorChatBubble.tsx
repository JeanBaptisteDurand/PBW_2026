import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CorridorChatSource } from "@xrplens/core";
import { api } from "../../api/client";

// ─── Floating Corridor Chat Bubble ─────────────────────────────────────────
// Lives bottom-right on every corridor page. Carries the current corridor
// id in context so the RAG retriever biases toward "this corridor" docs
// while still being able to answer cross-corridor questions.
//
// Messages are kept in memory (chatId persists across messages), which is
// what we want: the user can ask follow-ups like "and what about the other
// route?" without re-sending context.

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: CorridorChatSource[];
}

interface Props {
  corridorId: string | null;
}

const SUGGESTIONS_GLOBAL = [
  "Which corridor has the deepest liquidity?",
  "Is there a JPY to EUR corridor?",
  "Compare USD→CNY routes",
  "Why would I avoid CHF?",
];

const SUGGESTIONS_DETAIL = [
  "Why the recommended path vs the cheapest?",
  "Is the direct book deeper than the XRP bridge?",
  "What are the risks on this lane?",
  "What else could I route through instead?",
];

export function CorridorChatBubble({ corridorId }: Props) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Reset chat session when the corridor context changes
  useEffect(() => {
    setMessages([]);
    setChatId(null);
    setError(null);
  }, [corridorId]);

  // Auto-scroll to the newest message
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setError(null);
    setMessages((m) => [...m, { role: "user", content: trimmed }]);
    setInput("");
    setLoading(true);
    try {
      const res = await api.corridorChat({
        message: trimmed,
        corridorId,
        chatId,
      });
      setChatId(res.chatId);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: res.message.content,
          sources: res.sources,
        },
      ]);
    } catch (err: any) {
      setError(err?.message ?? "Chat failed");
    } finally {
      setLoading(false);
    }
  };

  const suggestions = corridorId ? SUGGESTIONS_DETAIL : SUGGESTIONS_GLOBAL;
  const title = corridorId ? "Ask about this corridor" : "Corridor atlas assistant";

  return createPortal(
    <>
      {!open && (
        <button
          data-testid="chat-bubble-open"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full border border-xrp-500/60 bg-slate-950/95 px-5 py-3 text-sm font-semibold text-xrp-300 shadow-lg shadow-xrp-900/40 backdrop-blur transition hover:scale-105 hover:border-xrp-400"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <span>Ask corridors</span>
        </button>
      )}

      {open && (
        <div
          data-testid="chat-bubble-panel"
          className="fixed bottom-6 right-6 z-40 flex h-[540px] w-[380px] max-w-[92vw] flex-col rounded-xl border border-slate-700 bg-slate-950/98 shadow-2xl shadow-xrp-900/40 backdrop-blur"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
            <div>
              <div className="text-xs font-semibold text-white">{title}</div>
              {corridorId && (
                <div className="text-[10px] font-mono text-slate-500" data-testid="chat-context">
                  context: {corridorId}
                </div>
              )}
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-slate-500 hover:text-white transition text-lg"
              aria-label="Close chat"
            >
              ×
            </button>
          </div>

          {/* Messages */}
          <div
            className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-sm"
            data-testid="chat-messages"
          >
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-xs text-slate-400 leading-relaxed">
                  Ask anything about the corridors. I ground my answers in the
                  live scan data and AI commentary — I'll tell you when a
                  corridor doesn't exist instead of guessing.
                </p>
                <div className="space-y-1.5">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      data-testid={`suggestion-${s.slice(0, 20)}`}
                      className="w-full text-left rounded border border-slate-800 bg-slate-900/50 px-3 py-1.5 text-[11px] text-slate-300 hover:border-xrp-500 hover:text-white transition"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === "user"
                    ? "flex justify-end"
                    : "flex justify-start"
                }
              >
                <div
                  data-testid={`chat-msg-${m.role}`}
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-[13px] leading-relaxed whitespace-pre-line ${
                    m.role === "user"
                      ? "bg-xrp-500/20 border border-xrp-500/40 text-white"
                      : "bg-slate-900/80 border border-slate-800 text-slate-200"
                  }`}
                >
                  {m.content}
                  {m.sources && m.sources.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-700/50">
                      <div className="text-[9px] uppercase tracking-wide text-slate-500 mb-1">
                        Sources
                      </div>
                      <div className="space-y-1">
                        {m.sources.slice(0, 3).map((s, j) => (
                          <div
                            key={j}
                            className="text-[10px] text-slate-400"
                            data-testid="chat-source"
                          >
                            <span className="text-xrp-400">{s.label}</span> ·{" "}
                            <span className="font-mono">{s.corridorId}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-lg bg-slate-900/80 border border-slate-800 px-3 py-2 text-[13px] text-slate-400 italic">
                  thinking…
                </div>
              </div>
            )}
            {error && (
              <div className="text-[11px] text-red-400">{error}</div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <form
            className="flex items-center gap-2 border-t border-slate-800 px-3 py-2"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <input
              data-testid="chat-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                corridorId
                  ? "Ask about this corridor…"
                  : "Ask about any corridor…"
              }
              disabled={loading}
              className="flex-1 bg-slate-900/60 border border-slate-800 rounded px-3 py-1.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-xrp-500 disabled:opacity-50"
            />
            <button
              type="submit"
              data-testid="chat-send"
              disabled={loading || !input.trim()}
              className="rounded bg-xrp-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-xrp-400 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>,
    document.body,
  );
}
