// PUBLIC (verify_jwt = false). Self-service "forgot password" for staff.
// Body: { email: string }. Always returns { ok: true } so it never reveals whether an account exists.
// Issues a 1-hour single-use token (staff_invite_tokens) and emails a /set-password link via Brevo.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { cors, issueStaffInviteToken, json, normalizeEmail, serviceClient } from "../_shared/portalCommon.ts";

const TTL_MS = 60 * 60 * 1000; // 1 hour
const COOLDOWN_MS = 60 * 1000; // one email per minute per user
const ALLOWED_ORIGINS = ["https://console.ubfreight.com", "http://localhost:5173"];

function emailHtml(link: string, base: string): string {
  return `<!doctype html><html><body style="margin:0;background:#F4F5F7;font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fff;border-radius:12px;padding:32px">
<tr><td><img src="${base}/ub-freight-logo.png" alt="UB Freight" height="40" style="display:block;margin-bottom:24px"></td></tr>
<tr><td style="font-size:20px;color:#0A2472;font-weight:bold;padding-bottom:12px">Reset your password</td></tr>
<tr><td style="font-size:14px;color:#334155;line-height:1.6;padding-bottom:24px">
We received a request to reset the password for your UB Freight Console account. This link works once and expires in 1 hour.</td></tr>
<tr><td style="padding-bottom:24px"><a href="${link}" style="display:inline-block;background:#0A2472;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:15px">Set a new password</a></td></tr>
<tr><td style="font-size:12px;color:#64748b;line-height:1.6">If you did not ask for this, ignore this email. Your password stays the same.</td></tr>
</table></td></tr></table></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const ok = json({ ok: true });

  try {
    const body = await req.json().catch(() => ({}));
    const email = normalizeEmail(body?.email);
    if (!email) return ok;

    const db = serviceClient();
    const { data: staff } = await db.from("staff_users").select("user_id, email").eq("email", email).maybeSingle();
    if (!staff?.user_id || !staff.email) return ok;

    // Cooldown: skip if a token was issued for this user very recently.
    const since = new Date(Date.now() - COOLDOWN_MS).toISOString();
    const { count } = await db.from("staff_invite_tokens").select("token", { count: "exact", head: true })
      .eq("user_id", staff.user_id).gt("created_at", since);
    if ((count ?? 0) > 0) return ok;

    const origin = (req.headers.get("origin") ?? "").replace(/\/$/, "");
    const base = ALLOWED_ORIGINS.includes(origin)
      ? origin
      : (Deno.env.get("PORTAL_PUBLIC_BASE_URL") ?? ALLOWED_ORIGINS[0]).replace(/\/$/, "");

    const invite = await issueStaffInviteToken(db, { userId: staff.user_id, staffId: staff.user_id, ttlMs: TTL_MS, baseUrl: base });

    const key = Deno.env.get("BREVO_API_KEY");
    const from = Deno.env.get("STAFF_INVITE_FROM_EMAIL") ?? "no-reply@ubfreight.com";
    if (key) {
      const r = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          sender: { email: from, name: "UB Freight" },
          to: [{ email: staff.email }],
          subject: "Reset your UB Freight Console password",
          htmlContent: emailHtml(invite.link, base.startsWith("http://localhost") ? ALLOWED_ORIGINS[0] : base),
        }),
      });
      if (!r.ok) console.error("brevo send failed", r.status, await r.text());
    } else {
      console.error("BREVO_API_KEY not set");
    }
    return ok;
  } catch (e) {
    console.error("staff-forgot-password", String(e));
    return ok;
  }
});
