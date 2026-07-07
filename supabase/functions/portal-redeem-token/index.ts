// PUBLIC (verify_jwt = false). Token in body authorises set-password.
// Body: { token: string, password: string }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { cors, json, serviceClient, validatePassword } from "../_shared/portalCommon.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!token || !password) return json({ error: "token and password are required" }, 400);
    const pwError = validatePassword(password);
    if (pwError) return json({ error: pwError }, 400);

    const db = serviceClient();
    const now = new Date().toISOString();

    const { data: row, error: tokErr } = await db
      .from("portal_invite_tokens")
      .select("user_id, expires_at, used_at")
      .eq("token", token)
      .maybeSingle();

    if (tokErr || !row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) {
      return json({ error: "invalid_token" }, 400);
    }

    const { data: portalUser, error: puErr } = await db
      .from("portal_users")
      .select("email, status")
      .eq("user_id", row.user_id)
      .maybeSingle();
    if (puErr || !portalUser?.email || portalUser.status === "revoked") {
      return json({ error: "invalid_token" }, 400);
    }

    // Atomic single-use: only one concurrent redeem can mark the token used.
    const { data: consumed, error: consumeErr } = await db
      .from("portal_invite_tokens")
      .update({ used_at: now })
      .eq("token", token)
      .is("used_at", null)
      .gt("expires_at", now)
      .select("user_id")
      .maybeSingle();
    if (consumeErr || !consumed) return json({ error: "invalid_token" }, 400);

    const { error: pwErr } = await db.auth.admin.updateUserById(consumed.user_id, { password });
    if (pwErr) return json({ error: pwErr.message }, 400);

    const { error: actErr } = await db
      .from("portal_users")
      .update({ status: "active", activated_at: now })
      .eq("user_id", consumed.user_id);
    if (actErr) return json({ error: actErr.message }, 400);

    return json({ ok: true, email: portalUser.email });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
