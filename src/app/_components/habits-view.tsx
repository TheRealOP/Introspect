"use client";

import { useState } from "react";
import { api } from "~/trpc/react";

const sentimentDot: Record<string, string> = {
  positive: "bg-primary",
  negative: "bg-accent",
  neutral: "bg-text/20",
};

const sentimentLabel: Record<string, string> = {
  positive: "positive",
  negative: "negative",
  neutral: "neutral",
};

const sentiments = ["positive", "neutral", "negative"] as const;

const sentimentButton: Record<string, string> = {
  positive: "border-border-strong bg-chip text-accent-text",
  negative: "border-negative-border bg-negative-soft text-accent",
  neutral: "border-border bg-text/5 text-text/50",
};

export function HabitsView() {
  const utils = api.useUtils();
  const { data: allHabits, isLoading } = api.habits.list.useQuery();
  const [editingId, setEditingId] = useState<string | null>(null);

  const updateSentiment = api.habits.updateSentiment.useMutation({
    onSuccess: async () => {
      await utils.habits.list.invalidate();
      setEditingId(null);
    },
  });

  const deleteHabit = api.habits.delete.useMutation({
    onSuccess: async () => {
      await utils.habits.list.invalidate();
    },
  });

  if (isLoading) {
    return <p className="text-sm text-text/40">Loading habits…</p>;
  }

  if (!allHabits || allHabits.length === 0) {
    return (
      <p className="text-center text-sm text-text/40">
        No habits yet. Log a check-in and let the AI extract your patterns.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {allHabits.map((h) => (
        <div
          key={h.id}
          className="flex flex-col gap-3 rounded-xl border-[1.5px] border-border bg-surface px-4 py-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${sentimentDot[h.sentiment] ?? "bg-text/20"}`}
              />
              <p className="truncate text-sm font-medium text-text/90">{h.name}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => setEditingId(editingId === h.id ? null : h.id)}
                className="rounded-lg border-[1.5px] border-border px-2.5 py-1 text-xs text-text/40 transition hover:border-border-strong hover:text-text/70"
              >
                {editingId === h.id ? "Cancel" : "Edit"}
              </button>
              <button
                onClick={() => deleteHabit.mutate({ id: h.id })}
                disabled={deleteHabit.isPending}
                className="rounded-lg border border-negative-border px-2.5 py-1 text-xs text-accent transition hover:bg-negative-soft disabled:opacity-40"
              >
                Delete
              </button>
            </div>
          </div>

          <div className="flex gap-4 text-xs text-text/40">
            <span>
              <span className="font-semibold text-text/70">{h.occurrences ?? 1}</span>× seen
            </span>
            <span className="font-medium">
              {sentimentLabel[h.sentiment] ?? h.sentiment}
            </span>
            {h.lastSeen && (
              <span>last {new Date(h.lastSeen * 1000).toLocaleDateString()}</span>
            )}
          </div>

          {editingId === h.id && (
            <div className="flex flex-col gap-2 border-t border-border pt-3">
              <p className="text-xs text-text/40">Change sentiment:</p>
              <div className="flex gap-2">
                {sentiments.map((s) => (
                  <button
                    key={s}
                    onClick={() => updateSentiment.mutate({ id: h.id, sentiment: s })}
                    disabled={updateSentiment.isPending}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-40 ${
                      h.sentiment === s
                        ? sentimentButton[s]
                        : "border-border bg-text/5 text-text/40 hover:border-border-strong hover:text-text/60"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
