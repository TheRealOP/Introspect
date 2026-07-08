"use client";

import { useState } from "react";

type Category = "bug" | "idea" | "praise" | "other";

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "idea", label: "💡 Feature idea" },
  { value: "bug", label: "🐛 Bug report" },
  { value: "praise", label: "🙌 Something I love" },
  { value: "other", label: "💬 Other" },
];

export function FeedbackForm() {
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState<Category>("idea");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">(
    "idle",
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setStatus("sending");

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.trim(),
          email: email.trim() || undefined,
          category,
          _hp: "", // honeypot — always empty for real users
        }),
      });

      if (!res.ok) throw new Error("Request failed");
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-glass-border bg-glass-bg px-8 py-12 text-center">
        <span className="text-4xl">🙏</span>
        <p className="text-lg font-semibold text-white">Thanks for the feedback!</p>
        <p className="text-sm text-white/40">
          It goes straight to the person building this. Every message genuinely helps.
        </p>
        <button
          onClick={() => {
            setMessage("");
            setEmail("");
            setCategory("idea");
            setStatus("idle");
          }}
          className="mt-2 rounded-lg px-4 py-2 text-sm text-white/40 transition hover:text-white/70"
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Category */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold uppercase tracking-widest text-white/40">
          Type
        </label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setCategory(value)}
              className={`rounded-lg px-3 py-1.5 text-sm transition ${
                category === value
                  ? "bg-brand-primary text-white"
                  : "bg-glass-bg text-white/50 hover:bg-white/10 hover:text-white/80"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Message */}
      <div className="flex flex-col gap-2">
        <label
          htmlFor="fb-message"
          className="text-xs font-semibold uppercase tracking-widest text-white/40"
        >
          Message <span className="text-violet-400">*</span>
        </label>
        <textarea
          id="fb-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          rows={5}
          placeholder="Tell me what's on your mind — bugs, missing features, things you love, anything."
          className="w-full resize-none rounded-xl border border-glass-border bg-glass-bg px-4 py-3 text-sm text-white placeholder-white/20 outline-none transition focus:border-brand-primary-hover/60 focus:ring-1 focus:ring-brand-primary-hover/30"
        />
      </div>

      {/* Email */}
      <div className="flex flex-col gap-2">
        <label
          htmlFor="fb-email"
          className="text-xs font-semibold uppercase tracking-widest text-white/40"
        >
          Your email <span className="text-white/20">(optional — only if you want a reply)</span>
        </label>
        <input
          id="fb-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-xl border border-glass-border bg-glass-bg px-4 py-3 text-sm text-white placeholder-white/20 outline-none transition focus:border-brand-primary-hover/60 focus:ring-1 focus:ring-brand-primary-hover/30"
        />
      </div>

      {/* Honeypot — hidden from humans */}
      <input
        type="text"
        name="_hp"
        aria-hidden="true"
        tabIndex={-1}
        style={{ display: "none" }}
        defaultValue=""
      />

      {status === "error" && (
        <p className="text-sm text-red-400">
          Something went wrong — please try again.
        </p>
      )}

      <button
        type="submit"
        disabled={!message.trim() || status === "sending"}
        className="self-start rounded-xl bg-brand-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
      >
        {status === "sending" ? "Sending…" : "Send feedback"}
      </button>
    </form>
  );
}
