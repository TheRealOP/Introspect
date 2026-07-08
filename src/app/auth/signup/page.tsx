"use client";

import Link from "next/link";
import { useState } from "react";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendDone, setResendDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = (await res.json()) as { error?: string; ok?: boolean };

      if (!res.ok) {
        setError(data.error ?? "Sign-up failed. Please try again.");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResendLoading(true);
    try {
      await fetch("/api/verify/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setResendDone(true);
    } catch {
      // silent — resend endpoint always returns ok
    } finally {
      setResendLoading(false);
    }
  }

  if (submitted) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm text-center">
          <div className="mb-6 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-4xl">
              ✉️
            </div>
          </div>
          <h1 className="mb-2 text-2xl font-extrabold tracking-tight text-text">
            Check your email
          </h1>
          <p className="mb-6 text-text/50">
            We sent a verification link to{" "}
            <span className="font-medium text-text">{email}</span>. Click it
            to activate your account.
          </p>

          {resendDone ? (
            <p className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
              Verification link resent — check your inbox.
            </p>
          ) : (
            <button
              onClick={handleResend}
              disabled={resendLoading}
              className="mb-4 text-sm text-primary hover:underline disabled:opacity-50"
            >
              {resendLoading ? "Sending…" : "Resend verification email"}
            </button>
          )}

          <p className="text-sm text-text/40">
            Already verified?{" "}
            <Link href="/auth/signin" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-text">
          Introspect
        </h1>
        <p className="mb-8 text-text/50">Create your account</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm text-text/60">Email</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-text/15 bg-white px-4 py-2.5 text-text placeholder-text/30 outline-none transition focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
              placeholder="you@example.com"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm text-text/60">Password</label>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-text/15 bg-white px-4 py-2.5 text-text placeholder-text/30 outline-none transition focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
              placeholder="At least 8 characters"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-rose-500/30 bg-rose-50 px-4 py-2 text-sm text-rose-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-lg bg-primary px-4 py-2.5 font-semibold text-white transition hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-text/40">
          Already have an account?{" "}
          <Link href="/auth/signin" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
