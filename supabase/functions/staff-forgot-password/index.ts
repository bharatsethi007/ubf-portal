// PUBLIC (verify_jwt = false). Self-service "forgot password" for staff.
// Body: { email: string }. Always returns { ok: true } so it never reveals whether an account exists.
// Issues a 1-hour single-use token (staff_invite_tokens) and emails a /set-password link via Brevo.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { cors, issueStaffInviteToken, json, normalizeEmail, serviceClient } from "../_shared/portalCommon.ts";
import { sendStaffEmail } from "../_shared/staffEmail.ts";

const TTL_MS = 60 * 60 * 1000; // 1 hour
const COOLDOWN_MS = 60 * 1000; // one email per minute per user
const ALLOWED_ORIGINS = ["https://console.ubfreight.com", "http://localhost:5173"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const ok = json({ ok: true });

  try {
    const body = await req.json().catch(() => ({}));
    const email = normalizeEmail(body?.email);
    if (!email) return ok;

    const db = serviceClient();
    const { data: staff } = await db.from("staff_users").select("user_id, email, first_name").eq("email", email).eq("is_active", true).maybeSingle();
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

    await sendStaffEmail(staff.email, "Reset your UBF Console password", {
      preheader: "Use this link to set a new password. It expires in 1 hour.",
      eyebrow: "Password reset",
      title: "Reset your password",
      name: staff.first_name,
      paragraphs: [
        `We received a request to reset the password for your UBF Console account (<strong style="color:#1E293B;">${staff.email}</strong>).`,
        "Choose a new password using the button below. After that you sign in as usual, with your authenticator code.",
      ],
      button: { label: "Set a new password", url: invite.link },
      expiry: "This link works once and expires in 1 hour.",
      note: "Didn't ask for this? Ignore this email. Your password stays the same, and nobody can change it without this link.",
    });
    return ok;
  } catch (e) {
    console.error("staff-forgot-password", String(e));
    return ok;
  }
});
