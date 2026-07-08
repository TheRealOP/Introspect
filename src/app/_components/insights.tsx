"use client";

import Link from "next/link";
import { api } from "~/trpc/react";

const sentimentDot: Record<string, string> = {
  positive: "bg-emerald-500",
  negative: "bg-rose-500",
  neutral: "bg-text/20",
};

const tagStyle: Record<string, string> = {
  aware: "border-sky-500/40 bg-sky-500/10 text-sky-700",
  unaware: "border-amber-500/40 bg-amber-500/15 text-amber-700",
  wantToBuild: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700",
  wantToRemove: "border-rose-500/40 bg-rose-500/10 text-rose-700",
};

const tagLabel: Record<string, string> = {
  aware: "aware",
  unaware: "unaware",
  wantToBuild: "want to build",
  wantToRemove: "want to remove",
};

export function InsightsView() {
  const utils = api.useUtils();

  const { data: streaks, isLoading: streaksLoading } = api.insights.streaks.useQuery();
  const { data: nudgeStats } = api.insights.nudgeStats.useQuery();
  const { data: profileData, isLoading: profileLoading } = api.insights.get.useQuery();
  const { data: currentSettings } = api.settings.get.useQuery();

  const refresh = api.insights.refresh.useMutation({
    onSuccess: async () => {
      await utils.insights.get.invalidate();
    },
  });

  const tagsByHabit: Record<string, string[]> = {};
  if (profileData?.profile?.habitTags) {
    for (const ht of profileData.profile.habitTags) {
      tagsByHabit[ht.name.toLowerCase()] = ht.tags;
    }
  }

  const hasProfile = !!profileData?.profile?.summary;
  const isStale = profileData?.isStale ?? false;

  return (
    <div className="flex w-full max-w-2xl flex-col gap-8">

      {/* ── AI provider banner ── */}
      <div className="flex items-center justify-between rounded-xl border border-text/10 bg-white px-4 py-3">
        <p className="text-xs text-text/40">
          {currentSettings
            ? <>AI: <span className="text-text/60">{currentSettings.provider} / {currentSettings.model}</span></>
            : <span>Using default AI provider</span>}
        </p>
        <Link
          href="/settings"
          className="text-xs text-primary transition hover:text-primary/80"
        >
          Change →
        </Link>
      </div>

      {/* ── Habit Streaks ── */}
      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-text/40">
          Habit Streaks
        </h2>

        {streaksLoading && (
          <p className="text-sm text-text/40">Loading streaks…</p>
        )}

        {streaks && streaks.length === 0 && (
          <p className="text-sm text-text/40">
            No habits yet. Log a check-in to get started.
          </p>
        )}

        {streaks && streaks.length > 0 && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {streaks.map((h) => {
              const tags = tagsByHabit[h.name.toLowerCase()] ?? [];
              return (
                <div
                  key={h.id}
                  className="flex flex-col gap-2 rounded-xl border border-text/10 bg-white px-4 py-3"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${sentimentDot[h.sentiment] ?? "bg-text/20"}`}
                    />
                    <p className="truncate text-sm font-medium text-text/90">{h.name}</p>
                  </div>

                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${tagStyle[tag] ?? "border-text/10 text-text/40"}`}
                        >
                          {tagLabel[tag] ?? tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-4 text-xs text-text/40">
                    <span>
                      <span className="font-semibold text-text/70">{h.current}</span>d current
                    </span>
                    <span>
                      <span className="font-semibold text-text/70">{h.longest}</span>d best
                    </span>
                    <span>{h.occurrences}× seen</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── AI Profile ── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-text/40">
            AI Profile
          </h2>
          <button
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
              isStale
                ? "border-amber-500/50 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20"
                : "border-text/15 bg-text/5 text-text/40 hover:border-text/25 hover:text-text/60"
            }`}
          >
            {refresh.isPending
              ? "Building…"
              : isStale
                ? "↻ Refresh (new data)"
                : hasProfile
                  ? "↻ Refresh"
                  : "Build profile"}
          </button>
        </div>

        {profileLoading && (
          <p className="text-sm text-text/40">Loading profile…</p>
        )}

        {!profileLoading && !hasProfile && (
          <div className="rounded-xl border border-text/10 bg-white p-5 text-center">
            <p className="text-sm text-text/40">
              No profile yet. Add some check-ins, then click <span className="text-text/60">Build profile</span> to let the AI analyse your habits.
            </p>
          </div>
        )}

        {hasProfile && profileData?.profile && (
          <div className="flex flex-col gap-4">
            {/* Summary */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary/60">
                Summary
              </p>
              <p className="text-sm leading-relaxed text-text/80">
                {profileData.profile.summary}
              </p>
            </div>

            {/* Habit tags */}
            {profileData.profile.habitTags.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-text/30">
                  Habit tags
                </p>
                <div className="flex flex-col gap-2">
                  {profileData.profile.habitTags.map((ht) => (
                    <div
                      key={ht.name}
                      className="flex flex-wrap items-center gap-2 rounded-xl border border-text/10 bg-white px-4 py-2.5"
                    >
                      <span className="text-sm text-text/80">{ht.name}</span>
                      {ht.tags.map((tag) => (
                        <span
                          key={tag}
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${tagStyle[tag] ?? "border-text/10 text-text/40"}`}
                        >
                          {tagLabel[tag] ?? tag}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Suggestions */}
            {profileData.profile.suggestions.length > 0 && (
              <div className="rounded-xl border border-secondary/40 bg-secondary/10 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-text/50">
                  Suggestions
                </p>
                <ul className="flex flex-col gap-2">
                  {profileData.profile.suggestions.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-text/70">
                      <span className="mt-0.5 text-secondary">→</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Nudge preference */}
            {profileData.profile.nudgePreference && (
              <div className="rounded-xl border border-accent/40 bg-accent/15 p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-text/50">
                  Nudge preference
                </p>
                <p className="text-sm text-text/70">{profileData.profile.nudgePreference}</p>
              </div>
            )}

            {profileData.profile.updatedAt && (
              <p className="text-xs text-text/30">
                Last updated {new Date(profileData.profile.updatedAt * 1000).toLocaleString()}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Nudge Stats ── */}
      {nudgeStats && nudgeStats.total > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-text/40">
            Nudges you act on
          </h2>

          <div className="flex gap-4 rounded-xl border border-text/10 bg-white px-4 py-3 text-sm">
            <div>
              <span className="font-semibold text-text/80">{nudgeStats.picked}</span>
              <span className="ml-1 text-text/40">picked</span>
            </div>
            <div>
              <span className="font-semibold text-text/80">{nudgeStats.pickRate}%</span>
              <span className="ml-1 text-text/40">pick rate</span>
            </div>
            <div>
              <span className="font-semibold text-text/80">{nudgeStats.total}</span>
              <span className="ml-1 text-text/40">offered</span>
            </div>
          </div>

          {nudgeStats.topPicked.length > 0 && (
            <div className="flex flex-col gap-2">
              {nudgeStats.topPicked.map((n) => (
                <div
                  key={n.action}
                  className="flex items-start justify-between gap-3 rounded-xl border border-text/10 bg-white px-4 py-3"
                >
                  <p className="text-sm leading-relaxed text-text/70">{n.action}</p>
                  <span className="shrink-0 text-xs text-text/30">{n.count}×</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
