"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function VerifyContent() {
  const params = useSearchParams();
  const error = params.get("error");

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleResend(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/verify/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="w-full max-w-sm text-center">
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20 text-4xl">
            ✓
          </div>
        </div>
        <h1 className="mb-2 text-2xl font-extrabold tracking-tight">
          Email sent
        </h1>
        <p className="mb-6 text-white/50">
          Check your inbox for a new verification link.
        </p>
        <Link href="/auth/signin" className="text-sm text-violet-400 hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm text-center">
      <div className="mb-6 flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20 text-4xl">
          ⚠️
        </div>
      </div>
      <h1 className="mb-2 text-2xl font-extrabold tracking-tight">
        {error === "expired" ? "Link expired" : "Invalid link"}
      </h1>
      <p className="mb-8 text-white/50">
        {error === "expired"
          ? "Your verification link has expired. Enter your email to get a new one."
          : "This verification link is invalid or has already been used."}
      </p>

      <form onSubmit={handleResend} className="flex flex-col gap-4 text-left">
        <div className="flex flex-col gap-1">
          <label className="text-sm text-white/70">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-white/30 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400"
            placeholder="you@example.com"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-violet-600 px-4 py-2.5 font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
        >
          {loading ? "Sending…" : "Send new verification link"}
        </button>
      </form>

      <p className="mt-6 text-sm text-white/40">
        <Link href="/auth/signin" className="text-violet-400 hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] px-4 text-white">
      <Suspense fallback={null}>
        <VerifyContent />
      </Suspense>
    </main>
  );
}
