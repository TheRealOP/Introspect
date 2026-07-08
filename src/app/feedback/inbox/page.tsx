"use client";

import { api } from "~/trpc/react";
import { Nav } from "../../_components/nav";

function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const CATEGORY_EMOJI: Record<string, string> = {
  bug: "🐛",
  idea: "💡",
  praise: "🙌",
  other: "💬",
};

export default function FeedbackInboxPage() {
  const { data, isLoading, error } = api.feedback.list.useQuery();

  return (
    <main className="flex min-h-screen flex-col items-center bg-brand-bg px-4 py-16 text-white">
      <div className="flex w-full max-w-2xl flex-col gap-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
              Inbox
            </h1>
            <p className="mt-2 text-white/50">All feedback submissions.</p>
          </div>
          <Nav />
        </div>

        {isLoading && (
          <p className="text-sm text-white/30">Loading…</p>
        )}

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-300">
            {error.message === "FORBIDDEN"
              ? "You're not authorized to view this page."
              : `Error: ${error.message}`}
          </div>
        )}

        {data && data.length === 0 && (
          <p className="text-sm text-white/30">No feedback yet.</p>
        )}

        {data && data.length > 0 && (
          <div className="flex flex-col gap-4">
            {data.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 rounded-xl border border-glass-border bg-glass-bg px-5 py-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-base">
                      {CATEGORY_EMOJI[item.category ?? "other"] ?? "💬"}
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-widest text-white/30">
                      {item.category ?? "other"}
                    </span>
                  </div>
                  <span className="text-xs text-white/20">
                    {formatDate(item.createdAt)}
                  </span>
                </div>

                <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/80">
                  {item.message}
                </p>

                {item.email && (
                  <a
                    href={`mailto:${item.email}`}
                    className="self-start text-xs text-violet-400 transition hover:text-violet-300"
                  >
                    {item.email}
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
