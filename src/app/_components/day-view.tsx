"use client";

import { useState } from "react";
import { api } from "~/trpc/react";

function dayBounds(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return {
    start: Math.floor(start.getTime() / 1000),
    end: Math.floor(end.getTime() / 1000),
  };
}

function fmtClock(unix: number) {
  return new Date(unix * 1000).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtHours(seconds: number) {
  const h = seconds / 3600;
  if (h >= 1) return `${h.toFixed(1)}h`;
  return `${Math.round(seconds / 60)}m`;
}

const kindStyle: Record<string, { chip: string; label: string }> = {
  routine_step: { chip: "border-border-strong bg-chip text-accent-text", label: "routine" },
  checkin: { chip: "border-border bg-text/5 text-text/50", label: "check-in" },
};

export function DayView() {
  const [date, setDate] = useState(() => new Date());
  const { start, end } = dayBounds(date);
  const { data, isLoading } = api.timeline.day.useQuery({ start, end });

  const isToday = dayBounds(new Date()).start === start;

  const shift = (days: number) => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    setDate(next);
  };

  // Merge events + gaps into one chronological list of blocks
  const blocks = [
    ...(data?.events.map((e) => ({
      id: e.id,
      title: e.title,
      kind: e.kind,
      startAt: e.startAt,
      endAt: e.endAt,
    })) ?? []),
    ...(data?.gaps.map((g, i) => ({
      id: `gap-${i}`,
      title: "Unaccounted",
      kind: "gap",
      startAt: g.startAt,
      endAt: g.endAt,
    })) ?? []),
  ].sort((a, b) => a.startAt - b.startAt);

  return (
    <div className="flex flex-col gap-5">
      {/* Date navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => shift(-1)}
          className="rounded-lg border-[1.5px] border-border px-3 py-1.5 text-xs text-text/50 transition hover:border-border-strong hover:text-text/80"
        >
          ← Previous
        </button>
        <p className="text-sm font-semibold text-text/80">
          {isToday
            ? "Today"
            : date.toLocaleDateString([], {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
        </p>
        <button
          onClick={() => shift(1)}
          disabled={isToday}
          className="rounded-lg border-[1.5px] border-border px-3 py-1.5 text-xs text-text/50 transition hover:border-border-strong hover:text-text/80 disabled:opacity-30"
        >
          Next →
        </button>
      </div>

      {/* Totals */}
      {data && (
        <div className="flex gap-4 rounded-xl border-[1.5px] border-border bg-surface px-4 py-3 text-sm">
          <span className="text-text/70">
            <span className="font-bold text-text">{fmtHours(data.accountedSeconds)}</span>{" "}
            accounted
          </span>
          <span className="text-text/70">
            <span className="font-bold text-accent">{fmtHours(data.unaccountedSeconds)}</span>{" "}
            unaccounted
          </span>
        </div>
      )}

      {isLoading && <p className="text-sm text-text/40">Loading your day…</p>}

      {!isLoading && blocks.length === 0 && (
        <p className="text-center text-sm text-text/40">
          Nothing on this day yet. Check-ins and routine runs will show up here.
        </p>
      )}

      {/* Timeline */}
      <div className="flex flex-col gap-2">
        {blocks.map((b) => {
          const duration = b.endAt - b.startAt;
          if (b.kind === "gap") {
            return (
              <div
                key={b.id}
                className="flex items-center gap-3 rounded-xl border-[1.5px] border-dashed border-border px-4 py-2.5"
              >
                <span className="w-28 shrink-0 text-xs text-text/30 tabular-nums">
                  {fmtClock(b.startAt)} – {fmtClock(b.endAt)}
                </span>
                <span className="flex-1 text-sm text-text/30 italic">Unaccounted</span>
                <span className="text-xs text-text/30">{fmtHours(duration)}</span>
              </div>
            );
          }
          const style = kindStyle[b.kind] ?? kindStyle.checkin!;
          return (
            <div
              key={b.id}
              className="flex items-center gap-3 rounded-xl border-[1.5px] border-border bg-surface px-4 py-2.5"
            >
              <span className="w-28 shrink-0 text-xs text-text/40 tabular-nums">
                {fmtClock(b.startAt)} – {fmtClock(b.endAt)}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-text/80">{b.title}</span>
              <span
                className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${style.chip}`}
              >
                {style.label}
              </span>
              <span className="shrink-0 text-xs text-text/40">{fmtHours(duration)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
