"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const verified = params.get("verified") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { signIn } = await import("next-auth/react");
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid credentials, or email not yet verified.");
      } else {
        router.push("/");
        router.refresh();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-text">
        Introspect
      </h1>
      <p className="mb-8 text-text/50">Sign in to your account</p>

      {verified && (
        <div className="mb-6 rounded-lg border-[1.5px] border-border-strong bg-chip px-4 py-3 text-sm text-accent-text">
          ✓ Email verified — you can now sign in.
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm text-text/60">Email</label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border-[1.5px] border-border bg-surface px-4 py-2.5 text-text placeholder-text/30 outline-none transition focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
            placeholder="you@example.com"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm text-text/60">Password</label>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border-[1.5px] border-border bg-surface px-4 py-2.5 text-text placeholder-text/30 outline-none transition focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
            placeholder="••••••••"
          />
        </div>

        {error && (
          <div className="rounded-lg border-[1.5px] border-negative-border bg-negative-soft px-4 py-2 text-sm text-accent">
            <p>{error}</p>
            <p className="mt-1 text-accent/80">
              Need to verify?{" "}
              <Link href="/auth/verify?error=resend" className="underline hover:text-accent">
                Resend verification email
              </Link>
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded-lg bg-primary px-4 py-2.5 font-bold text-on-accent shadow-[0_4px_12px_-4px_var(--border-strong)] transition hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-text/40">
        Don&apos;t have an account?{" "}
        <Link href="/auth/signup" className="text-primary hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}

export default function SignInPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <Suspense fallback={null}>
        <SignInForm />
      </Suspense>
    </main>
  );
}
