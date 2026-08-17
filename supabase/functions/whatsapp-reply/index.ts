// whatsapp-reply — staff free-form reply from the inbox (within the 24h service window).
// verify_jwt=true + staff_users gate. Sends text via Graph, logs outbound, clears needs-action on the thread.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";

const GRAPH = "https://graph.facebook.com/v25.0";
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

async function staffUid(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return null;
  const sb = serviceClient();
  const { data: staff } = await sb.from("staff_users").select("user_id").eq("user_id", user.id).maybeSingle();
  return staff?.user_id ? (user.id as string) : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const uid = await staffUid(req);
  if (!uid) return json({ error: "forbidden" }, 403);

  let body: { contact_id?: string; wa_id?: string; text?: string };
  try { body = await req.json(); } catch { body = {}; }
  const text = String(body.text ?? "").trim();
  if (!text) return json({ error: "empty_text" }, 400);

  const sb = serviceClient();
  let contactId = body.contact_id ?? null;
  let waId = body.wa_id ?? null;
  if (contactId && !waId) {
    const { data: c } = await sb.from("whatsapp_contacts").select("wa_id").eq("id", contactId).maybeSingle();
    waId = c?.wa_id ?? null;
  } else if (waId && !contactId) {
    const { data: c } = await sb.from("whatsapp_contacts").select("id").eq("wa_id", waId).maybeSingle();
    contactId = c?.id ?? null;
  }
  if (!waId || !contactId) return json({ error: "contact_not_found" }, 404);

  const token = Deno.env.get("WHATSAPP_TOKEN");
  const phoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  if (!token || !phoneId) return json({ error: "whatsapp_not_configured" }, 500);

  const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: waId, type: "text", text: { body: text, preview_url: false } }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return json({ ok: false, error: "send_failed", detail: data }, 502);

  const waMsgId = data?.messages?.[0]?.id ?? null;
  await sb.from("whatsapp_messages").insert({
    wa_message_id: waMsgId, contact_id: contactId, direction: "outbound", msg_type: "text",
    body: text, status: "sent", raw: { response: data, staff_uid: uid },
  });
  // clear needs-action on this thread
  await sb.from("whatsapp_messages").update({ status: "handled" })
    .eq("contact_id", contactId).eq("direction", "inbound").in("status", ["received", "flagged"]);

  return json({ ok: true, wa_message_id: waMsgId });
});
