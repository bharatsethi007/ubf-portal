// Portal customer notifications over WhatsApp: sends what portal_notify_scan() queued to users
// who linked a number and switched WhatsApp on. Cron (service key) calls this during NZ daytime.
//   config.wa_test_recipient set -> every message goes there instead. For testing.
//   config.wa_enabled false      -> nothing sent; pending items marked skipped (no backlog blast later).
// Up to 3 updates per user per run go out one by one; more than that become one summary message.
// POST { dry?: true } renders without sending or marking.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { isServiceCaller } from "../_shared/serviceAuth.ts";

const GRAPH = "https://graph.facebook.com/v25.0";
const TEMPLATE = "ubf_shipment_update";
const MAX_SINGLE = 3;

type Item = { id: number; kind: string; title: string; body: string | null };
type Recipient = { wa_id: string; name: string | null; account_id: string; items: Item[] };
type Outbox = { config: { wa_enabled: boolean; test_recipient: string | null }; ids: number[]; stale: number[]; recipients: Recipient[] };
type Msg = { to: string; params: [string, string, string]; ids: number[] };

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });

// Meta rejects params with newlines, tabs or 4+ spaces, and caps length.
const clean = (s: string | null | undefined, max = 300) =>
  (s ?? "").replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ").trim().slice(0, max) || "-";

const firstName = (n: string | null) => clean((n ?? "").trim().split(/\s+/)[0] || "there", 40);

function build(r: Recipient, to: string): Msg[] {
  const name = firstName(r.name);
  if (r.items.length <= MAX_SINGLE) {
    return r.items.map((i) => ({ to, params: [name, clean(i.title, 120), clean(i.body ?? "Open the portal for details.")], ids: [i.id] }));
  }
  const shown = r.items.slice(0, 4).map((i) => clean(i.title, 70)).join("; ");
  const more = r.items.length - 4;
  return [{
    to,
    params: [name, `${r.items.length} new updates`, clean(`${shown}${more > 0 ? `; and ${more} more` : ""}.`)],
    ids: r.items.map((i) => i.id),
  }];
}

async function sendTemplate(sb: SupabaseClient, m: Msg): Promise<boolean> {
  const token = Deno.env.get("WHATSAPP_TOKEN"), phoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  if (!token || !phoneId) { console.error("WhatsApp secrets missing"); return false; }
  const payload = {
    messaging_product: "whatsapp", to: m.to, type: "template",
    template: { name: TEMPLATE, language: { code: "en_US" }, components: [{ type: "body", parameters: m.params.map((text) => ({ type: "text", text })) }] },
  };
  const r = await fetch(`${GRAPH}/${phoneId}/messages`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) console.error("wa send", r.status, JSON.stringify(data));
  const { data: c } = await sb.from("whatsapp_contacts").select("id").eq("wa_id", m.to).maybeSingle();
  if (c?.id) {
    await sb.from("whatsapp_messages").insert({
      wa_message_id: data?.messages?.[0]?.id ?? null, contact_id: c.id, direction: "outbound", msg_type: "template",
      body: `${m.params[1]}: ${m.params[2]}`, template_name: TEMPLATE, status: r.ok ? "sent" : "failed",
      intent: "notification", raw: { request: payload, response: data },
    });
  }
  return r.ok;
}

Deno.serve(async (req) => {
  try {
    if (!(await isServiceCaller(req))) return json({ error: "forbidden" }, 403);
    const body = await req.json().catch(() => ({}));
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

    const { data, error } = await sb.rpc("portal_wa_outbox", { p_limit: 1000 });
    if (error) throw error;
    const box = data as Outbox;
    if (box.stale.length && !body?.dry) await sb.rpc("portal_wa_mark", { p_ids: box.stale, p_status: "expired" });
    if (!box.ids.length) return json({ pending: 0, expired: box.stale.length });

    const test = box.config.test_recipient?.replace(/\D/g, "") || null;
    const live = box.config.wa_enabled || !!test;
    const msgs = box.recipients.flatMap((r) => build(r, test ?? r.wa_id));

    if (body?.dry) return json({ dry: true, live, pending: box.ids.length, messages: msgs });
    if (!live) {
      await sb.rpc("portal_wa_mark", { p_ids: box.ids, p_status: "skipped" });
      return json({ pending: box.ids.length, sent: 0, skipped: "whatsapp disabled" });
    }

    const sentIds: number[] = [], failedIds: number[] = [];
    for (const m of msgs) ((await sendTemplate(sb, m)) ? sentIds : failedIds).push(...m.ids);
    // Items nobody wants on WhatsApp are closed too, so the queue stays small.
    const untouched = box.ids.filter((id) => !sentIds.includes(id) && !failedIds.includes(id));
    if (sentIds.length) await sb.rpc("portal_wa_mark", { p_ids: sentIds, p_status: "sent" });
    if (failedIds.length) await sb.rpc("portal_wa_mark", { p_ids: failedIds, p_status: "failed" });
    if (untouched.length) await sb.rpc("portal_wa_mark", { p_ids: untouched, p_status: "none" });
    return json({ pending: box.ids.length, messages: msgs.length, sent: sentIds.length, failed: failedIds.length, test: !!test });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
