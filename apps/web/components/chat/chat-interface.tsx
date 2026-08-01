"use client";

import { useState, useRef, useCallback, useEffect, type FormEvent } from "react";
import { ChatMessage, type Message, type Citation } from "./chat-message";
import { FileUploadButton } from "./file-upload-button";
import { AgentStepIndicator } from "./agent-step-indicator";

export function ChatInterface({
  conversationId,
}: {
  conversationId: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await fetch(`/api/conversations/${conversationId}/messages`);
        if (res.ok) {
          const history = await res.json();
          if (history.length > 0) {
            setMessages(
              history.map((m: { role: string; content: string; citations?: Citation[] }) => ({
                role: m.role as "user" | "assistant",
                content: m.content,
                citations: m.citations ?? undefined,
              }))
            );
          }
        }
      } catch {
        // fresh conversation
      } finally {
        setLoadingHistory(false);
      }
    }
    loadHistory();
  }, [conversationId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, activeAgent]);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const text = input.trim();
      if (!text || isStreaming) return;

      const userMsg: Message = { role: "user", content: text };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsStreaming(true);
      setActiveAgent(null);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId, message: text }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) throw new Error("Stream failed");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let assistantContent = "";
        let citations: Citation[] = [];
        let buffer = "";

        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "" },
        ]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              const eventType = line.slice(7).trim();
              continue;
            }

            if (line.startsWith("data: ")) {
              const jsonStr = line.slice(6);
              try {
                const data = JSON.parse(jsonStr);

                if (data.agent) {
                  setActiveAgent(data.agent);
                } else if (data.text) {
                  assistantContent += data.text;
                  setMessages((prev) => {
                    const updated = [...prev];
                    updated[updated.length - 1] = {
                      role: "assistant",
                      content: assistantContent,
                      citations: citations.length > 0 ? citations : undefined,
                    };
                    return updated;
                  });
                } else if (data.citations) {
                  citations = data.citations;
                  setMessages((prev) => {
                    const updated = [...prev];
                    updated[updated.length - 1] = {
                      role: "assistant",
                      content: assistantContent,
                      citations,
                    };
                    return updated;
                  });
                } else if (data.message_id) {
                  setActiveAgent(null);
                }
              } catch {
                assistantContent += jsonStr;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content: assistantContent,
                  };
                  return updated;
                });
              }
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setMessages((prev) => [
            ...prev.slice(0, -1),
            {
              role: "assistant",
              content: "Something went wrong. Please try again.",
            },
          ]);
        }
      } finally {
        setIsStreaming(false);
        setActiveAgent(null);
        abortRef.current = null;
      }
    },
    [input, isStreaming, conversationId]
  );

  if (loadingHistory) {
    return (
      <div className="flex h-full items-center justify-center text-[var(--muted)]">
        Loading conversation...
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-[var(--muted)]">
            Send a message or upload a document to get started.
          </div>
        )}
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.map((msg, i) => (
            <ChatMessage key={i} message={msg} />
          ))}
          {activeAgent && <AgentStepIndicator agent={activeAgent} />}
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="border-t border-[var(--border)] p-4"
      >
        <div className="mx-auto flex max-w-3xl gap-2">
          <FileUploadButton conversationId={conversationId} />
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your documents..."
            className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm outline-none placeholder:text-[var(--muted)] focus:border-[var(--primary)]"
            disabled={isStreaming}
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            className="rounded-lg bg-[var(--primary)] px-6 py-3 text-sm font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isStreaming ? "..." : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
