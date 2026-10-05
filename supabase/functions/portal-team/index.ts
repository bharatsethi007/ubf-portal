// CUSTOMER (verify_jwt = true). Customer admins manage their own portal team.
// Body: { action: 'invite', email, name?, role? } | { action: 'resend' | 'remove' | 'restore', user_id } | { action: 'set_role', user_id, role }
// Rules: caller must be an active portal user with role 'admin'; every target must be on the caller's account;
// an account always keeps at least one active admin; emails already used for any other login (staff, driver,
// another customer) are refused, so an invite can never take over an existing account.
// Self-contained on purpose (no ../_shared import) so the deployed bundle matches this file exactly.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { inviteEmail } from "./inviteEmail.ts";
import { apiFetch, setApiFn } from "../_shared/apiFetch.ts";
setApiFn("portal-team");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
const fail = (message: string, status = 400) => json({ error: message }, status);

const PORTAL_URL = (Deno.env.get("CUSTOMER_PORTAL_URL") ?? "https://portal.ubfreight.com").replace(/\/$/, "");
const MAX_USERS = 25;
const TOKEN_TTL_MS = 7 * 24 * 3600 * 1000;

type Me = { user_id: string; account_id: string; role: string; email: string; display_name: string | null };

function token(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function findAuthUser(db: SupabaseClient, email: string): Promise<string | null> {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data?.users?.length) return null;
    const hit = data.users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (hit) return hit.id;
    if (data.users.length < 1000) return null;
  }
  return null;
}

async function sendInvite(db: SupabaseClient, me: Me, userId: string, email: string, name: string | null): Promise<boolean> {
  await db.from("portal_invite_tokens").update({ used_at: new Date().toISOString() }).eq("user_id", userId).is("used_at", null);
  const t = token();
  const { error } = await db.from("portal_invite_tokens").insert({
    token: t, user_id: userId, account_id: me.account_id, expires_at: new Date(Date.now() + TOKEN_TTL_MS).toISOString(), created_by: me.user_id,
  });
  if (error) throw new Error(error.message);
  const { data: cust } = await db.from("customers").select("name").eq("account_id", me.account_id).maybeSingle();
  const link = `${PORTAL_URL}/portal/set-password?token=${encodeURIComponent(t)}`;
  const mail = inviteEmail({ inviter: me.display_name || me.email, company: cust?.name ?? null, name, link });
  const key = Deno.env.get("BREVO_API_KEY");
  if (!key) { console.error("BREVO_API_KEY not set"); return false; }
  const r = await apiFetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { email: Deno.env.get("STAFF_INVITE_FROM_EMAIL") ?? "no-reply@ubfreight.com", name: "UB Freight" },
      to: [{ email }], replyTo: { email: me.email }, subject: mail.subject, htmlContent: mail.html, textContent: mail.text,
    }),
  });
  if (!r.ok) console.error("brevo", r.status, await r.text());
  return r.ok;
}

