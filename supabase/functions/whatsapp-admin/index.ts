// whatsapp-admin — one-off admin ops against the Graph API using the stored token.
// Auth: header 'x-ubf-secret' == WHATSAPP_SEND_SECRET.
// Actions: subscribe_waba, list_subscribed, create_verify_template, list_templates.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GRAPH = "https://graph.facebook.com/v25.0";
const VERIFY_TEMPLATE = "ubf_verify_code";
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });

function authorize(req: Request): boolean {
  const secret = Deno.env.get("WHATSAPP_SEND_SECRET");
  return !!secret && (req.headers.get("x-ubf-secret") ?? "") === secret;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  if (!authorize(req)) return json({ error: "unauthorized" }, 401);

  let body: { action?: string };
  try { body = await req.json(); } catch { body = {}; }

  const token = Deno.env.get("WHATSAPP_TOKEN");
  const waba = Deno.env.get("WHATSAPP_WABA_ID");
  if (!token || !waba) return json({ error: "missing WHATSAPP_TOKEN or WHATSAPP_WABA_ID" }, 500);
  const authHdr = { Authorization: `Bearer ${token}` };

  if (body.action === "subscribe_waba") {
    const r = await fetch(`${GRAPH}/${waba}/subscribed_apps`, { method: "POST", headers: authHdr });
    return json({ action: "subscribe_waba", ok: r.ok, status: r.status, response: await r.json().catch(() => ({})) }, r.ok ? 200 : 502);
  }

  if (body.action === "list_subscribed") {
    const r = await fetch(`${GRAPH}/${waba}/subscribed_apps`, { headers: authHdr });
    return json({ action: "list_subscribed", ok: r.ok, status: r.status, response: await r.json().catch(() => ({})) }, r.ok ? 200 : 502);
  }

  if (body.action === "create_verify_template") {
    const payload = {
      name: VERIFY_TEMPLATE,
      language: "en_US",
      category: "AUTHENTICATION",
      components: [
        { type: "BODY", add_security_recommendation: true },
        { type: "FOOTER", code_expiration_minutes: 10 },
        { type: "BUTTONS", buttons: [{ type: "OTP", otp_type: "COPY_CODE" }] },
      ],
    };
    const r = await fetch(`${GRAPH}/${waba}/message_templates`, {
      method: "POST", headers: { ...authHdr, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return json({ action: "create_verify_template", ok: r.ok, status: r.status, response: await r.json().catch(() => ({})) }, r.ok ? 200 : 502);
  }

  if (body.action === "list_templates") {
    const r = await fetch(`${GRAPH}/${waba}/message_templates?fields=name,status,category&limit=50`, { headers: authHdr });
    return json({ action: "list_templates", ok: r.ok, status: r.status, response: await r.json().catch(() => ({})) }, r.ok ? 200 : 502);
  }

  return json({ error: "unknown action", allowed: ["subscribe_waba", "list_subscribed", "create_verify_template", "list_templates"] }, 400);
});
