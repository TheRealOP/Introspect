import { NextResponse } from "next/server";

import { consumeVerificationToken, markEmailVerified } from "~/server/db/users-client";

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/auth/verify?error=missing", origin));
  }

  const result = await consumeVerificationToken(token);

  if (!result) {
    return NextResponse.redirect(new URL("/auth/verify?error=expired", origin));
  }

  await markEmailVerified(result.email);

  return NextResponse.redirect(new URL("/auth/signin?verified=1", origin));
}
