export const runtime = "nodejs";

import { auth } from "~/server/auth";

export default auth((req) => {
  const isAuthed = !!req.auth;
  const { pathname } = req.nextUrl;

  // Paths reachable without a session. Beyond auth flows this must include:
  // - /api/cron/* : called by Vercel Cron with no session cookie (guarded by
  //   CRON_SECRET in the route itself). See audit C2.
  // - /api/feedback : supports anonymous submissions.
  // - the PWA manifest, service worker, and icons : fetched without cookies.
  const isPublic =
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/signup") ||
    pathname.startsWith("/api/verify") ||
    pathname.startsWith("/api/cron") ||
    pathname === "/api/feedback" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js" ||
    pathname === "/icon-192.png" ||
    pathname === "/icon-512.png" ||
    pathname === "/apple-touch-icon.png";

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
