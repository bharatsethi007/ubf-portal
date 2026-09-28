// STAFF (verify_jwt = true). Disables or re-enables a staff account.
// Disable: is_active=false (RLS access gone at once via is_staff()) + auth ban (no new logins or token refresh).
// Body: { user_id: string, active: boolean }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { cors, json } from "../_shared/portalCommon.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });

    const { data: ures } = await userClient.auth.getUser();
    if (!ures?.user) return json({ error: "unauthorized", message: "Your session has expired. Sign in again." }, 401);
    const { data: canEdit } = await userClient.rpc("has_perm", { p_module: "users", p_op: "edit" });
    if (!canEdit) return json({ error: "forbidden", message: "You do not have permission to manage users." }, 403);

    const body = await req.json().catch(() => ({}));
    const userId = typeof body?.user_id === "string" ? body.user_id.trim() : "";
    const active = body?.active === true;
    if (!userId) return json({ error: "user_id is required" }, 400);
    if (!active && userId === ures.user.id) return json({ error: "self", message: "You cannot disable your own account." }, 400);

    const db = createClient(url, service);
    const { data: target } = await db.from("staff_users").select("user_id, is_admin").eq("user_id", userId).maybeSingle();
    if (!target) return json({ error: "not_staff", message: "That user is not a staff user." }, 404);

    if (!active && target.is_admin) {
      const { count } = await db.from("staff_users").select("user_id", { count: "exact", head: true })
        .eq("is_admin", true).eq("is_active", true).neq("user_id", userId);
      if ((count ?? 0) === 0) return json({ error: "last_admin", message: "You cannot disable the last active admin." }, 400);
    }

    const { error: upErr } = await db.from("staff_users")
      .update({ is_active: active, deactivated_at: active ? null : new Date().toISOString() })
      .eq("user_id", userId);
    if (upErr) return json({ error: upErr.message }, 400);

    const { error: banErr } = await db.auth.admin.updateUserById(userId, { ban_duration: active ? "none" : "876000h" });
    if (banErr) return json({ error: "ban_failed", message: banErr.message }, 400);

    return json({ ok: true, user_id: userId, active });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
