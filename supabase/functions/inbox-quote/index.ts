// inbox-quote — staff click "Create quote" on a Sales Support inbox conversation.
// Body: { conversation_id }. One Claude call reads the thread + PDF attachments and fills the quote as far as it can.
// Writes an OPEN quote (source 'inbox_email') with cargo lines / containers, links it to the conversation.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { setApiFn } from "../_shared/apiFetch.ts";
import { getObject } from "../_shared/s3.ts";
import { extractPdfText } from "../booking-email-ingest/pdfText.ts";
import { aiExtract, CLAUDE_MODEL, type QExtract } from "./extract.ts";
setApiFn("inbox-quote");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, st = 200) => new Response(JSON.stringify(b), { status: st, headers: { ...cors, "content-type": "application/json" } });

const s = (v: unknown) => { const t = v == null ? "" : String(v).trim(); return t || null; };
const n = (v: unknown) => { const x = Number(v); return v == null || v === "" || !Number.isFinite(x) ? null : x; };
const d = (v: unknown) => { const t = s(v); return t && /^\d{4}-\d{2}-\d{2}/.test(t) ? t.slice(0, 10) : null; };
const r4 = (x: number) => Math.round(x * 10000) / 10000;
const SIZES = ["20", "20HC", "40", "40HC"];
const KINDS = ["standard", "reefer", "opentop", "flatrack", "isotank", "openside"];

