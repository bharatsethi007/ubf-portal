// STAFF (verify_jwt = true). Creates auth user + staff_users row + roles + set-password token, emails link via Brevo.
// Body: { email: string, role_ids?: string[] }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { cors, json, normalizeEmail, resolveAuthUserId, issueStaffInviteToken } from "../_shared/portalCommon.ts";

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
    const { data: canAdd } = await userClient.rpc("has_perm", { p_module: "users", p_op: "add" });
    if (!canAdd) return json({ error: "forbidden", message: "You do not have permission to add users." }, 403);

    const body = await req.json().catch(() => ({}));
    const cleanEmail = normalizeEmail(body?.email);
    const roleIds: string[] = Array.isArray(body?.role_ids) ? body.role_ids.filter((r: unknown) => typeof r === "string") : [];
    if (!cleanEmail) return json({ error: "a valid email is required" }, 400);

    const db = createClient(url, service);
    const resolved = await resolveAuthUserId(db, cleanEmail);
    if ("error" in resolved) return json({ error: resolved.error }, 400);

    const { data: existing } = await db.from("staff_users").select("user_id").eq("user_id", resolved.userId).maybeSingle();
    if (existing) return json({ error: "already_staff", message: "This email is already a staff user." }, 409);

    const { error: insErr } = await db.from("staff_users").insert({ user_id: resolved.userId, email: cleanEmail });
    if (insErr) return json({ error: insErr.message }, 400);

    if (roleIds.length) {
      const rows = roleIds.map((role_id) => ({ user_id: resolved.userId, role_id, assigned_by: ures.user.id }));
      const { error: rErr } = await db.from("staff_user_roles").upsert(rows, { onConflict: "user_id,role_id" });
      if (rErr) return json({ error: rErr.message }, 400);
    }

    const invite = await issueStaffInviteToken(db, { userId: resolved.userId, staffId: ures.user.id });

    let emailSent = false;
    const key = Deno.env.get("BREVO_API_KEY");
    const from = Deno.env.get("STAFF_INVITE_FROM_EMAIL") ?? "no-reply@ubfreight.com";
    if (key) {
      const html = `<p>You have been invited to the UB Freight staff portal.</p>
<p><a href="${invite.link}">Click here to set your password</a> and sign in. This link expires in 7 days.</p>
<p>If you did not expect this, you can ignore this email.</p>`;
      try {
        const r = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({ sender: { email: from, name: "UB Freight" }, to: [{ email: cleanEmail }], subject: "Set up your UB Freight staff account", htmlContent: html }),
        });
        emailSent = r.ok;
      } catch { emailSent = false; }
    }

    return json({ ok: true, user_id: resolved.userId, link: invite.link, expires_at: invite.expiresAt, email_sent: emailSent });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
