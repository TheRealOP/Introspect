"use client";

import { useRef, useState } from "react";
import { api } from "~/trpc/react";

const sentimentDot: Record<string, string> = {
  positive: "bg-primary",
  negative: "bg-accent",
  neutral: "bg-text/20",
};

const sentimentChip: Record<string, string> = {
  positive: "border-border-strong bg-chip",
  negative: "border-negative-border bg-negative-soft",
  neutral: "border-border bg-chip",
};

type AnalysisResult = {
  habits: {
    name: string;
    sentiment: "positive" | "negative" | "neutral";
    currentStreak: number;
  }[];
  plans: { id: string; action: string; selected: boolean }[];
};

type CheckinStreak = { current: number; longest: number };

export function JournalEditor() {
  const [content, setContent] = useState("");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [committedPlan, setCommittedPlan] = useState<string | null>(null);
  const [customPlan, setCustomPlan] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [checkinStreak, setCheckinStreak] = useState<CheckinStreak | null>(null);

  const utils = api.useUtils();
  const { data: entries } = api.journal.list.useQuery();

  const selectPlan = api.journal.selectPlan.useMutation({
    onSuccess: (_, variables) => {
      setAnalysisResult((prev) =>
        prev
          ? {
              ...prev,
              plans: prev.plans.map((p) => ({
                ...p,
                selected: p.id === variables.nudgeId,
              })),
            }
          : prev,
      );
      setCommittedPlan(variables.action);
      setShowCustomInput(false);
    },
  });

  const setPlan = api.journal.setPlan.useMutation({
    onSuccess: (_, variables) => {
      setAnalysisResult((prev) =>
        prev
          ? { ...prev, plans: prev.plans.map((p) => ({ ...p, selected: false })) }
          : prev,
      );
      setCommittedPlan(variables.plan);
      setCustomPlan("");
      setShowCustomInput(false);
    },
  });

  // analyzeAll processes at most 10 entries per call, so loop until the server
  // reports no remaining entries. Accumulate the running total for the summary.
  const analyzeAllTotal = useRef(0);
  const analyzeAll = api.journal.analyzeAll.useMutation({
    onSuccess: async (data) => {
      analyzeAllTotal.current += data.analyzed;

      if (data.remaining > 0) {
        analyzeAll.mutate();
        return;
      }

      const total = analyzeAllTotal.current;
      analyzeAllTotal.current = 0;
      await utils.habits.list.invalidate();
      await utils.journal.list.invalidate();
      alert(`Done! Analyzed ${total} entr${total === 1 ? "y" : "ies"}.`);
    },
  });

  const analyze = api.journal.analyze.useMutation({
    onSuccess: async (data) => {
      setAnalysisResult(data);
      setCommittedPlan(null);
      setShowCustomInput(false);
      setCustomPlan("");
      await utils.habits.list.invalidate();
    },
  });

  const create = api.journal.create.useMutation({
    onSuccess: async (data) => {
      setActiveEntryId(data.id);
      setCheckinStreak(data.checkinStreak);
      await utils.journal.list.invalidate();
      setContent("");
      analyze.mutate({ entryId: data.id });
    },
  });

  const handleSave = () => {
    if (!content.trim()) return;
    setAnalysisResult(null);
    setActiveEntryId(null);
    setCommittedPlan(null);
    setCheckinStreak(null);
    create.mutate({ content: content.trim() });
  };

  const handleCommitCustomPlan = () => {
    if (!customPlan.trim() || !activeEntryId) return;
    setPlan.mutate({ entryId: activeEntryId, plan: customPlan.trim() });
  };

  const isAnalyzing = create.isPending || analyze.isPending;
  const isSaving = selectPlan.isPending || setPlan.isPending;

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      {/* ------------------------------------------------------------------ */}
      {/* Write area                                                           */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-3">
        <textarea
          className="min-h-[140px] w-full resize-none rounded-xl border-[1.5px] border-border bg-surface p-4 text-text placeholder-text/30 outline-none transition focus:border-primary/40 focus:ring-1 focus:ring-primary/10"
          placeholder="What have you done since your last check-in?"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleSave();
          }}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-text/30">⌘ + Enter to save</span>
          <div className="flex items-center gap-2">
            {entries && entries.length > 0 && (
              <button
                onClick={() => analyzeAll.mutate()}
                disabled={analyzeAll.isPending}
                className="rounded-lg border-[1.5px] border-border px-4 py-2 text-sm text-text/50 transition hover:border-border-strong hover:text-text/70 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {analyzeAll.isPending ? "Analyzing all…" : "Analyze all entries"}
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={isAnalyzing || !content.trim()}
              className="rounded-lg bg-primary px-5 py-2 text-sm font-bold text-on-accent shadow-[0_4px_12px_-4px_var(--border-strong)] transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {create.isPending
                ? "Logging…"
                : analyze.isPending
                  ? "Analyzing…"
                  : "Log check-in"}
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Check-in streak reward — renders instantly, before AI analysis      */}
      {/* ------------------------------------------------------------------ */}
      {checkinStreak && (
        <div className="flex items-center gap-2 rounded-xl border-[1.5px] border-border-strong bg-accent-soft p-4">
          <span className="text-lg">{checkinStreak.current >= 2 ? "🔥" : "✦"}</span>
          <p className="text-sm font-medium text-accent-text">
            {checkinStreak.current >= 2
              ? `${checkinStreak.current}-day check-in streak`
              : "First check-in logged — come back tomorrow to keep it going"}
          </p>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Analyzing state                                                      */}
      {/* ------------------------------------------------------------------ */}
      {analyze.isPending && (
        <div className="flex items-center gap-3 rounded-xl border-[1.5px] border-border bg-accent-soft p-4">
          <span className="animate-pulse text-primary">✦</span>
          <p className="text-sm text-accent-text">
            Introspect is analysing your check-in…
          </p>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Plan section (shown after analysis)                                 */}
      {/* ------------------------------------------------------------------ */}
      {analysisResult && !analyze.isPending && (
        <div className="flex flex-col gap-4">
          {/* Committed plan banner */}
          {committedPlan ? (
            <div className="flex flex-col gap-1 rounded-xl border-[1.5px] border-border-strong bg-chip p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-accent-text">
                Your plan until next check-in
              </p>
              <p className="text-sm leading-relaxed text-text">{committedPlan}</p>
              <button
                onClick={() => {
                  setCommittedPlan(null);
                  setShowCustomInput(false);
                  setCustomPlan("");
                }}
                className="mt-1 self-start text-xs text-text/30 transition hover:text-text/50"
              >
                Change plan
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4 rounded-2xl border-[1.5px] border-border bg-accent-soft p-4">
              <div className="flex flex-col gap-1">
                <p className="text-xs font-bold uppercase tracking-widest text-accent-text">
                  What&apos;s your plan until the next check-in?
                </p>
                <p className="text-xs text-text/40">
                  Pick a suggestion or write your own.
                </p>
              </div>

              {/* AI-suggested plans */}
              <div className="flex flex-col gap-2">
                {analysisResult.plans.map((plan) => (
                  <button
                    key={plan.id}
                    onClick={() => {
                      if (!activeEntryId) return;
                      selectPlan.mutate({
                        nudgeId: plan.id,
                        entryId: activeEntryId,
                        action: plan.action,
                      });
                    }}
                    disabled={isSaving}
                    className="rounded-xl border-[1.5px] border-border-strong bg-plan-btn p-4 text-left text-sm leading-relaxed text-text/70 transition hover:bg-chip hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {plan.action}
                  </button>
                ))}
              </div>

              {/* Custom plan option */}
              {!showCustomInput ? (
                <button
                  onClick={() => setShowCustomInput(true)}
                  className="self-start rounded-lg border-[1.5px] border-border px-4 py-2 text-sm text-text/40 transition hover:border-border-strong hover:text-text/60"
                >
                  + Write my own plan
                </button>
              ) : (
                <div className="flex flex-col gap-2">
                  <textarea
                    autoFocus
                    className="min-h-[80px] w-full resize-none rounded-xl border-[1.5px] border-border bg-surface p-3 text-sm text-text placeholder-text/30 outline-none transition focus:border-primary/40 focus:ring-1 focus:ring-primary/10"
                    placeholder="e.g. Finish the auth flow, then take a 15-min walk before dinner."
                    value={customPlan}
                    onChange={(e) => setCustomPlan(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === "Enter")
                        handleCommitCustomPlan();
                    }}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCommitCustomPlan}
                      disabled={!customPlan.trim() || isSaving}
                      className="rounded-lg bg-primary px-4 py-1.5 text-sm font-bold text-on-accent shadow-[0_4px_12px_-4px_var(--border-strong)] transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {isSaving ? "Saving…" : "Commit plan"}
                    </button>
                    <button
                      onClick={() => {
                        setShowCustomInput(false);
                        setCustomPlan("");
                      }}
                      className="text-sm text-text/30 transition hover:text-text/50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Habits extracted from this entry */}
          {analysisResult.habits.length > 0 && (
            <div className="rounded-xl border-[1.5px] border-border bg-surface p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-text/40">
                Habits spotted this check-in
              </p>
              <div className="flex flex-wrap gap-2">
                {analysisResult.habits.map((h) => (
                  <span
                    key={h.name}
                    className={`flex items-center gap-1.5 rounded-full border-[1.5px] px-3 py-1 text-xs text-text/80 ${sentimentChip[h.sentiment] ?? "border-border bg-chip"}`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${sentimentDot[h.sentiment] ?? "bg-text/20"}`}
                    />
                    {h.name}
                    <span className="text-text/30">· {h.sentiment}</span>
                    {h.currentStreak >= 2 && (
                      <span className="font-semibold text-accent-text">
                        🔥 {h.currentStreak}d
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
