"use client";

import { useState } from "react";
import { api } from "~/trpc/react";

const sentimentDot: Record<string, string> = {
  positive: "bg-emerald-400",
  negative: "bg-rose-400",
  neutral: "bg-white/30",
};

const sentimentLabel: Record<string, string> = {
  positive: "positive",
  negative: "negative",
  neutral: "neutral",
};

const sentiments = ["positive", "neutral", "negative"] as const;

const sentimentButton: Record<string, string> = {
  positive: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  negative: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  neutral: "border-white/20 bg-glass-bg text-white/50",
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
    return <p className="text-sm text-white/30">Loading habits…</p>;
  }

  if (!allHabits || allHabits.length === 0) {
    return (
      <p className="text-center text-sm text-white/30">
        No habits yet. Log a check-in and let the AI extract your patterns.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {allHabits.map((h) => (
        <div
          key={h.id}
          className="flex flex-col gap-3 rounded-xl border border-glass-border bg-glass-bg px-4 py-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${sentimentDot[h.sentiment] ?? "bg-white/30"}`}
              />
              <p className="text-sm font-medium text-white/90 truncate">{h.name}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setEditingId(editingId === h.id ? null : h.id)}
                className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-white/40 transition hover:border-white/20 hover:text-white/70"
              >
                {editingId === h.id ? "Cancel" : "Edit"}
              </button>
              <button
                onClick={() => deleteHabit.mutate({ id: h.id })}
                disabled={deleteHabit.isPending}
                className="rounded-lg border border-rose-500/20 px-2.5 py-1 text-xs text-rose-400/60 transition hover:border-rose-500/40 hover:text-rose-400 disabled:opacity-40"
              >
                Delete
              </button>
            </div>
          </div>

          <div className="flex gap-4 text-xs text-white/40">
            <span>
              <span className="font-semibold text-white/70">{h.occurrences ?? 1}</span>× seen
            </span>
            <span className={`font-medium ${sentimentDot[h.sentiment] ? "" : ""}`}>
              {sentimentLabel[h.sentiment] ?? h.sentiment}
            </span>
            {h.lastSeen && (
              <span>last {new Date(h.lastSeen * 1000).toLocaleDateString()}</span>
            )}
          </div>

          {editingId === h.id && (
            <div className="flex flex-col gap-2 border-t border-white/10 pt-3">
              <p className="text-xs text-white/40">Change sentiment:</p>
              <div className="flex gap-2">
                {sentiments.map((s) => (
                  <button
                    key={s}
                    onClick={() => updateSentiment.mutate({ id: h.id, sentiment: s })}
                    disabled={updateSentiment.isPending}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-40 ${
                      h.sentiment === s
                        ? sentimentButton[s]
                        : "border-glass-border bg-glass-bg text-white/40 hover:border-white/20 hover:text-white/60"
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
