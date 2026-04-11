import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "@xrplens/core";
import { api } from "../../api/client";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

const SUGGESTIONS = [
  "What are the highest-risk counterparties?",
  "Which AMM pools have the most concentrated liquidity?",
  "Are there any RLUSD impersonator tokens?",
  "What compliance actions should I take before routing capital?",
];

interface ChatInterfaceProps {
  analysisId: string;
}

export function ChatInterface({ analysisId }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatId, setChatId] = useState<string | undefined>(undefined);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = { role: "user", content: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const res = await api.sendChatMessage(analysisId, text.trim(), chatId);
      setChatId(res.chatId);
      setMessages((prev) => [...prev, res.message]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
      // Remove the optimistically added user message on hard error
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleSuggestion = (q: string) => {
    sendMessage(q);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      {/* Messages area */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 0",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {/* Empty state with suggestions */}
        {messages.length === 0 && !isLoading && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              flex: 1,
              gap: 20,
              padding: "40px 24px",
              textAlign: "center",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 32,
                  marginBottom: 8,
                  color: "#0ea5e9",
                }}
              >
                ◈
              </div>
              <p style={{ fontSize: 16, fontWeight: 600, color: "#f8fafc", marginBottom: 6 }}>
                Ask about this analysis
              </p>
              <p style={{ fontSize: 13, color: "#64748b", maxWidth: 400 }}>
                I have full context of the knowledge graph — nodes, edges, risk
                flags, and on-chain data.
              </p>
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                justifyContent: "center",
                maxWidth: 520,
              }}
            >
              {SUGGESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSuggestion(q)}
                  style={{
                    background: "#0f172a",
                    border: "1px solid #1e293b",
                    borderRadius: 20,
                    padding: "8px 14px",
                    fontSize: 12,
                    color: "#94a3b8",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "#0ea5e9";
                    (e.currentTarget as HTMLButtonElement).style.color = "#e2e8f0";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "#1e293b";
                    (e.currentTarget as HTMLButtonElement).style.color = "#94a3b8";
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message bubbles */}
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              padding: "0 16px",
            }}
          >
            <div
              style={{
                maxWidth: "75%",
                padding: "10px 14px",
                borderRadius:
                  msg.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                background: msg.role === "user" ? "#0284c7" : "#1e293b",
                color: "#f8fafc",
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              {msg.role === "assistant" ? (
                <div className="prose prose-sm prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content}
                  </ReactMarkdown>
                </div>
              ) : (
                <span>{msg.content}</span>
              )}

              {/* Sources */}
              {msg.sources && msg.sources.length > 0 && (
                <div
                  style={{
                    marginTop: 8,
                    paddingTop: 8,
                    borderTop: "1px solid rgba(255,255,255,0.1)",
                    fontSize: 10,
                    color: "#64748b",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 4,
                  }}
                >
                  {msg.sources.map((s) => (
                    <span
                      key={s.nodeId}
                      style={{
                        background: "#0f172a",
                        borderRadius: 4,
                        padding: "1px 5px",
                      }}
                    >
                      {s.kind}: {s.nodeId.slice(0, 8)}…
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div style={{ display: "flex", justifyContent: "flex-start", padding: "0 16px" }}>
            <div
              style={{
                padding: "10px 16px",
                borderRadius: "12px 12px 12px 2px",
                background: "#1e293b",
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                color: "#64748b",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#0ea5e9",
                  animation: "pulse 1s infinite",
                }}
              />
              Analyzing…
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ padding: "0 16px" }}>
            <div
              style={{
                padding: "8px 12px",
                borderRadius: 6,
                background: "#450a0a",
                border: "1px solid #ef444440",
                fontSize: 12,
                color: "#f87171",
              }}
            >
              {error}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div
        style={{
          padding: "12px 16px",
          borderTop: "1px solid #1e293b",
          background: "#020617",
        }}
      >
        <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8 }}>
          <Input
            placeholder="Ask about risk, corridors, compliance…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            type="submit"
            disabled={isLoading || !input.trim()}
            style={{ flexShrink: 0 }}
          >
            Send
          </Button>
        </form>
      </div>
    </div>
  );
}
