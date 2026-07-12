"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "./theme-toggle";

const links = [
  { href: "/", label: "Check in" },
  { href: "/routines", label: "Routines" },
  { href: "/day", label: "Day" },
  { href: "/habits", label: "Habits" },
  { href: "/log", label: "Log" },
  { href: "/insights", label: "Insights" },
  { href: "/chat", label: "Reflect" },
  { href: "/settings", label: "Settings" },
  { href: "/feedback", label: "Feedback" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap items-center justify-end gap-1">
      {links.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`rounded-lg px-3 py-1.5 text-[13px] transition ${
              active
                ? "bg-primary font-bold text-on-accent shadow-[0_4px_12px_-4px_var(--border-strong)]"
                : "font-medium text-faint hover:text-text"
            }`}
          >
            {label}
          </Link>
        );
      })}
      <span className="ml-2">
        <ThemeToggle />
      </span>
    </nav>
  );
}
