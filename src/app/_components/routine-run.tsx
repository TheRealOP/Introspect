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
  const [customName, setCustomName] = useState("");

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
  const defer = api.routines.deferStep.useMutation({ onSuccess: invalidate });
  const choose = api.routines.chooseStep.useMutation({ onSuccess: invalidate });
  const chooseCustom = api.routines.chooseCustomStep.useMutation({
    onSuccess: async () => {
      setCustomName("");
      await invalidate();
    },
  });
  const finish = api.routines.finishRun.useMutation({ onSuccess: invalidate });
  const abandon = api.routines.abandonRun.useMutation({ onSuccess: invalidate });

  const { currentStepRun, currentStep, steps, runSteps, remainingSteps } = state;

  const pending =
    complete.isPending ||
    skip.isPending ||
    defer.isPending ||
    choose.isPending ||
    chooseCustom.isPending ||
    finish.isPending ||
    abandon.isPending;

  // A step may have several attempts now (deferred, then re-run) — render the
  // latest one.
  const latestRunFor = (stepId: string) =>
    [...runSteps].reverse().find((r) => r.stepId === stepId);

  // Ad-hoc steps live only in step_runs; their stepId matches no routine step
  const stepIds = new Set(steps.map((s) => s.id));
  const customRuns = runSteps.filter((r) => !stepIds.has(r.stepId));

  const currentIndex = currentStepRun
    ? steps.findIndex((s) => s.id === currentStepRun.stepId)
    : -1;

  const startCustom = () => {
    const name = customName.trim();
    if (!name) return;
    chooseCustom.mutate({ runId: state.run.id, name });
  };

  const elapsed = currentStepRun ? nowSec - currentStepRun.startedAt : 0;
  const min = currentStep?.minSeconds ?? null;
  const max = currentStep?.maxSeconds ?? null;

  const belowMin = min !== null && elapsed < min;
  const overMax = max !== null && elapsed > max;

  // With a ceiling set, show time remaining; otherwise a plain stopwatch
  const bigTime = max !== null ? fmt(max - elapsed) : fmt(elapsed);

  return (
    <div className="flex flex-col gap-6 rounded-xl border-[1.5px] border-border-strong bg-surface px-6 py-8">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold tracking-wide text-text/40 uppercase">
          {state.routineName}
          {currentStepRun
            ? currentIndex >= 0
              ? ` — step ${currentIndex + 1} of ${steps.length}`
              : " — extra step"
            : " — choosing next"}
        </p>
        <button
          onClick={() => abandon.mutate({ runId: state.run.id })}
          disabled={pending}
          className="rounded-lg border border-negative-border px-2.5 py-1 text-xs text-accent transition hover:bg-negative-soft disabled:opacity-40"
        >
          Abandon run
        </button>
      </div>

      {currentStepRun ? (
        <>
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
            {currentIndex >= 0 && (
              <button
                onClick={() => defer.mutate({ runId: state.run.id })}
                disabled={pending}
                className="rounded-xl border-[1.5px] border-border px-4 py-3 text-sm font-medium text-text/50 transition hover:border-border-strong hover:text-text/80 disabled:opacity-40"
              >
                Do later
              </button>
            )}
            <button
              onClick={() => skip.mutate({ runId: state.run.id })}
              disabled={pending}
              className="rounded-xl border-[1.5px] border-border px-4 py-3 text-sm font-medium text-text/50 transition hover:border-border-strong hover:text-text/80 disabled:opacity-40"
            >
              Skip
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-4">
          <h2 className="text-center text-2xl font-bold text-text">
            What&apos;s next?
          </h2>

          <div className="flex flex-col gap-2">
            {remainingSteps.map((s, i) => (
              <button
                key={s.id}
                onClick={() => choose.mutate({ runId: state.run.id, stepId: s.id })}
                disabled={pending}
                className={`flex items-center justify-between rounded-xl px-4 py-3 text-left text-sm transition disabled:opacity-40 ${
                  i === 0
                    ? "bg-primary font-bold text-on-accent hover:opacity-90"
                    : "border-[1.5px] border-border font-medium text-text hover:border-border-strong"
                }`}
              >
                <span className="truncate">{s.name}</span>
                {(s.minSeconds !== null || s.maxSeconds !== null) && (
                  <span
                    className={`ml-3 shrink-0 text-xs ${
                      i === 0 ? "text-on-accent/70" : "text-text/40"
                    }`}
                  >
                    {s.minSeconds !== null && `≥ ${fmt(s.minSeconds)}`}
                    {s.minSeconds !== null && s.maxSeconds !== null && " · "}
                    {s.maxSeconds !== null && `≤ ${fmt(s.maxSeconds)}`}
                  </span>
                )}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              startCustom();
            }}
            className="flex gap-2"
          >
            <input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Something else…"
              className="min-w-0 flex-1 rounded-xl border-[1.5px] border-border bg-transparent px-4 py-3 text-sm text-text placeholder:text-text/30 focus:border-border-strong focus:outline-none"
            />
            <button
              type="submit"
              disabled={pending || customName.trim().length === 0}
              className="rounded-xl border-[1.5px] border-border px-4 py-3 text-sm font-medium text-text/70 transition hover:border-border-strong hover:text-text disabled:opacity-40"
            >
              Start
            </button>
          </form>

          <button
            onClick={() => finish.mutate({ runId: state.run.id })}
            disabled={pending}
            className="rounded-xl border-[1.5px] border-border px-4 py-3 text-sm font-medium text-text/50 transition hover:border-border-strong hover:text-text/80 disabled:opacity-40"
          >
            Finish routine
          </button>
        </div>
      )}

      <ol className="flex flex-col gap-1.5 border-t border-border pt-4">
        {steps.map((s, i) => {
          const stepRun = latestRunFor(s.id);
          const isCurrent = currentStepRun?.stepId === s.id;
          return (
            <li
              key={s.id}
              className={`flex items-center gap-2 text-sm ${
                isCurrent ? "font-semibold text-text" : "text-text/40"
              }`}
            >
              <span className="w-5 text-xs tabular-nums">{i + 1}.</span>
              <span className="flex-1 truncate">{s.name}</span>
              {stepRun?.status === "completed" && (
                <span className="text-xs text-primary">
                  ✓ {fmt((stepRun.endedAt ?? stepRun.startedAt) - stepRun.startedAt)}
                </span>
              )}
              {stepRun?.status === "skipped" && (
                <span className="text-xs text-text/30">skipped</span>
              )}
              {stepRun?.status === "deferred" && !isCurrent && (
                <span className="text-xs text-text/30">later</span>
              )}
              {isCurrent && <span className="text-xs text-text/50">now</span>}
              {!stepRun && !isCurrent && (
                <span className="text-xs text-text/25">up next</span>
              )}
            </li>
          );
        })}
        {customRuns.map((r) => (
          <li
            key={r.id}
            className={`flex items-center gap-2 text-sm ${
              r.status === "active" ? "font-semibold text-text" : "text-text/40"
            }`}
          >
            <span className="w-5 text-xs">+</span>
            <span className="flex-1 truncate">{r.name}</span>
            {r.status === "completed" && (
              <span className="text-xs text-primary">
                ✓ {fmt((r.endedAt ?? r.startedAt) - r.startedAt)}
              </span>
            )}
            {r.status === "skipped" && (
              <span className="text-xs text-text/30">skipped</span>
            )}
            {r.status === "active" && (
              <span className="text-xs text-text/50">now</span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
