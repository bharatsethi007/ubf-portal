// whatsapp-send — outbound sender for WhatsApp Cloud API (text + template).
// Auth: EITHER header 'x-ubf-secret' == WHATSAPP_SEND_SECRET (simple internal secret),
//       OR Authorization: Bearer <service_role> (for internal Edge Function / cron callers).
// Logs every send to whatsapp_messages (direction=outbound).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";

const GRAPH = "https://graph.facebook.com/v25.0";

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

type SendBody = {
  to: string;
  type?: "text" | "template";
  text?: string;
  template?: { name: string; language?: string; params?: (string | number)[] };
  related_booking_id?: string;
};

async function upsertContact(sb: SupabaseClient, waId: string): Promise<string> {
  const { data: existing } = await sb.from("whatsapp_contacts").select("id").eq("wa_id", waId).maybeSingle();
  if (existing?.id) return existing.id as string;
  const { data: created, error } = await sb.from("whatsapp_contacts")
    .insert({ wa_id: waId }).select("id").single();
  if (error) throw error;
  return created!.id as string;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  if (!authorize(req)) return json({ error: "unauthorized" }, 401);

  let body: SendBody;
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  if (!body.to) return json({ error: "missing 'to'" }, 400);

  const token = Deno.env.get("WHATSAPP_TOKEN");
  const phoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  if (!token || !phoneId) return json({ error: "missing WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID" }, 500);

  const type = body.type ?? (body.template ? "template" : "text");
  const apiPayload: Record<string, unknown> = { messaging_product: "whatsapp", to: body.to, type };

  if (type === "template") {
    if (!body.template?.name) return json({ error: "missing template.name" }, 400);
    const params = body.template.params ?? [];
    const components = params.length
      ? [{ type: "body", parameters: params.map((p) => ({ type: "text", text: String(p) })) }]
      : [];
    apiPayload.template = {
      name: body.template.name,
      language: { code: body.template.language ?? "en_US" },
      ...(components.length ? { components } : {}),
    };
  } else {
    if (!body.text) return json({ error: "missing text" }, 400);
    apiPayload.text = { body: body.text, preview_url: false };
  }

  const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(apiPayload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return json({ ok: false, status: res.status, error: data }, res.status);

  const waMsgId = data?.messages?.[0]?.id ?? null;
  try {
    const sb = db();
    const contactId = await upsertContact(sb, body.to);
    await sb.from("whatsapp_messages").insert({
      wa_message_id: waMsgId, contact_id: contactId, direction: "outbound",
      msg_type: type,
      body: type === "template" ? body.template?.name : body.text,
      template_name: type === "template" ? body.template?.name : null,
      related_booking_id: body.related_booking_id ?? null,
      status: "sent", raw: { request: apiPayload, response: data },
    });
  } catch (e) { console.error("log outbound failed", e); }

  return json({ ok: true, wa_message_id: waMsgId, response: data });
});
