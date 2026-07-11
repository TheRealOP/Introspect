"use client";

import { api } from "~/trpc/react";

export function LogView() {
  const { data: entries, isLoading } = api.journal.list.useQuery();

  if (isLoading) {
    return <p className="text-sm text-text/40">Loading check-ins…</p>;
  }

  if (!entries || entries.length === 0) {
    return (
      <p className="text-center text-sm text-text/40">
        No check-ins yet. Head to Check in to log your first one.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="rounded-xl border-[1.5px] border-border bg-surface p-4"
        >
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-text/90">
            {entry.content}
          </p>
          <p className="mt-2 text-xs text-text/30">
            {entry.createdAt
              ? new Date(entry.createdAt * 1000).toLocaleString()
              : "—"}
          </p>
        </div>
      ))}
    </div>
  );
}
