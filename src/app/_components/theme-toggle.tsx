"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // localStorage unavailable (private mode) — theme still flips for this page
    }
  };

  return (
    <button
      onClick={toggle}
      className="shrink-0 rounded-lg border-[1.5px] border-border bg-secondary-soft px-3 py-1.5 text-[13px] font-bold text-secondary-text transition hover:opacity-90"
    >
      {/* Label shows the mode you'd switch to; stable "Dark mode" until mounted to avoid hydration mismatch */}
      {mounted && isDark ? "Light mode" : "Dark mode"}
    </button>
  );
}
