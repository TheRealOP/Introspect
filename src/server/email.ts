import { env } from "~/env";

const FEEDBACK_TO = env.FEEDBACK_TO ?? "ojaspolakhare@gmail.com";

export async function sendFeedbackEmail({
  message,
  email,
  category,
}: {
  message: string;
  email?: string;
  category?: string;
}): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.log(
      `\n[FEEDBACK] New feedback received:\nCategory: ${category ?? "—"}\nFrom: ${email ?? "anonymous"}\n\n${message}\n`,
    );
    return;
  }

  const from = env.EMAIL_FROM ?? "Introspect <onboarding@resend.dev>";
  const categoryLabel = category ?? "general";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#15162c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#15162c;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#1e1b4b;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:40px;">
          <tr>
            <td>
              <h1 style="margin:0 0 4px;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Introspect</h1>
              <p style="margin:0 0 28px;font-size:13px;color:rgba(255,255,255,0.4);">New feedback submitted</p>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="padding:4px 0;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,0.3);width:90px;">Category</td>
                  <td style="padding:4px 0;font-size:13px;color:rgba(255,255,255,0.7);">${categoryLabel}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,0.3);">From</td>
                  <td style="padding:4px 0;font-size:13px;color:rgba(255,255,255,0.7);">${email ? `<a href="mailto:${email}" style="color:#a78bfa;text-decoration:none;">${email}</a>` : "Anonymous"}</td>
                </tr>
              </table>

              <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:16px 20px;">
                <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.85);line-height:1.7;white-space:pre-wrap;">${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
              </div>

              ${
                email
                  ? `<p style="margin:20px 0 0;font-size:12px;color:rgba(255,255,255,0.25);">Reply to this email to respond directly to the submitter.</p>`
                  : ""
              }
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const body: Record<string, unknown> = {
    from,
    to: [FEEDBACK_TO],
    subject: `[Introspect Feedback] ${categoryLabel}`,
    html,
  };

  if (email) {
    body.reply_to = email;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to send feedback email: ${err}`);
  }
}

export async function sendVerificationEmail(
  email: string,
  verifyUrl: string,
): Promise<void> {
  if (!env.RESEND_API_KEY) {
    // Dev fallback — print to server console
    console.log(
      `\n[EMAIL] Verification link for ${email}:\n${verifyUrl}\n`,
    );
    return;
  }

  const from = env.EMAIL_FROM ?? "Introspect <onboarding@resend.dev>";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#15162c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#15162c;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#1e1b4b;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:40px;">
          <tr>
            <td>
              <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Introspect</h1>
              <p style="margin:0 0 32px;font-size:15px;color:rgba(255,255,255,0.5);">Verify your email address</p>
              <p style="margin:0 0 24px;font-size:15px;color:rgba(255,255,255,0.8);line-height:1.6;">
                Click the button below to verify your email and activate your account. This link expires in <strong style="color:#ffffff;">24 hours</strong>.
              </p>
              <a href="${verifyUrl}"
                 style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;">
                Verify email
              </a>
              <p style="margin:24px 0 0;font-size:13px;color:rgba(255,255,255,0.3);line-height:1.6;">
                If you didn't create an Introspect account, you can safely ignore this email.
              </p>
              <p style="margin:16px 0 0;font-size:12px;color:rgba(255,255,255,0.2);word-break:break-all;">
                ${verifyUrl}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Verify your Introspect email",
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to send verification email: ${err}`);
  }
}
