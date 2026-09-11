// STAFF (verify_jwt = true). Removes a staff user: role assignments, overrides, invite tokens, staff_users row.
// Also deletes the auth account IF the user has no customer-portal access; otherwise leaves auth intact.
// Guards: cannot delete yourself; cannot delete an is_admin user.
// Body: { user_id: string }
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
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });

    const { data: ures } = await userClient.auth.getUser();
    if (!ures?.user) return json({ error: "unauthorized" }, 401);
    const { data: staff } = await userClient.from("staff_users").select("user_id").eq("user_id", ures.user.id).maybeSingle();
    if (!staff) return json({ error: "forbidden" }, 403);
    const { data: canDelete } = await userClient.rpc("has_perm", { p_module: "users", p_op: "delete" });
    if (!canDelete) return json({ error: "forbidden", message: "You do not have permission to delete users." }, 403);

    const body = await req.json().catch(() => ({}));
    const userId = typeof body?.user_id === "string" ? body.user_id.trim() : "";
    if (!userId) return json({ error: "user_id is required" }, 400);
    if (userId === ures.user.id) return json({ error: "self_delete", message: "You cannot delete your own account." }, 400);

    const db = createClient(url, service);
    const { data: target } = await db.from("staff_users").select("user_id, is_admin").eq("user_id", userId).maybeSingle();
    if (!target) return json({ error: "not_staff", message: "That user is not a staff user." }, 404);
    if (target.is_admin) return json({ error: "is_admin", message: "Admin users cannot be deleted here. Remove admin first." }, 400);

    await db.from("staff_user_roles").delete().eq("user_id", userId);
    await db.from("user_permission_overrides").delete().eq("user_id", userId);
    await db.from("staff_invite_tokens").delete().eq("user_id", userId);
    const { error: delErr } = await db.from("staff_users").delete().eq("user_id", userId);
    if (delErr) return json({ error: delErr.message }, 400);

    // Only remove the auth account if this person is NOT also a customer-portal user.
    const { data: portal } = await db.from("portal_users").select("user_id").eq("user_id", userId).maybeSingle();
    let authDeleted = false;
    if (!portal) {
      const { error: aErr } = await db.auth.admin.deleteUser(userId);
      authDeleted = !aErr;
    }

    return json({ ok: true, user_id: userId, auth_deleted: authDeleted, kept_for_portal: !!portal });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
