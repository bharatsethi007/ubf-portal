// whatsapp-admin — one-off admin ops against the Graph API using the stored token.
// Auth: header 'x-ubf-secret' == WHATSAPP_SEND_SECRET, or service-role bearer (pg_net / internal).
// Actions: subscribe_waba, list_subscribed, create_verify_template, create_update_template, list_templates, phone_info.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { isServiceCaller } from "../_shared/serviceAuth.ts";

const GRAPH = "https://graph.facebook.com/v25.0";
const VERIFY_TEMPLATE = "ubf_verify_code";
const UPDATE_TEMPLATE = "ubf_shipment_update";
const PORTAL_URL = (Deno.env.get("PORTAL_PUBLIC_URL") ?? "https://portal.ubfreight.com").replace(/\/$/, "");
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });

async function authorize(req: Request): Promise<boolean> {
  const secret = Deno.env.get("WHATSAPP_SEND_SECRET");
  if (secret && (req.headers.get("x-ubf-secret") ?? "") === secret) return true;
  return await isServiceCaller(req);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  if (!(await authorize(req))) return json({ error: "unauthorized" }, 401);

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

  if (body.action === "create_update_template") {
    const payload = {
      name: UPDATE_TEMPLATE,
      language: "en_US",
      category: "UTILITY",
      components: [
        {
          type: "BODY",
          text: "Hi {{1}}, here is an update on your freight from UB Freight.\n\n*{{2}}*\n{{3}}\n\nSee full details in your portal, or reply here if you have any questions.",
          example: { body_text: [["Sarah", "UBF-SI-26-0041 has arrived", "Your shipment arrived at Auckland on 29 Sep."]] },
        },
        { type: "FOOTER", text: "Reply STOP to stop WhatsApp updates" },
        { type: "BUTTONS", buttons: [{ type: "URL", text: "Open portal", url: `${PORTAL_URL}/portal` }] },
      ],
    };
    const r = await fetch(`${GRAPH}/${waba}/message_templates`, {
      method: "POST", headers: { ...authHdr, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return json({ action: "create_update_template", ok: r.ok, status: r.status, response: await r.json().catch(() => ({})) }, r.ok ? 200 : 502);
  }

  if (body.action === "phone_info") {
    const phoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
    const [p, w] = await Promise.all([
      fetch(`${GRAPH}/${phoneId}?fields=display_phone_number,verified_name,name_status,quality_rating,code_verification_status,platform_type,throughput,messaging_limit_tier,status`, { headers: authHdr }),
      fetch(`${GRAPH}/${waba}?fields=name,account_review_status,business_verification_status`, { headers: authHdr }),
    ]);
    return json({ action: "phone_info", phone: await p.json().catch(() => ({})), waba: await w.json().catch(() => ({})) });
  }

  if (body.action === "list_templates") {
    const r = await fetch(`${GRAPH}/${waba}/message_templates?fields=name,status,category&limit=50`, { headers: authHdr });
    return json({ action: "list_templates", ok: r.ok, status: r.status, response: await r.json().catch(() => ({})) }, r.ok ? 200 : 502);
  }

  return json({ error: "unknown action", allowed: ["subscribe_waba", "list_subscribed", "create_verify_template", "create_update_template", "list_templates", "phone_info"] }, 400);
});
