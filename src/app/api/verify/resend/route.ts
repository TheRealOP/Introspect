import { NextResponse } from "next/server";

import {
  createVerificationToken,
  getUserByEmail,
  initUsersDb,
} from "~/server/db/users-client";
import { sendVerificationEmail } from "~/server/email";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: string };
    const { email } = body;

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
