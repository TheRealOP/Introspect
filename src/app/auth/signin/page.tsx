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
      <h1 className="mb-2 text-3xl font-extrabold tracking-tight">
        Introspect
      </h1>
      <p className="mb-8 text-white/50">Sign in to your account</p>

      {verified && (
        <div className="mb-6 rounded-lg bg-green-500/20 px-4 py-3 text-sm text-green-300">
          ✓ Email verified — you can now sign in.
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm text-white/70">Email</label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-glass-border bg-glass-bg px-4 py-2.5 text-white placeholder-white/30 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400"
            placeholder="you@example.com"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm text-white/70">Password</label>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-glass-border bg-glass-bg px-4 py-2.5 text-white placeholder-white/30 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400"
            placeholder="••••••••"
          />
        </div>

        {error && (
          <div className="rounded-lg bg-red-500/20 px-4 py-2 text-sm text-red-300">
            <p>{error}</p>
            <p className="mt-1 text-red-300/70">
              Need to verify?{" "}
              <Link href="/auth/verify?error=resend" className="underline hover:text-red-200">
                Resend verification email
              </Link>
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded-lg bg-brand-primary px-4 py-2.5 font-semibold text-white transition hover:bg-brand-primary-hover disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-white/40">
        Don&apos;t have an account?{" "}
        <Link href="/auth/signup" className="text-violet-400 hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}

export default function SignInPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-brand-bg px-4 text-white">
      <Suspense fallback={null}>
        <SignInForm />
      </Suspense>
    </main>
  );
}
