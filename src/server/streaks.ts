// Streak computation — pure JS over unix-second timestamps
export function computeStreaks(seenAts: (number | null)[]): {
  current: number;
  longest: number;
} {
  const valid = seenAts.filter((t): t is number => t !== null);
  if (valid.length === 0) return { current: 0, longest: 0 };

  // Dedupe by calendar day (UTC) then sort ascending
  const days = [
    ...new Set(valid.map((ts) => new Date(ts * 1000).toISOString().slice(0, 10))),
  ].sort();

  let longest = 1;
  let run = 1;

  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1]!).getTime();
    const curr = new Date(days[i]!).getTime();
    if ((curr - prev) / 86_400_000 === 1) {
      run++;
      if (run > longest) longest = run;
    } else {
      run = 1;
    }
  }

  // Is the streak still active? (last sighting today or yesterday)
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const lastDay = days[days.length - 1];
  const current = lastDay === today || lastDay === yesterday ? run : 0;

  return { current, longest };
}
