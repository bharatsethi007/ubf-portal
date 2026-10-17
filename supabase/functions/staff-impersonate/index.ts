// STAFF (verify_jwt = true). Super admin "Sign in as" another staff user (help desk, access checks).
// Caller must be super admin on an MFA (aal2) session. Target must be active staff, not super admin.
// Mints a session for the target (magic link verified server side, no email sent), records it in
// staff_impersonations (60 min) and staff_auth_events, and returns the tokens to the caller.
// Body: { user_id: string }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { cors, json } from "../_shared/portalCommon.ts";

const MINUTES = 60;

function jwtClaims(token: string): Record<string, unknown> {
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(part + "=".repeat((4 - (part.length % 4)) % 4)));
  } catch {
    return {};
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const callerToken = authHeader.replace(/^Bearer\s+/i, "");
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });

    const { data: ures } = await userClient.auth.getUser();
    if (!ures?.user) return json({ error: "unauthorized" }, 401);
    if (jwtClaims(callerToken).aal !== "aal2") {
      return json({ error: "forbidden", message: "Two-factor sign-in required." }, 403);
    }
    const { data: isSuper } = await userClient.rpc("is_super_admin");
    if (!isSuper) return json({ error: "forbidden", message: "Super admin only." }, 403);

    const body = await req.json().catch(() => ({}));
    const userId = typeof body?.user_id === "string" ? body.user_id.trim() : "";
    if (!userId) return json({ error: "user_id is required" }, 400);
    if (userId === ures.user.id) return json({ error: "bad_target", message: "That is you." }, 400);

    const db = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: target } = await db.from("staff_users")
      .select("user_id,is_active,is_super_admin").eq("user_id", userId).maybeSingle();
    if (!target || !target.is_active) return json({ error: "bad_target", message: "Not an active staff user." }, 404);
    if (target.is_super_admin) return json({ error: "bad_target", message: "Cannot sign in as a super admin." }, 403);

    const { data: au, error: auErr } = await db.auth.admin.getUserById(userId);
    const email = au?.user?.email;
    if (auErr || !email) return json({ error: "bad_target", message: "User has no login email." }, 400);

    const { data: link, error: lErr } = await db.auth.admin.generateLink({ type: "magiclink", email });
    const hashed = link?.properties?.hashed_token;
    if (lErr || !hashed) return json({ error: lErr?.message ?? "Could not create session" }, 400);

    const otp = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: v, error: vErr } = await otp.auth.verifyOtp({ token_hash: hashed, type: "magiclink" });
    const s = v?.session;
    if (vErr || !s) return json({ error: vErr?.message ?? "Could not create session" }, 400);

    const sessionId = jwtClaims(s.access_token).session_id as string | undefined;
    if (!sessionId) return json({ error: "Session id missing" }, 500);
    const expires = new Date(Date.now() + MINUTES * 60_000).toISOString();

    const { data: row, error: iErr } = await db.from("staff_impersonations")
      .insert({ actor_id: ures.user.id, target_id: userId, session_id: sessionId, expires_at: expires })
      .select("id").single();
    if (iErr) return json({ error: iErr.message }, 500);

    await db.from("staff_auth_events").insert({
      user_id: userId, event: "impersonate_start", actor_id: ures.user.id,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      user_agent: req.headers.get("user-agent"),
      detail: { impersonation_id: row.id, expires_at: expires },
    });

    return json({ ok: true, access_token: s.access_token, refresh_token: s.refresh_token, expires_at: expires, email });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
