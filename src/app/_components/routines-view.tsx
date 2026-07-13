"use client";

import { useEffect, useRef, useState } from "react";
import { api, type RouterOutputs } from "~/trpc/react";
import { RoutineRun } from "./routine-run";

type RoutineWithSteps = RouterOutputs["routines"]["list"][number];
type Step = RoutineWithSteps["steps"][number];

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
  const updateStep = api.routines.updateStep.useMutation({ onSuccess: invalidate });
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

            <StepList
              steps={r.steps}
              editing={editing}
              habits={habitList ?? []}
              reorderPending={reorderSteps.isPending}
              updatePending={updateStep.isPending}
              removePending={removeStep.isPending}
              onReorder={(orderedStepIds) =>
                reorderSteps.mutate({ routineId: r.id, orderedStepIds })
              }
              onUpdate={(values) => updateStep.mutate(values)}
              onRemove={(id) => removeStep.mutate({ id })}
            />

            {editing && (
              <div className="flex flex-col gap-4 border-t border-border pt-3">
                <StepForm
                  habits={habitList ?? []}
                  pending={addStep.isPending}
                  submitLabel="Add step"
                  placeholder="Add a step — e.g. Brush teeth"
                  resetOnSubmit
                  onSubmit={(values) => addStep.mutate({ routineId: r.id, ...values })}
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

// ---------------------------------------------------------------------------
// Step list with pointer-based drag reorder (works with mouse AND touch —
// native HTML5 drag events don't fire on touch devices) + inline editing
// ---------------------------------------------------------------------------

function StepList({
  steps,
  editing,
  habits,
  reorderPending,
  updatePending,
  removePending,
  onReorder,
  onUpdate,
  onRemove,
}: {
  steps: Step[];
  editing: boolean;
  habits: { id: string; name: string }[];
  reorderPending: boolean;
  updatePending: boolean;
  removePending: boolean;
  onReorder: (orderedStepIds: string[]) => void;
  onUpdate: (values: {
    id: string;
    name: string;
    habitId: string | null;
    minSeconds: number | null;
    maxSeconds: number | null;
  }) => void;
  onRemove: (id: string) => void;
}) {
  const [order, setOrder] = useState<string[] | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  // Refs mirror state so window-level pointer handlers see current values
  const orderRef = useRef<string[] | null>(null);

  const serverKey = steps.map((s) => s.id).join(",");

  // Drop the local order once the server list matches it (post-refetch)
  useEffect(() => {
    if (orderRef.current && orderRef.current.join(",") === serverKey) {
      orderRef.current = null;
      setOrder(null);
    }
  }, [serverKey]);

  const ordered = order
    ? (order.map((id) => steps.find((s) => s.id === id)).filter(Boolean) as Step[])
    : steps;

  const startDrag = (e: React.PointerEvent, id: string) => {
    if (!editing || reorderPending) return;
    e.preventDefault();
    setDraggingId(id);
    orderRef.current = ordered.map((s) => s.id);
    setOrder(orderRef.current);
    const startOrder = [...orderRef.current];

    const move = (ev: PointerEvent) => {
      for (const [otherId, el] of rowRefs.current) {
        if (otherId === id || !el) continue;
        const rect = el.getBoundingClientRect();
        if (ev.clientY > rect.top && ev.clientY < rect.bottom) {
          const cur = orderRef.current ?? [];
          const from = cur.indexOf(id);
          const to = cur.indexOf(otherId);
          if (from !== -1 && to !== -1 && from !== to) {
            const next = [...cur];
            next.splice(from, 1);
            next.splice(to, 0, id);
            orderRef.current = next;
            setOrder(next);
          }
          break;
        }
      }
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      setDraggingId(null);
      const final = orderRef.current;
      if (final && final.join(",") !== startOrder.join(",")) {
        onReorder(final);
      } else {
        orderRef.current = null;
        setOrder(null);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  if (steps.length === 0) return null;

  return (
    <ol className="flex flex-col gap-1.5">
      {ordered.map((s, i) => {
        if (editingStepId === s.id && editing) {
          return (
            <li key={s.id} className="rounded-lg border border-border-strong bg-text/5 px-2 py-2">
              <StepForm
                habits={habits}
                pending={updatePending}
                submitLabel="Save"
                placeholder="Step name"
                initial={s}
                onCancel={() => setEditingStepId(null)}
                onSubmit={(values) => {
                  onUpdate({ id: s.id, ...values });
                  setEditingStepId(null);
                }}
              />
            </li>
          );
        }
        return (
          <li
            key={s.id}
            ref={(el) => {
              if (el) rowRefs.current.set(s.id, el);
              else rowRefs.current.delete(s.id);
            }}
            className={`flex items-center gap-2 rounded-lg text-sm text-text/70 transition ${
              draggingId === s.id ? "border border-border-strong bg-text/5 opacity-80" : ""
            }`}
          >
            {editing && (
              <span
                onPointerDown={(e) => startDrag(e, s.id)}
                style={{ touchAction: "none" }}
                className="cursor-grab px-1 text-text/30 select-none hover:text-text/60 active:cursor-grabbing"
                title="Drag to reorder"
              >
                ⠿
              </span>
            )}
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
                  onClick={() => setEditingStepId(s.id)}
                  className="rounded border border-border px-1.5 py-0.5 text-xs text-text/40 transition hover:border-border-strong hover:text-text/70"
                >
                  Edit
                </button>
                <button
                  onClick={() => onRemove(s.id)}
                  disabled={removePending}
                  className="rounded border border-negative-border px-1.5 py-0.5 text-xs text-accent transition hover:bg-negative-soft disabled:opacity-30"
                >
                  ×
                </button>
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Shared step form — used to add a new step and to edit an existing one
// ---------------------------------------------------------------------------

function StepForm({
  habits,
  pending,
  submitLabel,
  placeholder,
  initial,
  resetOnSubmit = false,
  onSubmit,
  onCancel,
}: {
  habits: { id: string; name: string }[];
  pending: boolean;
  submitLabel: string;
  placeholder: string;
  initial?: Step;
  resetOnSubmit?: boolean;
  onSubmit: (values: {
    name: string;
    habitId: string | null;
    minSeconds: number | null;
    maxSeconds: number | null;
  }) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [minMinutes, setMinMinutes] = useState(
    initial?.minSeconds != null ? String(initial.minSeconds / 60) : "",
  );
  const [maxMinutes, setMaxMinutes] = useState(
    initial?.maxSeconds != null ? String(initial.maxSeconds / 60) : "",
  );
  const [habitId, setHabitId] = useState(initial?.habitId ?? "");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSubmit({
          name: name.trim(),
          habitId: habitId || null,
          minSeconds: minMinutes ? Math.round(Number(minMinutes) * 60) : null,
          maxSeconds: maxMinutes ? Math.round(Number(maxMinutes) * 60) : null,
        });
        if (resetOnSubmit) {
          setName("");
          setMinMinutes("");
          setMaxMinutes("");
          setHabitId("");
        }
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={placeholder}
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
        {submitLabel}
      </button>
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border-[1.5px] border-border px-3 py-1.5 text-xs text-text/40 transition hover:text-text/70"
        >
          Cancel
        </button>
      )}
    </form>
  );
}
