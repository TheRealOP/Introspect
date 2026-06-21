import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "~/server/auth";
import { createFeedback } from "~/server/db/users-client";
import { sendFeedbackEmail } from "~/server/email";

const schema = z.object({
  message: z.string().min(1).max(5000),
  email: z.string().email().optional().or(z.literal("")),
  category: z.enum(["bug", "idea", "praise", "other"]).optional(),
  // Honeypot — must be empty; bots fill it, humans don't
  _hp: z.string().max(0).optional(),
});

export async function POST(req: Request) {
  const body: unknown = await req.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { message, email, category, _hp } = parsed.data;

  // Honeypot triggered — silently accept but don't store
  if (_hp) {
    return NextResponse.json({ ok: true });
  }

  const session = await auth();
  const userId = session?.user?.id ?? undefined;
  const userAgent = req.headers.get("user-agent") ?? undefined;
  const resolvedEmail = email || session?.user?.email || undefined;

  await createFeedback({
    message,
    email: resolvedEmail,
    category,
    userId,
    userAgent,
  });

  try {
    await sendFeedbackEmail({ message, email: resolvedEmail, category });
  } catch (err) {
    // Feedback is already persisted — don't fail the request over email
    console.error("[FEEDBACK] Failed to send email notification:", err);
  }

  return NextResponse.json({ ok: true });
}
