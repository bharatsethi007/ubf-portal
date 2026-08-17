// whatsapp-webhook — Meta WhatsApp Cloud API webhook receiver.
// GET  = verification handshake. POST = log inbound, resolve contact, media, receipts, then route.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { routeInbound } from "./router.ts";

const GRAPH = "https://graph.facebook.com/v25.0";
const MEDIA_BUCKET = "whatsapp-media";
const VERIFY_TOKEN_FALLBACK = "ubf-wa-verify-3n8Kq2Rz";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });

function db(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

type WaContact = { profile?: { name?: string }; wa_id: string };
type WaMedia = { id: string; mime_type?: string; filename?: string; caption?: string };
type WaMessage = {
  from: string; id: string; timestamp?: string; type: string;
  text?: { body: string };
  image?: WaMedia; document?: WaMedia; audio?: WaMedia; video?: WaMedia; sticker?: WaMedia;
  button?: { text?: string };
};
type WaStatus = { id: string; status: string };
type WaValue = {
  metadata?: { phone_number_id?: string };
  contacts?: WaContact[]; messages?: WaMessage[]; statuses?: WaStatus[];
};

async function upsertContact(sb: SupabaseClient, waId: string, name: string | null): Promise<string> {
  const { data: existing } = await sb.from("whatsapp_contacts").select("id").eq("wa_id", waId).maybeSingle();
  if (existing?.id) {
    await sb.from("whatsapp_contacts")
      .update({ last_seen_at: new Date().toISOString(), display_name: name ?? undefined })
      .eq("id", existing.id);
    return existing.id as string;
  }
  const { data: created, error } = await sb.from("whatsapp_contacts")
    .insert({ wa_id: waId, display_name: name }).select("id").single();
  if (error) throw error;
  return created!.id as string;
}

function mediaOf(m: WaMessage): WaMedia | null {
  return m.image ?? m.document ?? m.audio ?? m.video ?? m.sticker ?? null;
}
function bodyOf(m: WaMessage): string | null {
  if (m.text?.body) return m.text.body;
  const md = mediaOf(m);
  if (md?.caption) return md.caption;
  if (m.button?.text) return m.button.text;
  return null;
}

async function fetchMediaToStorage(
  sb: SupabaseClient, token: string, waId: string, msgId: string, media: WaMedia,
): Promise<string | null> {
  try {
    const metaRes = await fetch(`${GRAPH}/${media.id}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!metaRes.ok) return null;
    const meta = await metaRes.json() as { url?: string; mime_type?: string };
    if (!meta.url) return null;
    const bin = await fetch(meta.url, { headers: { Authorization: `Bearer ${token}` } });
    if (!bin.ok) return null;
    const bytes = new Uint8Array(await bin.arrayBuffer());
    const ext = media.filename?.split(".").pop() || meta.mime_type?.split("/").pop() || "bin";
    const path = `${waId}/${msgId}.${ext}`;
    const up = await sb.storage.from(MEDIA_BUCKET).upload(path, bytes, {
      contentType: meta.mime_type ?? media.mime_type ?? "application/octet-stream", upsert: true,
    });
    if (up.error) return null;
    return path;
  } catch { return null; }
}

async function processValue(sb: SupabaseClient, token: string, phoneId: string, v: WaValue) {
  const nameByWaId = new Map<string, string | null>();
  for (const c of v.contacts ?? []) nameByWaId.set(c.wa_id, c.profile?.name ?? null);

  for (const m of v.messages ?? []) {
    const { data: dup } = await sb.from("whatsapp_messages").select("id").eq("wa_message_id", m.id).maybeSingle();
    if (dup?.id) continue;
    const contactId = await upsertContact(sb, m.from, nameByWaId.get(m.from) ?? null);
    const media = mediaOf(m);
    const body = bodyOf(m);
    const { data: row, error } = await sb.from("whatsapp_messages").insert({
      wa_message_id: m.id, contact_id: contactId, direction: "inbound",
      msg_type: m.type, body, status: "received", raw: m,
    }).select("id").single();
    if (error || !row?.id) continue;
    if (media) {
      const path = await fetchMediaToStorage(sb, token, m.from, m.id, media);
      if (path) await sb.from("whatsapp_messages").update({ media_path: path }).eq("id", row.id);
    }
    try {
      await routeInbound(sb, token, phoneId, { id: row.id as string, contact_id: contactId, wa_id: m.from, body });
    } catch (e) { console.error("route error", e); }
  }

  for (const s of v.statuses ?? []) {
    await sb.from("whatsapp_messages").update({ status: s.status })
      .eq("wa_message_id", s.id).eq("direction", "outbound");
  }
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const provided = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    const envToken = Deno.env.get("WHATSAPP_VERIFY_TOKEN");
    const ok = mode === "subscribe" && !!provided && (provided === envToken || provided === VERIFY_TOKEN_FALLBACK);
    if (ok) return new Response(challenge ?? "", { status: 200, headers: { "content-type": "text/plain" } });
    return new Response("forbidden", { status: 403 });
  }

  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let payload: { entry?: { changes?: { value?: WaValue }[] }[] };
  try { payload = await req.json(); } catch { return json({ ok: true }); }

  const token = Deno.env.get("WHATSAPP_TOKEN") ?? "";
  const phoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") ?? "";
  const sb = db();
  const work = (async () => {
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.value) {
          try { await processValue(sb, token, phoneId, change.value); }
          catch (e) { console.error("wa process error", e); }
        }
      }
    }
  })();

  // @ts-ignore EdgeRuntime provided by Supabase Edge runtime
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) EdgeRuntime.waitUntil(work);
  else await work;

  return json({ ok: true });
});
