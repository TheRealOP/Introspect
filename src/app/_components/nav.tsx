"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Check in" },
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
    <nav className="flex items-center gap-1">
      {links.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`rounded-lg px-3 py-1.5 text-sm transition ${
              active
                ? "bg-primary text-white"
                : "text-text/50 hover:text-text"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
