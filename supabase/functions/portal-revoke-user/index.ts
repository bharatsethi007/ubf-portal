// STAFF (verify_jwt = true). Soft revoke / reactivate portal access.
// Body: { user_id: string, revoke: boolean }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { cors, json, requireStaff } from "../_shared/portalCommon.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const gate = await requireStaff(req);
    if (!gate.ok) return gate.response;

    const body = await req.json().catch(() => ({}));
    const userId = typeof body?.user_id === "string" ? body.user_id.trim() : "";
    const revoke = body?.revoke === true;

    if (!userId) return json({ error: "user_id is required" }, 400);

    const { data: row, error: findErr } = await gate.db
      .from("portal_users")
      .select("user_id, status")
      .eq("user_id", userId)
      .maybeSingle();
    if (findErr || !row) return json({ error: "portal user not found" }, 404);

    const nextStatus = revoke ? "revoked" : "active";
    const { error: updErr } = await gate.db
      .from("portal_users")
      .update({ status: nextStatus })
      .eq("user_id", userId);
    if (updErr) return json({ error: updErr.message }, 400);

    return json({ ok: true, user_id: userId, status: nextStatus });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
