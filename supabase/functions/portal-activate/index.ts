// STAFF (verify_jwt = true). Creates auth user + portal_users row + set-password token.
// Body: { account_id: string, email: string, display_name?: string }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  cors,
  issueInviteToken,
  json,
  normalizeEmail,
  requireStaff,
  resolveAuthUserId,
} from "../_shared/portalCommon.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const gate = await requireStaff(req);
    if (!gate.ok) return gate.response;

    const body = await req.json().catch(() => ({}));
    const accountId = typeof body?.account_id === "string" ? body.account_id.trim() : "";
    const cleanEmail = normalizeEmail(body?.email);
    const displayName = typeof body?.display_name === "string" ? body.display_name.trim() : null;

    if (!accountId || !cleanEmail) return json({ error: "account_id and email are required" }, 400);

    const { data: customer } = await gate.db.from("customers").select("account_id").eq("account_id", accountId).maybeSingle();
    if (!customer) return json({ error: "customer not found" }, 404);

    const resolved = await resolveAuthUserId(gate.db, cleanEmail);
    if ("error" in resolved) return json({ error: resolved.error }, 400);

    const { data: portalRow } = await gate.db
      .from("portal_users")
      .select("status")
      .eq("user_id", resolved.userId)
      .maybeSingle();

    if (portalRow?.status === "active") {
      return json({ error: "already_active", message: "Portal user is already active. Regenerate link instead." }, 409);
    }

    const { error: upsertErr } = await gate.db.from("portal_users").upsert({
      user_id: resolved.userId,
      account_id: accountId,
      email: cleanEmail,
      display_name: displayName || null,
      status: "pending",
      invited_by: gate.staffId,
      activated_at: null,
    }, { onConflict: "user_id" });
    if (upsertErr) return json({ error: upsertErr.message }, 400);

    const invite = await issueInviteToken(gate.db, {
      userId: resolved.userId,
      accountId,
      staffId: gate.staffId,
    });

    return json({
      ok: true,
      user_id: resolved.userId,
      reused_auth_user: !resolved.created,
      link: invite.link,
      expires_at: invite.expiresAt,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
