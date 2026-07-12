"use client";

import { useEffect, useState } from "react";
import { api, type RouterOutputs } from "~/trpc/react";

type ActiveRun = NonNullable<RouterOutputs["routines"]["activeRun"]>;

function fmt(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return `${m}:${rest.toString().padStart(2, "0")}`;
}

export function RoutineRun({ state }: { state: ActiveRun }) {
  const utils = api.useUtils();

  // Server timestamps are the source of truth; the client clock only renders.
  // Offset corrects for client/server clock skew, so refreshes lose nothing.
  const [offset] = useState(() => state.serverNow - Date.now() / 1000);
  const [nowSec, setNowSec] = useState(() => Date.now() / 1000 + offset);

  useEffect(() => {
    const t = setInterval(() => setNowSec(Date.now() / 1000 + offset), 1000);
    return () => clearInterval(t);
  }, [offset]);

  const invalidate = async () => {
    await Promise.all([
      utils.routines.activeRun.invalidate(),
      utils.routines.list.invalidate(),
      utils.timeline.invalidate(),
      utils.habits.list.invalidate(),
    ]);
  };

  const complete = api.routines.completeStep.useMutation({ onSuccess: invalidate });
  const skip = api.routines.skipStep.useMutation({ onSuccess: invalidate });
  const abandon = api.routines.abandonRun.useMutation({ onSuccess: invalidate });

  const { currentStepRun, currentStep, steps, runSteps } = state;
  if (!currentStepRun) return null;

  const elapsed = nowSec - currentStepRun.startedAt;
  const min = currentStep?.minSeconds ?? null;
  const max = currentStep?.maxSeconds ?? null;

  const belowMin = min !== null && elapsed < min;
  const overMax = max !== null && elapsed > max;

  // With a ceiling set, show time remaining; otherwise a plain stopwatch
  const bigTime = max !== null ? fmt(max - elapsed) : fmt(elapsed);

  const doneIds = new Set(
    runSteps.filter((s) => s.status !== "active").map((s) => s.stepId),
  );
  const currentIndex = steps.findIndex((s) => s.id === currentStepRun.stepId);
  const pending = complete.isPending || skip.isPending || abandon.isPending;

  return (
    <div className="flex flex-col gap-6 rounded-xl border-[1.5px] border-border-strong bg-surface px-6 py-8">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold tracking-wide text-text/40 uppercase">
          {state.routineName} — step {Math.max(currentIndex, 0) + 1} of {steps.length}
        </p>
        <button
          onClick={() => abandon.mutate({ runId: state.run.id })}
          disabled={pending}
          className="rounded-lg border border-negative-border px-2.5 py-1 text-xs text-accent transition hover:bg-negative-soft disabled:opacity-40"
        >
          Abandon run
        </button>
      </div>

      <div className="flex flex-col items-center gap-2 py-4">
        <h2 className="text-2xl font-bold text-text">{currentStepRun.name}</h2>
        <p
          className={`font-mono text-6xl font-extrabold tabular-nums ${
            overMax ? "text-accent" : "text-text"
          }`}
        >
          {bigTime}
        </p>
        {belowMin && (
          <p className="text-sm font-medium text-text/50">
            Keep going — at least {fmt(min)} on this one
          </p>
        )}
        {overMax && (
          <p className="text-sm font-medium text-accent">
            Over the {fmt(max)} cap — wrap it up
          </p>
        )}
        {max !== null && !overMax && (
          <p className="text-xs text-text/40">elapsed {fmt(elapsed)}</p>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => complete.mutate({ runId: state.run.id })}
          disabled={pending}
          className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-on-accent transition hover:opacity-90 disabled:opacity-40"
        >
          Done — next
        </button>
        <button
          onClick={() => skip.mutate({ runId: state.run.id })}
          disabled={pending}
          className="rounded-xl border-[1.5px] border-border px-4 py-3 text-sm font-medium text-text/50 transition hover:border-border-strong hover:text-text/80 disabled:opacity-40"
        >
          Skip
        </button>
      </div>

      <ol className="flex flex-col gap-1.5 border-t border-border pt-4">
        {steps.map((s, i) => {
          const stepRun = runSteps.find((r) => r.stepId === s.id);
          const isCurrent = s.id === currentStepRun.stepId;
          return (
            <li
              key={s.id}
              className={`flex items-center gap-2 text-sm ${
                isCurrent ? "font-semibold text-text" : "text-text/40"
              }`}
            >
              <span className="w-5 text-xs tabular-nums">{i + 1}.</span>
              <span className="flex-1 truncate">{s.name}</span>
              {stepRun && stepRun.status === "completed" && (
                <span className="text-xs text-primary">
                  ✓ {fmt((stepRun.endedAt ?? stepRun.startedAt) - stepRun.startedAt)}
                </span>
              )}
              {stepRun?.status === "skipped" && (
                <span className="text-xs text-text/30">skipped</span>
              )}
              {isCurrent && <span className="text-xs text-text/50">now</span>}
              {!stepRun && !doneIds.has(s.id) && !isCurrent && (
                <span className="text-xs text-text/25">up next</span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
