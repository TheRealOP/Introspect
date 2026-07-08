"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "~/trpc/react";

type Message = { id: string; role: "user" | "assistant"; content: string };

const categoryColors: Record<string, string> = {
  identity: "bg-primary/10 text-primary border-primary/25",
  habits: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  blockers: "bg-rose-500/15 text-rose-700 border-rose-500/30",
  goals: "bg-amber-400/15 text-amber-700 border-amber-400/30",
  thinking: "bg-sky-500/15 text-sky-700 border-sky-500/30",
  context: "bg-text/8 text-text/50 border-text/15",
};

export function ChatView() {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [wikiOpen, setWikiOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const { data: history, isLoading: historyLoading } = api.wiki.chatHistory.useQuery(
    { limit: 50 },
  );
  const { data: wikiPages, refetch: refetchWiki } = api.wiki.pages.useQuery();

  useEffect(() => {
    if (!historyLoading && history && !hydrated) {
      setMessages(history);
      setHydrated(true);
    }
  }, [history, historyLoading, hydrated]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(text: string) {
    if (!text.trim() || streaming) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text };
    const assistantId = crypto.randomUUID();
    const assistantMsg: Message = { id: assistantId, role: "assistant", content: "" };

    const nextMessages = [...messages, userMsg];
    setMessages([...nextMessages, assistantMsg]);
    setInput("");
    setStreaming(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok || !res.body) throw new Error("Stream failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: accumulated } : m)),
        );
      }

      setTimeout(() => void refetchWiki(), 3000);
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: "Something went wrong. Please try again." }
            : m,
        ),
      );
    } finally {
      setStreaming(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void sendMessage(input);
  }

  const pageCount = wikiPages?.length ?? 0;
  const categoryCounts = wikiPages?.reduce<Record<string, number>>((acc, p) => {
    acc[p.category] = (acc[p.category] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4">
      {/* Wiki stats bar */}
      <button
        onClick={() => setWikiOpen((v) => !v)}
        className="flex items-center justify-between rounded-xl border border-text/10 bg-white px-4 py-3 text-left transition hover:bg-text/[0.02]"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-text/60">
            {pageCount === 0
              ? "No profile built yet — start chatting"
              : `${pageCount} thing${pageCount === 1 ? "" : "s"} known about you`}
          </span>
          {categoryCounts &&
            Object.entries(categoryCounts).map(([cat, count]) => (
              <span
                key={cat}
                className={`rounded-full border px-2 py-0.5 text-xs ${categoryColors[cat] ?? "bg-text/8 text-text/40 border-text/15"}`}
              >
                {count} {cat}
              </span>
            ))}
        </div>
        <span className="ml-4 shrink-0 text-xs text-text/30">
          {wikiOpen ? "hide ↑" : "show ↓"}
        </span>
      </button>

      {/* Wiki pages panel */}
      {wikiOpen && wikiPages && wikiPages.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-text/10 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-widest text-text/30">
            Your profile
          </p>
          {wikiPages.map((page) => (
            <div
              key={page.slug}
              className="border-b border-text/8 pb-3 last:border-0 last:pb-0"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs ${categoryColors[page.category] ?? "bg-text/8 text-text/40 border-text/15"}`}
                >
                  {page.category}
                </span>
                <span className="text-sm font-medium text-text/80">{page.title}</span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-text/50">{page.content}</p>
              {page.tags.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {page.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-text/5 px-2 py-0.5 text-xs text-text/40"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex min-h-[400px] flex-col gap-3 rounded-xl border border-text/10 bg-white p-4">
        {messages.length === 0 && !historyLoading && (
          <div className="m-auto flex max-w-sm flex-col items-center gap-3 text-center">
            <div className="text-3xl opacity-40">✦</div>
            <p className="text-text/60">
              This is your reflection space. Ask anything about your patterns, or just
              think out loud — I&apos;ll learn as we talk.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                "What patterns do you see in me?",
                "Ask me something to know me better",
                "What's holding me back?",
              ].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => void sendMessage(prompt)}
                  className="rounded-full border border-text/10 bg-background px-3 py-1.5 text-sm text-text/50 transition hover:border-text/20 hover:text-text/70"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-primary text-white"
                  : "bg-text/5 text-text/85"
              }`}
            >
              {m.content}
              {m.role === "assistant" && m.content === "" && (
                <span className="flex gap-1">
                  <span className="animate-bounce text-text/30" style={{ animationDelay: "0ms" }}>·</span>
                  <span className="animate-bounce text-text/30" style={{ animationDelay: "150ms" }}>·</span>
                  <span className="animate-bounce text-text/30" style={{ animationDelay: "300ms" }}>·</span>
                </span>
              )}
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Say anything…"
          disabled={streaming}
          className="flex-1 rounded-xl border border-text/15 bg-white px-4 py-3 text-sm text-text placeholder-text/30 outline-none transition focus:border-primary/40 focus:ring-1 focus:ring-primary/10 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={streaming || !input.trim()}
          className="rounded-xl bg-primary px-5 py-3 text-sm font-medium text-white transition hover:bg-primary/90 disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}
