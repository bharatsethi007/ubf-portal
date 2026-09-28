// STAFF (verify_jwt = true). Sends a password-reset (set-password) link to an existing staff user via Brevo.
// Reuses the same staff_invite_tokens + /set-password + staff-redeem-token flow as invites.
// Body: { user_id: string }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { cors, json, issueStaffInviteToken } from "../_shared/portalCommon.ts";
import { sendStaffEmail } from "../_shared/staffEmail.ts";

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
    const { data: target } = await db.from("staff_users").select("email, first_name, is_active").eq("user_id", userId).maybeSingle();
    if (!target?.email) return json({ error: "not_staff", message: "That user is not a staff user." }, 404);
    if (target.is_active === false) return json({ error: "inactive", message: "Re-enable this account before sending a reset link." }, 400);

    const invite = await issueStaffInviteToken(db, { userId, staffId: ures.user.id });

    const { data: admin } = await db.from("staff_users").select("full_name").eq("user_id", ures.user.id).maybeSingle();
    const who = admin?.full_name?.trim() || "An administrator";
    const emailSent = await sendStaffEmail(target.email, "Reset your UBF Console password", {
      preheader: `${who} sent you a link to set a new password.`,
      eyebrow: "Password reset",
      title: "Reset your password",
      name: target.first_name,
      paragraphs: [
        `${who} has sent you a link to reset the password for your UBF Console account (<strong style="color:#1E293B;">${target.email}</strong>).`,
        "Choose a new password using the button below. After that you sign in as usual, with your authenticator code.",
      ],
      button: { label: "Set a new password", url: invite.link },
      expiry: "This link works once and expires in 7 days.",
      note: `Not expecting this? Check with ${who === "An administrator" ? "your manager" : who} before using the link.`,
    });

    return json({ ok: true, user_id: userId, email: target.email, link: invite.link, expires_at: invite.expiresAt, email_sent: emailSent });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
