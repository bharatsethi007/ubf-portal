// whatsapp-verify — customer-facing number binding (portal-initiated OTP).
// verify_jwt=true: caller must present their portal session JWT. account_id is derived from
// their portal_users row (NEVER from the client). Actions: start | confirm | status.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";

const GRAPH = "https://graph.facebook.com/v25.0";
const VERIFY_TEMPLATE = "ubf_verify_code";
const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_PER_HOUR = 5;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "content-type": "application/json" } });

function serviceClient(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
}

async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function pepper(): string { return Deno.env.get("WHATSAPP_OTP_PEPPER") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "pepper"; }
function normalizeWaId(v: unknown): string { return String(v ?? "").replace(/[^0-9]/g, ""); }
function maskWa(wa: string): string { return wa.length <= 4 ? wa : `\u2022\u2022\u2022\u2022\u2022\u2022${wa.slice(-4)}`; }

async function callerAccount(req: Request): Promise<{ uid: string; account_id: string } | null> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return null;
  const sb = serviceClient();
  const { data: pu } = await sb.from("portal_users").select("account_id, status").eq("user_id", user.id).maybeSingle();
  if (!pu?.account_id) return null;
  return { uid: user.id, account_id: pu.account_id as string };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const caller = await callerAccount(req);
  if (!caller) return json({ error: "unauthorized" }, 401);

  let body: { action?: string; wa_id?: string; code?: string; consent?: boolean };
  try { body = await req.json(); } catch { body = {}; }
  const sb = serviceClient();
  const token = Deno.env.get("WHATSAPP_TOKEN");
  const phoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

  // --- status ---
  if (body.action === "status") {
    const { data: c } = await sb.from("whatsapp_contacts")
      .select("wa_id, opted_in, verified_at").eq("account_id", caller.account_id)
      .not("verified_at", "is", null).order("verified_at", { ascending: false }).limit(1).maybeSingle();
    return json({ bound: !!c, wa_id_masked: c ? maskWa(c.wa_id as string) : null, opted_in: c?.opted_in ?? false });
  }

  // --- start ---
  if (body.action === "start") {
    if (body.consent !== true) return json({ error: "consent_required" }, 400);
    if (!token || !phoneId) return json({ error: "whatsapp_not_configured" }, 500);
    const wa = normalizeWaId(body.wa_id);
    if (wa.length < 8) return json({ error: "invalid_number" }, 400);

    const sinceHour = new Date(Date.now() - 3600 * 1000).toISOString();
    const { count } = await sb.from("whatsapp_verifications")
      .select("id", { count: "exact", head: true }).eq("wa_id", wa).gte("created_at", sinceHour);
    if ((count ?? 0) >= MAX_PER_HOUR) return json({ error: "rate_limited" }, 429);

    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
    const codeHash = await sha256hex(`${code}:${wa}:${pepper()}`);
    await sb.from("whatsapp_verifications").insert({
      wa_id: wa, account_id: caller.account_id, portal_user_id: caller.uid,
      code_hash: codeHash, expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
    });

    const send = await fetch(`${GRAPH}/${phoneId}/messages`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp", to: wa, type: "template",
        template: {
          name: VERIFY_TEMPLATE, language: { code: "en_US" },
          components: [
            { type: "body", parameters: [{ type: "text", text: code }] },
            { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
          ],
        },
      }),
    });
    const sd = await send.json().catch(() => ({}));
    if (!send.ok) return json({ ok: false, error: "send_failed", detail: sd }, 502);
    return json({ ok: true, sent: true, to_masked: maskWa(wa), expires_in: CODE_TTL_MS / 1000 });
  }

  // --- confirm ---
  if (body.action === "confirm") {
    const wa = normalizeWaId(body.wa_id);
    const code = String(body.code ?? "").trim();
    if (wa.length < 8 || !/^[0-9]{6}$/.test(code)) return json({ error: "invalid_input" }, 400);

    const { data: v } = await sb.from("whatsapp_verifications").select("*")
      .eq("wa_id", wa).eq("account_id", caller.account_id).is("consumed_at", null)
      .gte("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!v) return json({ ok: false, error: "no_active_code" }, 400);
    if ((v.attempts as number) >= (v.max_attempts as number)) {
      await sb.from("whatsapp_verifications").update({ consumed_at: new Date().toISOString() }).eq("id", v.id);
      return json({ ok: false, error: "too_many_attempts" }, 400);
    }
    const attempts = (v.attempts as number) + 1;
    const codeHash = await sha256hex(`${code}:${wa}:${pepper()}`);
    if (codeHash !== v.code_hash) {
      await sb.from("whatsapp_verifications").update({ attempts }).eq("id", v.id);
      return json({ ok: false, error: "invalid_code", remaining: Math.max(0, (v.max_attempts as number) - attempts) }, 400);
    }
    await sb.from("whatsapp_verifications").update({ attempts, consumed_at: new Date().toISOString() }).eq("id", v.id);
    await sb.from("whatsapp_contacts").upsert({
      wa_id: wa, account_id: caller.account_id, portal_user_id: caller.uid,
      verified_at: new Date().toISOString(), opted_in: true, opted_in_at: new Date().toISOString(),
    }, { onConflict: "wa_id" });
    return json({ ok: true, bound: true });
  }

  return json({ error: "unknown_action", allowed: ["start", "confirm", "status"] }, 400);
});
