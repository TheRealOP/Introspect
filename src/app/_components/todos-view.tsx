"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "~/trpc/react";
import type { RouterOutputs } from "~/trpc/react";

type Todo = RouterOutputs["todos"]["list"][number];

function AddTodoInput({
  onAdd,
  isPending,
  placeholder = "Add a todo…",
  className = "",
}: {
  onAdd: (title: string) => void;
  isPending: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [title, setTitle] = useState("");

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setTitle("");
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        placeholder={placeholder}
        className="w-full rounded-lg border-[1.5px] border-border bg-surface px-3 py-2 text-sm text-text placeholder-text/30 outline-none transition focus:border-primary/40 focus:ring-1 focus:ring-primary/10"
      />
      <button
        onClick={submit}
        disabled={!title.trim() || isPending}
        className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-on-accent shadow-[0_4px_12px_-4px_var(--border-strong)] transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Add
      </button>
    </div>
  );
}

function CheckButton({
  onClick,
  disabled,
  checked = false,
}: {
  onClick: () => void;
  disabled?: boolean;
  checked?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={checked ? "Mark as open" : "Mark as done"}
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] transition disabled:cursor-not-allowed disabled:opacity-40 ${
        checked
          ? "border-primary bg-primary text-on-accent"
          : "border-border-strong text-transparent hover:bg-chip"
      }`}
    >
      <svg viewBox="0 0 12 12" className="h-3 w-3 fill-none stroke-current stroke-[2]">
        <path d="M2 6l2.5 2.5L10 3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

export function TodosList() {
  const utils = api.useUtils();
  const [showDone, setShowDone] = useState(false);

  const { data: open, isLoading } = api.todos.list.useQuery({ status: "open" });
  const { data: done } = api.todos.list.useQuery({ status: "done" });

  const invalidate = () => utils.todos.list.invalidate();

  const add = api.todos.add.useMutation({ onSuccess: invalidate });
  const setStatus = api.todos.setStatus.useMutation({ onSuccess: invalidate });

  const doneSorted = [...(done ?? [])].sort(
    (a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0),
  );

  return (
    <div className="flex flex-col gap-6">
      <AddTodoInput onAdd={(title) => add.mutate({ title })} isPending={add.isPending} />

      {isLoading ? (
        <p className="text-sm text-text/40">Loading todos…</p>
      ) : !open || open.length === 0 ? (
        <p className="rounded-xl border-[1.5px] border-border bg-surface p-4 text-sm text-text/40">
          Nothing on your list — mention tasks in a check-in and they&apos;ll appear here.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {open.map((todo: Todo) => (
            <div
              key={todo.id}
              className="flex items-center gap-3 rounded-xl border-[1.5px] border-border bg-surface px-4 py-3"
            >
              <CheckButton
                onClick={() => setStatus.mutate({ id: todo.id, status: "done" })}
                disabled={setStatus.isPending}
              />
              <p className="flex-1 truncate text-sm text-text/90">{todo.title}</p>
              <button
                onClick={() => setStatus.mutate({ id: todo.id, status: "dismissed" })}
                disabled={setStatus.isPending}
                aria-label="Dismiss"
                className="shrink-0 text-text/20 transition hover:text-text/50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <button
          onClick={() => setShowDone((s) => !s)}
          className="flex items-center gap-1.5 self-start text-xs font-semibold uppercase tracking-widest text-text/40 transition hover:text-text/70"
        >
          <span className={`transition-transform ${showDone ? "rotate-90" : ""}`}>›</span>
          Done{doneSorted.length > 0 ? ` (${doneSorted.length})` : ""}
        </button>

        {showDone && (
          <div className="flex flex-col gap-2">
            {doneSorted.length === 0 ? (
              <p className="text-sm text-text/30">Nothing completed yet.</p>
            ) : (
              doneSorted.map((todo: Todo) => (
                <div
                  key={todo.id}
                  className="flex items-center gap-3 rounded-xl border-[1.5px] border-border bg-surface px-4 py-3"
                >
                  <CheckButton
                    checked
                    onClick={() => setStatus.mutate({ id: todo.id, status: "open" })}
                    disabled={setStatus.isPending}
                  />
                  <p className="flex-1 truncate text-sm text-text/50 line-through">
                    {todo.title}
                  </p>
                  <button
                    onClick={() => setStatus.mutate({ id: todo.id, status: "open" })}
                    disabled={setStatus.isPending}
                    className="shrink-0 text-xs text-text/30 transition hover:text-text/60 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    undo
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const OPEN_TODOS_VISIBLE_CAP = 6;

export function OpenTodos() {
  const utils = api.useUtils();
  const { data: open, isLoading } = api.todos.list.useQuery({ status: "open" });

  const invalidate = () => utils.todos.list.invalidate();

  const add = api.todos.add.useMutation({ onSuccess: invalidate });
  const setStatus = api.todos.setStatus.useMutation({ onSuccess: invalidate });

  const visible = (open ?? []).slice(0, OPEN_TODOS_VISIBLE_CAP);
  const hasMore = (open?.length ?? 0) > OPEN_TODOS_VISIBLE_CAP;

  return (
    <div className="flex w-full max-w-2xl flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-text/40">Todos</p>
        {hasMore && (
          <Link
            href="/todos"
            className="text-xs text-accent-text transition hover:text-text/70"
          >
            View all →
          </Link>
        )}
      </div>

      <AddTodoInput
        onAdd={(title) => add.mutate({ title })}
        isPending={add.isPending}
        placeholder="Add a todo…"
      />

      {isLoading ? (
        <p className="text-sm text-text/40">Loading todos…</p>
      ) : visible.length === 0 ? (
        <p className="rounded-xl border-[1.5px] border-border bg-surface p-4 text-sm text-text/40">
          Nothing on your list — mention tasks in a check-in and they&apos;ll appear here.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((todo: Todo) => (
            <div
              key={todo.id}
              className="flex items-center gap-3 rounded-xl border-[1.5px] border-border bg-surface px-4 py-3"
            >
              <CheckButton
                onClick={() => setStatus.mutate({ id: todo.id, status: "done" })}
                disabled={setStatus.isPending}
              />
              <p className="flex-1 truncate text-sm text-text/90">{todo.title}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
