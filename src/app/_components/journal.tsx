"use client";

import { useState } from "react";
import { api } from "~/trpc/react";

const sentimentDot: Record<string, string> = {
  positive: "bg-emerald-400",
  negative: "bg-rose-400",
  neutral: "bg-white/30",
};

type AnalysisResult = {
  habits: { name: string; sentiment: "positive" | "negative" | "neutral" }[];
  plans: { id: string; action: string; selected: boolean }[];
};

export function JournalEditor() {
  const [content, setContent] = useState("");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [committedPlan, setCommittedPlan] = useState<string | null>(null);
  const [customPlan, setCustomPlan] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);

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

  const analyzeAll = api.journal.analyzeAll.useMutation({
    onSuccess: async (data) => {
      await utils.habits.list.invalidate();
      await utils.journal.list.invalidate();
      alert(
        `Done! Analyzed ${data.analyzed} entr${data.analyzed === 1 ? "y" : "ies"}.`,
      );
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
          className="min-h-[140px] w-full resize-none rounded-xl border border-white/10 bg-white/5 p-4 text-white placeholder-white/30 outline-none focus:border-white/25 focus:ring-0"
          placeholder="What have you done since your last check-in?"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleSave();
          }}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/30">⌘ + Enter to save</span>
          <div className="flex items-center gap-2">
            {entries && entries.length > 0 && (
              <button
                onClick={() => analyzeAll.mutate()}
                disabled={analyzeAll.isPending}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/50 transition hover:border-white/20 hover:text-white/70 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {analyzeAll.isPending ? "Analyzing all…" : "Analyze all entries"}
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={isAnalyzing || !content.trim()}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
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
      {/* Analyzing state                                                      */}
      {/* ------------------------------------------------------------------ */}
      {analyze.isPending && (
        <div className="flex items-center gap-3 rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-4">
          <span className="animate-pulse text-indigo-300">✦</span>
          <p className="text-sm text-indigo-200">
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
            <div className="flex flex-col gap-1 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400/70">
                Your plan until next check-in
              </p>
              <p className="text-sm leading-relaxed text-emerald-100">{committedPlan}</p>
              <button
                onClick={() => {
                  setCommittedPlan(null);
                  setShowCustomInput(false);
                  setCustomPlan("");
                }}
                className="mt-1 self-start text-xs text-white/30 hover:text-white/50 transition"
              >
                Change plan
              </button>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400/70">
                  What&apos;s your plan until the next check-in?
                </p>
                <p className="text-xs text-white/30">
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
                    className="rounded-xl border border-white/10 bg-white/5 p-4 text-left text-sm leading-relaxed text-white/70 transition hover:border-indigo-400/30 hover:bg-indigo-400/5 hover:text-white/90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {plan.action}
                  </button>
                ))}
              </div>

              {/* Custom plan option */}
              {!showCustomInput ? (
                <button
                  onClick={() => setShowCustomInput(true)}
                  className="self-start rounded-lg border border-white/10 px-4 py-2 text-sm text-white/40 transition hover:border-white/20 hover:text-white/60"
                >
                  + Write my own plan
                </button>
              ) : (
                <div className="flex flex-col gap-2">
                  <textarea
                    autoFocus
                    className="min-h-[80px] w-full resize-none rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white placeholder-white/30 outline-none focus:border-indigo-400/40 focus:ring-0"
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
                      className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {isSaving ? "Saving…" : "Commit plan"}
                    </button>
                    <button
                      onClick={() => {
                        setShowCustomInput(false);
                        setCustomPlan("");
                      }}
                      className="text-sm text-white/30 hover:text-white/50 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Habits extracted from this entry */}
          {analysisResult.habits.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/40">
                Habits spotted this check-in
              </p>
              <div className="flex flex-wrap gap-2">
                {analysisResult.habits.map((h) => (
                  <span
                    key={h.name}
                    className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80"
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${sentimentDot[h.sentiment] ?? "bg-white/30"}`}
                    />
                    {h.name}
                    <span className="text-white/30">· {h.sentiment}</span>
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