async function activeAdmins(db: SupabaseClient, accountId: string): Promise<string[]> {
  const { data } = await db.from("portal_users").select("user_id").eq("account_id", accountId).eq("role", "admin").eq("status", "active");
  return (data ?? []).map((r) => r.user_id as string);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fail("method not allowed", 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: ures } = await userClient.auth.getUser();
    if (!ures?.user) return fail("unauthorized", 401);
    const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: meRow } = await db.from("portal_users").select("user_id, account_id, role, email, display_name, status").eq("user_id", ures.user.id).maybeSingle();
    if (!meRow || meRow.status !== "active") return fail("forbidden", 403);
    if (meRow.role !== "admin") return fail("Only account admins can manage the team.", 403);
    const me = meRow as Me;

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");

    if (action === "invite") {
      const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return fail("Enter a valid email address.");
      const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim().slice(0, 100) : null;
      const role = body?.role === "admin" ? "admin" : "member";

      const { count } = await db.from("portal_users").select("user_id", { count: "exact", head: true })
        .eq("account_id", me.account_id).neq("status", "revoked");
      if ((count ?? 0) >= MAX_USERS) return fail(`Your account has reached ${MAX_USERS} users. Remove someone first or contact UB Freight.`);

      const existing = await findAuthUser(db, email);
      let userId = existing;
      if (existing) {
        const { data: pu } = await db.from("portal_users").select("account_id, status").eq("user_id", existing).maybeSingle();
        // Never attach an existing login that isn't already on this account (staff, drivers, other customers).
        if (!pu || pu.account_id !== me.account_id) return fail("This email can't be added. Contact UB Freight for help.", 409);
        if (pu.status === "active") return fail("This person already has access.", 409);
        const { error } = await db.from("portal_users").update({ status: "pending", role, display_name: name ?? undefined, invited_by: me.user_id, activated_at: null }).eq("user_id", existing);
        if (error) throw error;
      } else {
        const { data: created, error } = await db.auth.admin.createUser({ email, email_confirm: true, password: `${crypto.randomUUID()}${crypto.randomUUID()}Aa1!` });
        if (error || !created.user) return fail("Could not create the invite. Try again.");
        userId = created.user.id;
        const { error: insErr } = await db.from("portal_users").insert({
          user_id: userId, account_id: me.account_id, email, display_name: name, status: "pending", role, invited_by: me.user_id,
        });
        if (insErr) { await db.auth.admin.deleteUser(userId); throw insErr; }
      }
      const sent = await sendInvite(db, me, userId!, email, name);
      return json({ ok: true, user_id: userId, emailed: sent });
    }

    const targetId = typeof body?.user_id === "string" ? body.user_id : "";
    const { data: target } = await db.from("portal_users").select("user_id, account_id, email, display_name, status, role").eq("user_id", targetId).maybeSingle();
    if (!target || target.account_id !== me.account_id) return fail("Person not found.", 404);
    const admins = await activeAdmins(db, me.account_id);
    const lastAdmin = target.role === "admin" && target.status === "active" && admins.length <= 1;

    if (action === "resend") {
      if (target.status !== "pending") return fail("Only pending invites can be resent.");
      const sent = await sendInvite(db, me, target.user_id, target.email, target.display_name);
      return json({ ok: true, emailed: sent });
    }
    if (action === "set_role") {
      const role = body?.role === "admin" ? "admin" : body?.role === "member" ? "member" : null;
      if (!role) return fail("Choose admin or member.");
      if (role === "member" && lastAdmin) return fail("Your account needs at least one admin. Make someone else admin first.");
      const { error } = await db.from("portal_users").update({ role }).eq("user_id", target.user_id);
      if (error) throw error;
      return json({ ok: true });
    }
    if (action === "remove") {
      if (lastAdmin) return fail("Your account needs at least one admin. Make someone else admin first.");
      const { error } = await db.from("portal_users").update({ status: "revoked" }).eq("user_id", target.user_id);
      if (error) throw error;
      await db.from("portal_invite_tokens").update({ used_at: new Date().toISOString() }).eq("user_id", target.user_id).is("used_at", null);
      // Access stops at once: every portal view and RPC requires status = 'active' via my_account_id().
      return json({ ok: true });
    }
    if (action === "restore") {
      if (target.status !== "revoked") return fail("This person isn't removed.");
      // Back to pending with a fresh invite: they set a new password, nothing old is reused.
      const { error } = await db.from("portal_users").update({ status: "pending", invited_by: me.user_id, activated_at: null }).eq("user_id", target.user_id);
      if (error) throw error;
      const sent = await sendInvite(db, me, target.user_id, target.email, target.display_name);
      return json({ ok: true, emailed: sent });
    }
    return fail("Unknown action.");
  } catch (e) {
    console.error(e);
    return fail("Something went wrong. Try again.", 500);
  }
});
