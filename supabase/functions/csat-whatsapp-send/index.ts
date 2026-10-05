// csat-whatsapp-send — send a WhatsApp CSAT rating request for a booking.
// Auth: header 'x-ubf-secret' == WHATSAPP_SEND_SECRET, OR Authorization: Bearer <service_role>.
// Mints a csat_request (channel=whatsapp) via RPC, then dispatches an approved template
// through the existing whatsapp-send function. Inbound 1-5 reply is captured by whatsapp-webhook.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { apiFetch, setApiFn } from "../_shared/apiFetch.ts";
setApiFn("csat-whatsapp-send");

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });

function db(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

function authorize(req: Request): boolean {
  const sendSecret = Deno.env.get("WHATSAPP_SEND_SECRET");
  const hdr = req.headers.get("x-ubf-secret") ?? "";
  if (sendSecret && hdr === sendSecret) return true;
  const expected = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const auth = req.headers.get("Authorization") ?? "";
  return !!expected && auth === `Bearer ${expected}`;
}

type Body = { booking_id?: string; to?: string };

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  if (!authorize(req)) return json({ error: "unauthorized" }, 401);

  let body: Body;
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  if (!body.booking_id) return json({ error: "missing booking_id" }, 400);

  const sb = db();
  const { data: enq, error: enqErr } = await sb.rpc("csat_whatsapp_enqueue", {
    p_booking_id: body.booking_id, p_wa_id: body.to ?? null,
  });
  if (enqErr) return json({ ok: false, error: "enqueue_failed", detail: enqErr.message }, 500);
  if (!enq?.ok) return json({ ok: false, error: enq?.error ?? "enqueue_failed", detail: enq }, 400);

  const template = Deno.env.get("CSAT_WHATSAPP_TEMPLATE") ?? "csat_rating_request";
  const lang = Deno.env.get("CSAT_WHATSAPP_LANG") ?? "en_US";
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp-send`;

  const res = await apiFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
    },
    body: JSON.stringify({
      to: enq.wa_id,
      type: "template",
      template: { name: template, language: lang, params: [enq.booking_ref ?? ""] },
      related_booking_id: body.booking_id,
    }),
  });
  const sendData = await res.json().catch(() => ({}));
  if (!res.ok || sendData?.ok === false) {
    return json({ ok: false, error: "send_failed", token: enq.token, detail: sendData }, 502);
  }
  return json({ ok: true, token: enq.token, wa_id: enq.wa_id, send: sendData });
});
