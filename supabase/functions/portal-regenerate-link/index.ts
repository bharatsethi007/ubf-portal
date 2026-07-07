// STAFF (verify_jwt = true). Fresh set-password link for pending portal user.
// Body: { user_id: string }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { cors, issueInviteToken, json, requireStaff } from "../_shared/portalCommon.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const gate = await requireStaff(req);
    if (!gate.ok) return gate.response;

    const body = await req.json().catch(() => ({}));
    const userId = typeof body?.user_id === "string" ? body.user_id.trim() : "";
    if (!userId) return json({ error: "user_id is required" }, 400);

    const { data: row, error: findErr } = await gate.db
      .from("portal_users")
      .select("user_id, account_id, status")
      .eq("user_id", userId)
      .maybeSingle();
    if (findErr || !row) return json({ error: "portal user not found" }, 404);
    if (row.status === "active") {
      return json({ error: "already_active", message: "User is already active." }, 409);
    }

    const invite = await issueInviteToken(gate.db, {
      userId: row.user_id,
      accountId: row.account_id,
      staffId: gate.staffId,
    });

    if (row.status === "revoked") {
      await gate.db.from("portal_users").update({ status: "pending", invited_by: gate.staffId }).eq("user_id", userId);
    }

    return json({
      ok: true,
      user_id: userId,
      link: invite.link,
      expires_at: invite.expiresAt,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
