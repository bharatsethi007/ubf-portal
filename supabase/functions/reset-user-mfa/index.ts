// STAFF (verify_jwt = true). Resets a staff user's MFA by unenrolling all their factors.
// User is forced to re-enroll on next login. Recovery path for lost/replaced authenticator.
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
    const { data: canEdit } = await userClient.rpc("has_perm", { p_module: "users", p_op: "edit" });
    if (!canEdit) return json({ error: "forbidden", message: "You do not have permission to manage users." }, 403);

    const body = await req.json().catch(() => ({}));
    const userId = typeof body?.user_id === "string" ? body.user_id.trim() : "";
    if (!userId) return json({ error: "user_id is required" }, 400);

    const db = createClient(url, service);
    const { data: target } = await db.from("staff_users").select("user_id").eq("user_id", userId).maybeSingle();
    if (!target) return json({ error: "not_staff", message: "That user is not a staff user." }, 404);

    const { data: factors, error: lErr } = await db.auth.admin.mfa.listFactors({ userId });
    if (lErr) return json({ error: lErr.message }, 400);
    let removed = 0;
    for (const f of factors?.factors ?? []) {
      const { error: dErr } = await db.auth.admin.mfa.deleteFactor({ userId, id: f.id });
      if (!dErr) removed += 1;
    }

    return json({ ok: true, user_id: userId, factors_removed: removed });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
