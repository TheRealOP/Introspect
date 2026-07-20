import { NextResponse } from "next/server";

import {
  createVerificationToken,
  getUserByEmail,
  initUsersDb,
} from "~/server/db/users-client";
import { sendVerificationEmail } from "~/server/email";
import { checkRateLimit } from "~/server/rate-limit";

export async function POST(req: Request) {
  try {
    // Tighter limit than signup — this endpoint has no password/DB
    // provisioning cost gate, so it's cheaper to abuse for email spam.
    const rateLimit = await checkRateLimit(req, "resend", {
      perIp: [{ windowSeconds: 60 * 60, max: 3 }], // 3/hour
    });
    if (rateLimit.limited) {
      return NextResponse.json(
        { error: "Too many attempts, please try again later" },
        { status: 429 },
      );
    }

    const body = (await req.json()) as { email?: string };
    // Emails are stored trimmed + lowercased at signup; match that here.
    const email = body.email?.trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ ok: true }); // don't leak anything
    }

    await initUsersDb();
    const user = await getUserByEmail(email);

    // Only resend if the user exists and is not yet verified
    if (user && !user.emailVerified) {
      const token = await createVerificationToken(email);
      const origin = new URL(req.url).origin;
      const verifyUrl = `${origin}/api/verify?token=${token}`;
      await sendVerificationEmail(email, verifyUrl);
    }

    // Always return ok — don't leak whether the email is registered
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[verify/resend]", err);
    return NextResponse.json({ ok: true });
  }
}
