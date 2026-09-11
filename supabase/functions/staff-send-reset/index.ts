// STAFF (verify_jwt = true). Sends a password-reset (set-password) link to an existing staff user via Brevo.
// Reuses the same staff_invite_tokens + /set-password + staff-redeem-token flow as invites.
// Body: { user_id: string }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { cors, json, issueStaffInviteToken } from "../_shared/portalCommon.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });

    const { data: ures } = await userClient.auth.getUser();
    if (!ures?.user) return json({ error: "unauthorized" }, 401);
    const { data: staff } = await userClient.from("staff_users").select("user_id").eq("user_id", ures.user.id).maybeSingle();
    if (!staff) return json({ error: "forbidden" }, 403);
    const { data: canEdit } = await userClient.rpc("has_perm", { p_module: "users", p_op: "edit" });
    if (!canEdit) return json({ error: "forbidden", message: "You do not have permission to manage users." }, 403);

    const body = await req.json().catch(() => ({}));
    const userId = typeof body?.user_id === "string" ? body.user_id.trim() : "";
    if (!userId) return json({ error: "user_id is required" }, 400);

    const db = createClient(url, service);
    const { data: target } = await db.from("staff_users").select("email").eq("user_id", userId).maybeSingle();
    if (!target?.email) return json({ error: "not_staff", message: "That user is not a staff user." }, 404);

    const invite = await issueStaffInviteToken(db, { userId, staffId: ures.user.id });

    let emailSent = false;
    const key = Deno.env.get("BREVO_API_KEY");
    const from = Deno.env.get("STAFF_INVITE_FROM_EMAIL") ?? "no-reply@ubfreight.com";
    if (key) {
      const html = `<p>A password reset was requested for your UB Freight staff account.</p>
<p><a href="${invite.link}">Click here to set a new password</a> and sign in. This link expires in 7 days.</p>
<p>If you did not request this, you can ignore this email and your password will stay unchanged.</p>`;
      try {
        const r = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({ sender: { email: from, name: "UB Freight" }, to: [{ email: target.email }], subject: "Reset your UB Freight staff password", htmlContent: html }),
        });
        emailSent = r.ok;
      } catch { emailSent = false; }
    }

    return json({ ok: true, user_id: userId, email: target.email, link: invite.link, expires_at: invite.expiresAt, email_sent: emailSent });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