function size(v: unknown): string | null {
  const t = (s(v) ?? "").toUpperCase().replace(/\s|'|FT/g, "");
  if (SIZES.includes(t)) return t;
  if (t === "40HQ") return "40HC";
  if (/^20(GP|DV|DC)?$/.test(t)) return "20";
  if (/^40(GP|DV|DC)?$/.test(t)) return "40";
  return null;
}

async function port(sb: SupabaseClient, term: string | null, kind: "sea" | "air"): Promise<string | null> {
  const t = (term ?? "").trim();
  if (!t) return null;
  const up = t.toUpperCase();
  const { data } = await sb.from("ports").select("code").eq("kind", kind)
    .or(`code.eq.${up},name.ilike.${t.replace(/[,()*%]/g, " ")}*`).limit(5);
  const rows = (data ?? []) as { code: string }[];
  return rows.find((r) => r.code.toUpperCase() === up)?.code ?? (rows.length === 1 ? rows[0].code : null);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL")!;
  const user = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } }, auth: { persistSession: false } });
  const { data: u } = await user.auth.getUser();
  const sb = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  if (!u.user) return json({ error: "forbidden" }, 403);
  const { data: staff } = await sb.from("staff_users").select("user_id").eq("user_id", u.user.id).maybeSingle();
  if (!staff) return json({ error: "forbidden" }, 403);

  let body: { conversation_id?: string; force?: boolean };
  try { body = await req.json(); } catch { body = {}; }
  if (!body.conversation_id) return json({ error: "conversation_id required" }, 400);

  const { data: conv } = await sb.from("inbox_conversations")
    .select("id,account_id,quote_id,subject,contact_email,contact_name,contact_type,email_mailbox").eq("id", body.conversation_id).maybeSingle();
  if (!conv) return json({ error: "Conversation not found" }, 404);
  if (conv.quote_id && !body.force) {
    const { data: q } = await sb.from("quotes").select("id,quote_no").eq("id", conv.quote_id).maybeSingle();
    if (q) return json({ ok: true, existing: true, id: q.id, quote_no: q.quote_no, cargo: 0, low_confidence: [] });
  }

  const { data: msgs } = await sb.from("inbox_messages").select("id,direction,body,created_at,sender_name")
    .eq("conversation_id", conv.id).eq("kind", "message").order("created_at", { ascending: true });
  const list = (msgs ?? []) as { id: number; direction: string; body: string | null; sender_name: string | null }[];
  const ids = list.map((m) => m.id);
  const { data: metaRows } = ids.length ? await sb.from("inbox_email_meta").select("message_id,full_text").in("message_id", ids) : { data: [] };
  const { data: attRows } = ids.length ? await sb.from("inbox_attachments").select("name,content_type,s3_key").in("message_id", ids) : { data: [] };
  const lastIn = [...list].reverse().find((m) => m.direction === "in");
  const fullText = ((metaRows ?? []) as { message_id: number; full_text: string | null }[]).find((m) => m.message_id === lastIn?.id)?.full_text;
  const thread = `Subject: ${conv.subject ?? ""}\n\n` +
    (fullText ?? list.slice(-8).map((m) => `${m.sender_name ?? ""}: ${m.body ?? ""}`).join("\n\n")).slice(0, 60000);

  const docTexts: string[] = [];
  const pdfs = ((attRows ?? []) as { name: string; content_type: string | null; s3_key: string }[])
    .filter((a) => /pdf/i.test(a.content_type ?? "") || /\.pdf$/i.test(a.name)).slice(-5);
  for (const a of pdfs) {
    try {
      const bytes = new Uint8Array(await (await getObject(`booking-emails/${a.s3_key}`)).arrayBuffer());
      const { text } = await extractPdfText(bytes);
      if (text) docTexts.push(`[${a.name}]\n${text.slice(0, 20000)}`);
    } catch { /* skip unreadable */ }
  }

  let x: QExtract;
  try { x = await aiExtract(thread, docTexts); }
  catch (e) { return json({ error: `Could not read the email: ${String(e).slice(0, 200)}` }, 502); }

  const type = x.shipment_type === "FCL" || x.shipment_type === "LCL" ? x.shipment_type : x.shipment_type === "Air" || x.shipment_mode === "air" ? "Air" : null;
  const mode = type === "Air" ? "air" : type ? "sea" : s(x.shipment_mode);
  const kind = mode === "air" ? "air" : "sea";
  const [pol, pod] = await Promise.all([port(sb, s(x.pol_code) ?? s(x.origin), kind), port(sb, s(x.pod_code) ?? s(x.destination), kind)]);
  const low = new Set(x._low_confidence ?? []);
  if (x.origin && !pol) low.add("origin port");
  if (x.destination && !pod) low.add("destination port");

  let custName: string | null = s(x.customer_name);
  if (conv.account_id) {
    const { data: cu } = await sb.from("customers").select("name").eq("account_id", conv.account_id).maybeSingle();
    custName = (cu?.name as string) ?? custName;
  }
  let agentId: string | null = null;
  const agentName = s(x.agent_name);
  if (agentName) {
    const { data: ag } = await sb.from("agents").select("id").ilike("name", agentName).limit(1).maybeSingle();
    agentId = (ag?.id as string) ?? null;
  }

  const notes = [
    `Created from Sales Support email${conv.subject ? `: ${conv.subject}` : ""}.`,
    s(x.commodity) ? `Commodity: ${x.commodity}` : null,
    s(x.notes),
    low.size ? `Check: ${[...low].join(", ")}` : null,
  ].filter(Boolean).join("\n");

  const row: Record<string, unknown> = {
    status: "open", source: "inbox_email", created_by: u.user.id, sales_executive_id: u.user.id,
    movement_type: x.movement_type === "import" || x.movement_type === "export" ? x.movement_type : null,
    shipment_mode: mode, shipment_type: type, incoterms: s(x.incoterms)?.toUpperCase().slice(0, 3) ?? null, incoterm_place: s(x.incoterm_place),
    customer_account_id: conv.account_id, customer_name: custName, customer_po: s(x.customer_po),
    agent_id: agentId, agent_name: agentName,
    contact_name: s(x.contact_name) ?? s(conv.contact_name), contact_email: s(x.contact_email) ?? s(conv.contact_email), contact_phone: s(x.contact_phone),
    request_received_from: s(conv.contact_email),
    shipper: s(x.shipper), shipper_address: s(x.shipper_address), consignee: s(x.consignee), consignee_address: s(x.consignee_address),
    from_port_code: pol, to_port_code: pod, pickup_location: s(x.origin), drop_location: s(x.destination),
    pickup_address: s(x.pickup_address), pickup_postal_code: s(x.pickup_postal_code),
    drop_address: s(x.delivery_address), drop_postal_code: s(x.delivery_postal_code),
    pickup_date: d(x.pickup_date), delivery_date: d(x.delivery_date),
    cargo_value: n(x.cargo_value), cargo_value_currency: s(x.cargo_value_currency)?.toUpperCase() ?? (n(x.cargo_value) ? "NZD" : null),
    need_insurance: x.need_insurance === true, stackable: x.stackable == null ? null : x.stackable ? "true" : "false",
    is_hazardous: x.is_hazardous === true, dg_un_number: s(x.dg_un_number), dg_class: s(x.dg_class),
    need_refrigeration: x.need_refrigeration === true, reefer_temp_c: n(x.reefer_temp_c), service_type: s(x.service_type),
    internal_notes: notes,
    source_meta: { channel: "inbox", conversation_id: conv.id, mailbox: conv.email_mailbox, subject: conv.subject,
      from_email: conv.contact_email, commodity: s(x.commodity), low_confidence: [...low], model: CLAUDE_MODEL,
      extracted_at: new Date().toISOString(), extract: x },
  };
  const { data: q, error: qErr } = await sb.from("quotes").insert(row).select("id,quote_no").single();
  if (qErr || !q) return json({ error: qErr?.message ?? "Quote insert failed" }, 500);

  let cargo = 0;
  if (type === "FCL") {
    const rows = (x.containers ?? []).map((c, i) => ({ c, i, sz: size(c.size) })).filter((r) => r.sz).slice(0, 10).map(({ c, i, sz }) => ({
      quote_id: q.id, ord: i, container_size: sz, container_type: KINDS.includes(String(c.kind)) ? c.kind : "standard",
      qty: Math.max(1, Math.round(n(c.qty) ?? 1)), weight_per_container_mt: n(c.weight_mt), commodity: s(x.commodity),
    }))
    if (rows.length) { const { error } = await sb.from("quote_containers").insert(rows); if (!error) cargo = rows.length }
  } else {
    const rows = (x.cargo_lines ?? []).filter(Boolean).slice(0, 30).map((ln, i) => {
      const qty = n(ln.quantity) ?? 1; const tw = n(ln.weight_kg);
      const l = n(ln.length_cm), w = n(ln.width_cm), h = n(ln.height_cm);
      const unit = l != null && w != null && h != null ? r4((l * w * h) / 1e6) : null;
      return {
        quote_id: q.id, ord: i, cargo_description: s(ln.description) ?? s(x.commodity), package_type: s(ln.package_type),
        quantity: qty, packages: qty, weight_unit: "KG", per_package_weight: tw != null && qty ? r4(tw / qty) : null,
        total_weight: tw, gross_wt: tw, length: l, width: w, height: h, dim_unit: "CM",
        volume_cbm: unit, total_cbm: unit != null ? r4(unit * qty) : null,
      };
    });
    if (rows.length) { const { error } = await sb.from("quote_cargo_lines").insert(rows); if (!error) cargo = rows.length }
  }

  await sb.from("inbox_conversations").update({ quote_id: q.id }).eq("id", conv.id);
  const { data: nm } = await sb.rpc("inbox_staff_name", { p_uid: u.user.id });
  await sb.from("inbox_messages").insert({ conversation_id: conv.id, channel: "internal", kind: "event", sender_kind: "staff",
    sender_user_id: u.user.id, sender_name: nm as string | null, body: `Quote ${q.quote_no} created from email` });

  return json({ ok: true, id: q.id, quote_no: q.quote_no, cargo, low_confidence: [...low] });
});
