export const runtime = "nodejs";

import { auth } from "~/server/auth";

export default auth((req) => {
  const isAuthed = !!req.auth;
  const { pathname } = req.nextUrl;

  // Allow auth routes and the signup/verify APIs through without a session
  const isPublic =
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/signup") ||
    pathname.startsWith("/api/verify");

  if (!isAuthed && !isPublic) {
    const signInUrl = new URL("/auth/signin", req.url);
    return Response.redirect(signInUrl);
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static assets
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
