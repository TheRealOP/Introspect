"use client";

import { useState } from "react";
import { api } from "~/trpc/react";

const sentimentDot: Record<string, string> = {
  positive: "bg-emerald-500",
  negative: "bg-rose-500",
  neutral: "bg-text/20",
};

const sentimentLabel: Record<string, string> = {
  positive: "positive",
  negative: "negative",
  neutral: "neutral",
};

const sentiments = ["positive", "neutral", "negative"] as const;

const sentimentButton: Record<string, string> = {
  positive: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700",
  negative: "border-rose-500/40 bg-rose-500/10 text-rose-700",
  neutral: "border-text/20 bg-text/5 text-text/50",
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
          className="flex flex-col gap-3 rounded-xl border border-text/10 bg-white px-4 py-4"
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
                className="rounded-lg border border-text/15 px-2.5 py-1 text-xs text-text/40 transition hover:border-text/25 hover:text-text/70"
              >
                {editingId === h.id ? "Cancel" : "Edit"}
              </button>
              <button
                onClick={() => deleteHabit.mutate({ id: h.id })}
                disabled={deleteHabit.isPending}
                className="rounded-lg border border-rose-500/20 px-2.5 py-1 text-xs text-rose-500/70 transition hover:border-rose-500/40 hover:text-rose-600 disabled:opacity-40"
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
            <div className="flex flex-col gap-2 border-t border-text/10 pt-3">
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
                        : "border-text/15 bg-text/5 text-text/40 hover:border-text/25 hover:text-text/60"
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
