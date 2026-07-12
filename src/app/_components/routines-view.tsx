"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { RoutineRun } from "./routine-run";

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function minutesToTime(mins: number | null) {
  if (mins === null) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function timeToMinutes(value: string): number | null {
  if (!value) return null;
  const [h, m] = value.split(":").map(Number);
  if (h === undefined || m === undefined || Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function parseDays(json: string | null): number[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((d): d is number => typeof d === "number") : [];
  } catch {
    return [];
  }
}

function fmtDuration(seconds: number | null) {
  if (seconds === null) return null;
  return seconds % 60 === 0 ? `${seconds / 60}m` : `${Math.floor(seconds / 60)}m${seconds % 60}s`;
}

export function RoutinesView() {
  const utils = api.useUtils();
  const { data: activeRun, isLoading: runLoading } = api.routines.activeRun.useQuery();
  const { data: routineList, isLoading } = api.routines.list.useQuery();
  const { data: habitList } = api.habits.list.useQuery();

  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<
    Record<
      string,
      {
        name: string;
        reason: string;
        habitId: string | null;
        minSeconds?: number | null;
        maxSeconds?: number | null;
      }[]
    >
  >({});

  const invalidate = async () => {
    await utils.routines.invalidate();
  };

  const createRoutine = api.routines.create.useMutation({
    onSuccess: async () => {
      setNewName("");
      await invalidate();
    },
  });
  const updateRoutine = api.routines.update.useMutation({ onSuccess: invalidate });
  const deleteRoutine = api.routines.delete.useMutation({
    onSuccess: async () => {
      setEditingId(null);
      await invalidate();
    },
  });
  const addStep = api.routines.addStep.useMutation({ onSuccess: invalidate });
  const removeStep = api.routines.removeStep.useMutation({ onSuccess: invalidate });
  const reorderSteps = api.routines.reorderSteps.useMutation({ onSuccess: invalidate });
  const startRun = api.routines.startRun.useMutation({
    onSuccess: () => utils.routines.activeRun.invalidate(),
  });
  const suggestSteps = api.routines.suggestSteps.useMutation({
    onSuccess: (data, variables) => {
      setSuggestions((prev) => ({ ...prev, [variables.routineId]: data }));
    },
  });

  if (runLoading || isLoading) {
    return <p className="text-sm text-text/40">Loading routines…</p>;
  }

  // A run is in progress — the run screen takes over the page
  if (activeRun) {
    return <RoutineRun state={activeRun} />;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Create */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (newName.trim()) createRoutine.mutate({ name: newName.trim() });
        }}
        className="flex gap-2"
      >
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New routine — e.g. Morning routine"
          className="flex-1 rounded-xl border-[1.5px] border-border bg-surface px-4 py-2.5 text-sm text-text placeholder:text-text/30 focus:border-border-strong focus:outline-none"
        />
        <button
          type="submit"
          disabled={createRoutine.isPending || !newName.trim()}
          className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-on-accent transition hover:opacity-90 disabled:opacity-40"
        >
          Create
        </button>
      </form>

      {(!routineList || routineList.length === 0) && (
        <p className="text-center text-sm text-text/40">
          No routines yet. Create one and chain your first habits together.
        </p>
      )}

      {routineList?.map((r) => {
        const editing = editingId === r.id;
        const days = parseDays(r.daysOfWeek);
        return (
          <div
            key={r.id}
            className="flex flex-col gap-3 rounded-xl border-[1.5px] border-border bg-surface px-4 py-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-text/90">{r.name}</p>
                <p className="mt-0.5 text-xs text-text/40">
                  {r.steps.length} step{r.steps.length === 1 ? "" : "s"}
                  {days.length > 0 && ` · ${days.map((d) => DAY_LABELS[d]).join(" ")}`}
                  {r.anchorMinutes !== null && ` · ${minutesToTime(r.anchorMinutes)}`}
                  {r.lastRun &&
                    ` · last run ${new Date(r.lastRun.startedAt * 1000).toLocaleDateString()} (${r.lastRun.status})`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => setEditingId(editing ? null : r.id)}
                  className="rounded-lg border-[1.5px] border-border px-2.5 py-1 text-xs text-text/40 transition hover:border-border-strong hover:text-text/70"
                >
                  {editing ? "Close" : "Edit"}
                </button>
                <button
                  onClick={() => startRun.mutate({ routineId: r.id })}
                  disabled={startRun.isPending || r.steps.length === 0}
                  className="rounded-lg bg-primary px-3 py-1 text-xs font-bold text-on-accent transition hover:opacity-90 disabled:opacity-40"
                >
                  Start
                </button>
              </div>
            </div>

            {/* Steps */}
            {r.steps.length > 0 && (
              <ol className="flex flex-col gap-1.5">
                {r.steps.map((s, i) => (
                  <li key={s.id} className="flex items-center gap-2 text-sm text-text/70">
                    <span className="w-5 text-xs text-text/30 tabular-nums">{i + 1}.</span>
                    <span className="flex-1 truncate">{s.name}</span>
                    {s.minSeconds !== null && (
                      <span className="text-xs text-text/40">≥{fmtDuration(s.minSeconds)}</span>
                    )}
                    {s.maxSeconds !== null && (
                      <span className="text-xs text-text/40">≤{fmtDuration(s.maxSeconds)}</span>
                    )}
                    {editing && (
                      <span className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            const ids = r.steps.map((x) => x.id);
                            if (i === 0) return;
                            [ids[i - 1], ids[i]] = [ids[i]!, ids[i - 1]!];
                            reorderSteps.mutate({ routineId: r.id, orderedStepIds: ids });
                          }}
                          disabled={i === 0 || reorderSteps.isPending}
                          className="rounded border border-border px-1.5 text-xs text-text/40 transition hover:text-text/70 disabled:opacity-30"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => {
                            const ids = r.steps.map((x) => x.id);
                            if (i === ids.length - 1) return;
                            [ids[i], ids[i + 1]] = [ids[i + 1]!, ids[i]!];
                            reorderSteps.mutate({ routineId: r.id, orderedStepIds: ids });
                          }}
                          disabled={i === r.steps.length - 1 || reorderSteps.isPending}
                          className="rounded border border-border px-1.5 text-xs text-text/40 transition hover:text-text/70 disabled:opacity-30"
                        >
                          ↓
                        </button>
                        <button
                          onClick={() => removeStep.mutate({ id: s.id })}
                          disabled={removeStep.isPending}
                          className="rounded border border-negative-border px-1.5 text-xs text-accent transition hover:bg-negative-soft disabled:opacity-30"
                        >
                          ×
                        </button>
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            )}

            {editing && (
              <div className="flex flex-col gap-4 border-t border-border pt-3">
                <AddStepForm
                  routineId={r.id}
                  habits={habitList ?? []}
                  pending={addStep.isPending}
                  onAdd={(values) => addStep.mutate(values)}
                />

                {/* Schedule */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-text/40">Days:</span>
                  {DAY_LABELS.map((label, d) => {
                    const active = days.includes(d);
                    return (
                      <button
                        key={d}
                        onClick={() => {
                          const next = active ? days.filter((x) => x !== d) : [...days, d].sort();
                          updateRoutine.mutate({
                            id: r.id,
                            daysOfWeek: next.length > 0 ? next : null,
                          });
                        }}
                        className={`rounded-lg border px-2 py-1 text-xs font-medium transition ${
                          active
                            ? "border-border-strong bg-chip text-accent-text"
                            : "border-border bg-text/5 text-text/40 hover:text-text/60"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                  <span className="ml-2 text-xs text-text/40">Around:</span>
                  <input
                    type="time"
                    defaultValue={minutesToTime(r.anchorMinutes)}
                    onBlur={(e) =>
                      updateRoutine.mutate({
                        id: r.id,
                        anchorMinutes: timeToMinutes(e.target.value),
                      })
                    }
                    className="rounded-lg border-[1.5px] border-border bg-surface px-2 py-1 text-xs text-text focus:border-border-strong focus:outline-none"
                  />
                </div>

                {/* AI chain suggestions */}
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => suggestSteps.mutate({ routineId: r.id })}
                    disabled={suggestSteps.isPending}
                    className="self-start rounded-lg border-[1.5px] border-border-strong bg-chip px-3 py-1.5 text-xs font-semibold text-accent-text transition hover:opacity-80 disabled:opacity-40"
                  >
                    {suggestSteps.isPending && suggestSteps.variables?.routineId === r.id
                      ? "Thinking…"
                      : "✦ Suggest next step"}
                  </button>
                  {suggestions[r.id]?.map((sug, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 rounded-lg border border-border bg-text/5 px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-text/80">{sug.name}</p>
                        <p className="mt-0.5 text-xs text-text/40">{sug.reason}</p>
                      </div>
                      <button
                        onClick={() => {
                          addStep.mutate({
                            routineId: r.id,
                            name: sug.name,
                            habitId: sug.habitId,
                            minSeconds: sug.minSeconds ?? null,
                            maxSeconds: sug.maxSeconds ?? null,
                          });
                          setSuggestions((prev) => ({
                            ...prev,
                            [r.id]: (prev[r.id] ?? []).filter((_, j) => j !== i),
                          }));
                        }}
                        disabled={addStep.isPending}
                        className="shrink-0 rounded-lg bg-primary px-2.5 py-1 text-xs font-bold text-on-accent transition hover:opacity-90 disabled:opacity-40"
                      >
                        Add
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => deleteRoutine.mutate({ id: r.id })}
                  disabled={deleteRoutine.isPending}
                  className="self-start rounded-lg border border-negative-border px-2.5 py-1 text-xs text-accent transition hover:bg-negative-soft disabled:opacity-40"
                >
                  Delete routine
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AddStepForm({
  routineId,
  habits,
  pending,
  onAdd,
}: {
  routineId: string;
  habits: { id: string; name: string }[];
  pending: boolean;
  onAdd: (values: {
    routineId: string;
    name: string;
    habitId?: string | null;
    minSeconds?: number | null;
    maxSeconds?: number | null;
  }) => void;
}) {
  const [name, setName] = useState("");
  const [minMinutes, setMinMinutes] = useState("");
  const [maxMinutes, setMaxMinutes] = useState("");
  const [habitId, setHabitId] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onAdd({
          routineId,
          name: name.trim(),
          habitId: habitId || null,
          minSeconds: minMinutes ? Math.round(Number(minMinutes) * 60) : null,
          maxSeconds: maxMinutes ? Math.round(Number(maxMinutes) * 60) : null,
        });
        setName("");
        setMinMinutes("");
        setMaxMinutes("");
        setHabitId("");
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Add a step — e.g. Brush teeth"
        className="min-w-40 flex-1 rounded-lg border-[1.5px] border-border bg-surface px-3 py-1.5 text-xs text-text placeholder:text-text/30 focus:border-border-strong focus:outline-none"
      />
      <input
        value={minMinutes}
        onChange={(e) => setMinMinutes(e.target.value)}
        type="number"
        min="0"
        step="0.5"
        placeholder="min (m)"
        title="Minimum minutes — don't rush this step"
        className="w-20 rounded-lg border-[1.5px] border-border bg-surface px-2 py-1.5 text-xs text-text placeholder:text-text/30 focus:border-border-strong focus:outline-none"
      />
      <input
        value={maxMinutes}
        onChange={(e) => setMaxMinutes(e.target.value)}
        type="number"
        min="0"
        step="0.5"
        placeholder="max (m)"
        title="Maximum minutes — don't overrun this step"
        className="w-20 rounded-lg border-[1.5px] border-border bg-surface px-2 py-1.5 text-xs text-text placeholder:text-text/30 focus:border-border-strong focus:outline-none"
      />
      <select
        value={habitId}
        onChange={(e) => setHabitId(e.target.value)}
        title="Link to a tracked habit so completions feed its streak"
        className="rounded-lg border-[1.5px] border-border bg-surface px-2 py-1.5 text-xs text-text/70 focus:border-border-strong focus:outline-none"
      >
        <option value="">No habit link</option>
        {habits.map((h) => (
          <option key={h.id} value={h.id}>
            {h.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending || !name.trim()}
        className="rounded-lg border-[1.5px] border-border-strong px-3 py-1.5 text-xs font-semibold text-text/70 transition hover:bg-text/5 disabled:opacity-40"
      >
        Add step
      </button>
    </form>
  );
}
