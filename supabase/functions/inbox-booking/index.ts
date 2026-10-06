// inbox-booking — staff click "Create booking" on an inbox conversation.
// Body: { conversation_id, module: IS|IA|ES|EA, mode: "quick" | "ai" }.
// quick = free: customer, module, containers found in the text, email attachments copied to booking documents.
// ai = same plus one Claude call reading the thread + PDF attachments. Always a DRAFT for staff review.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { setApiFn } from "../_shared/apiFetch.ts";
import { getObject, putObject } from "../_shared/s3.ts";
import { extractPdfText } from "../booking-email-ingest/pdfText.ts";
import { aiExtract, CLAUDE_MODEL, type Extract } from "./extract.ts";
setApiFn("inbox-booking");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "content-type": "application/json" } });
const MODULES = ["IS", "IA", "ES", "EA"];
const CNTR = /\b[A-Z]{4}\d{7}\b/g;
const TYPES = ["20GP", "40GP", "40HQ", "20HC", "20RF", "40RF", "20OT", "40OT", "20FR", "40FR"];

const s = (v: unknown) => { const t = v == null ? "" : String(v).trim(); return t || null; };
const n = (v: unknown) => { const x = Number(v); return v == null || v === "" || !Number.isFinite(x) ? null : x; };
const d = (v: unknown) => { const t = s(v); return t && /^\d{4}-\d{2}-\d{2}/.test(t) ? t.slice(0, 10) : null; };

async function resolvePort(sb: SupabaseClient, term: string | null, kind: "sea" | "air"): Promise<string | null> {
  const t = (term ?? "").trim();
  if (!t) return null;
  const up = t.toUpperCase();
  const { data } = await sb.from("ports").select("code,name").eq("kind", kind).or(`code.eq.${up},name.ilike.${t.replace(/[,()*%]/g, " ")}*`).limit(5);
  const rows = (data ?? []) as { code: string; name: string }[];
  const exact = rows.find((r) => r.code.toUpperCase() === up);
  if (exact) return exact.code;
  return rows.length === 1 ? rows[0].code : null;
}

async function lineCode(sb: SupabaseClient, name: string | null): Promise<string | null> {
  if (!name) return null;
  const { data } = await sb.from("shipping_lines").select("code").or(`code.ilike.${name.trim().replace(/[,()*%]/g, " ")},name.ilike.*${name.trim().replace(/[,()*%]/g, " ")}*`).limit(2);
  return data?.length === 1 ? (data[0] as { code: string }).code : null;
}

const safe = (x: string) => x.replace(/[^\w.\-()+ ]/g, "_").slice(0, 120);

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

  let body: { conversation_id?: string; module?: string; mode?: string };
  try { body = await req.json(); } catch { body = {}; }
  const module = String(body.module ?? "").toUpperCase();
  if (!body.conversation_id || !MODULES.includes(module)) return json({ error: "conversation_id and module required" }, 400);
  const useAi = body.mode === "ai";

  const { data: conv } = await sb.from("inbox_conversations")
    .select("id,account_id,booking_id,subject,contact_email,contact_name").eq("id", body.conversation_id).maybeSingle();
  if (!conv) return json({ error: "Conversation not found" }, 404);

  const { data: msgs } = await sb.from("inbox_messages").select("id,direction,body,created_at,sender_name")
    .eq("conversation_id", conv.id).eq("kind", "message").order("created_at", { ascending: true });
  const list = (msgs ?? []) as { id: number; direction: string; body: string | null; created_at: string; sender_name: string | null }[];
  const ids = list.map((m) => m.id);
  const { data: metaRows } = ids.length ? await sb.from("inbox_email_meta").select("message_id,full_text,subject").in("message_id", ids) : { data: [] };
  const { data: attRows } = ids.length ? await sb.from("inbox_attachments").select("message_id,name,content_type,size,s3_key").in("message_id", ids) : { data: [] };
  const metas = (metaRows ?? []) as { message_id: number; full_text: string | null; subject: string | null }[];
  const atts = ((attRows ?? []) as { message_id: number; name: string; content_type: string | null; size: number | null; s3_key: string }[]).slice(-15);

  const lastIn = [...list].reverse().find((m) => m.direction === "in");
  const fullText = metas.find((m) => m.message_id === lastIn?.id)?.full_text;
  const threadText = (fullText ?? list.slice(-8).map((m) => `${m.sender_name ?? ""}: ${m.body ?? ""}`).join("\n\n")).slice(0, 60000);
  const allText = `${conv.subject ?? ""}\n${list.map((m) => m.body ?? "").join("\n")}\n${fullText ?? ""}`.toUpperCase();

  // ---- fields ----
  let x: Extract = {};
  if (useAi) {
    const docTexts: string[] = [];
    for (const a of atts.filter((a) => /pdf/i.test(a.content_type ?? "") || /\.pdf$/i.test(a.name)).slice(0, 5)) {
      try {
        const bytes = new Uint8Array(await (await getObject(`booking-emails/${a.s3_key}`)).arrayBuffer());
        const { text } = await extractPdfText(bytes);
        if (text) docTexts.push(`[${a.name}]\n${text.slice(0, 20000)}`);
      } catch { /* skip unreadable */ }
    }
    try { x = await aiExtract(module, threadText, docTexts); }
    catch (e) { return json({ error: `AI fill failed: ${String(e).slice(0, 200)}. Try Quick draft.` }, 502); }
  }
  const found = Array.from(new Set(allText.match(CNTR) ?? []));
  const aiCntrs = (x.containers ?? []).map((c) => ({ no: s(c.container_no)?.toUpperCase().replace(/\s/g, "") ?? null, type: s(c.container_type)?.toUpperCase() ?? null }))
    .filter((c) => c.no && /^[A-Z]{4}\d{7}$/.test(c.no));
  const containers = [...aiCntrs, ...found.filter((no) => !aiCntrs.some((c) => c.no === no)).map((no) => ({ no, type: null }))];

  const sea = module === "IS" || module === "ES";
  const isImport = module === "IS" || module === "IA";
  const [origin, destination, line] = await Promise.all([
    resolvePort(sb, s(x.origin), sea ? "sea" : "air"), resolvePort(sb, s(x.destination), sea ? "sea" : "air"),
    sea ? lineCode(sb, s(x.shipping_line)) : Promise.resolve(null),
  ]);
  const low = new Set(x._low_confidence ?? []);
  if (x.origin && !origin) low.add("origin");
  if (x.destination && !destination) low.add("destination");

  const row: Record<string, unknown> = {
    module, source: "email_import", status: "draft", created_by: u.user.id,
    account_id: conv.account_id, importer_account_id: isImport ? conv.account_id : null,
    owner_email: conv.contact_email, customer_ref: s(x.customer_ref),
    shipper_name: s(x.shipper_name), consignee_name: s(x.consignee_name), importer_name: s(x.importer_name),
    origin, destination, incoterm: s(x.incoterm)?.toUpperCase().slice(0, 3) ?? null, commodity: s(x.commodity),
    goods_description: s(x.goods_description), pieces: n(x.pieces), packing_type: s(x.packing_type),
    gross_weight_kg: n(x.gross_weight_kg), weight_kg: n(x.gross_weight_kg), volume_m3: n(x.volume_m3),
    cargo_ready_date: d(x.cargo_ready_date), etd: d(x.etd), eta: d(x.eta),
    load_type: sea ? (x.load_type === "FCL" || x.load_type === "LCL" ? x.load_type : containers.length ? "FCL" : null) : null,
    vessel: sea ? s(x.vessel) : null, voyage: sea ? s(x.voyage) : null, shipping_line_code: line, mbl_no: sea ? s(x.mbl_no) : null,
    airline_name: sea ? null : s(x.airline), flight_no: sea ? null : s(x.flight_no),
    mawb: sea ? null : s(x.mawb), hawb: sea ? null : s(x.hawb),
    is_dg: x.is_dg === true, un_number: s(x.un_number),
    special_instructions: s(x.special_instructions) ?? (conv.subject ? `From email: ${conv.subject}` : null),
    extraction_confidence: useAi ? { low_confidence: [...low], model: CLAUDE_MODEL, extracted_at: new Date().toISOString(), from: "inbox" } : null,
    source_payload: useAi ? x : null,
  };
  const { data: bk, error: bErr } = await sb.from("bookings").insert(row).select("id,booking_ref").single();
  if (bErr || !bk) return json({ error: bErr?.message ?? "Booking insert failed" }, 500);

  if (containers.length) {
    await sb.from("booking_containers").insert(containers.slice(0, 40).map((c, i) => ({
      booking_id: bk.id, container_no: c.no, container_type: c.type && TYPES.includes(c.type) ? c.type : null,
      source: "manual", sort_order: i, created_by: u.user.id,
    })));
  }

  let copied = 0;
  for (const a of atts) {
    try {
      const bytes = new Uint8Array(await (await getObject(`booking-emails/${a.s3_key}`)).arrayBuffer());
      const path = `${conv.account_id ?? "staff"}/${bk.id}/${Date.now()}_${safe(a.name)}`;
      await putObject(`booking-documents/${path}`, bytes, a.content_type ?? "application/octet-stream");
      await sb.from("booking_documents").insert({ booking_id: bk.id, file_name: a.name, storage_path: path,
        mime_type: a.content_type, size_bytes: a.size, uploaded_by: u.user.id, uploaded_via: "staff", customer_visible: false });
      copied++;
    } catch (e) { console.error("doc copy failed", a.name, e); }
  }

  if (!conv.booking_id) await sb.from("inbox_conversations").update({ booking_id: bk.id, team: module }).eq("id", conv.id);
  const { data: nm } = await sb.rpc("inbox_staff_name", { p_uid: u.user.id });
  await sb.from("inbox_messages").insert({ conversation_id: conv.id, channel: "internal", kind: "event", sender_kind: "staff",
    sender_user_id: u.user.id, sender_name: nm as string | null,
    body: `Draft booking ${bk.booking_ref} created${useAi ? " with AI fill" : ""}` });

  return json({ ok: true, id: bk.id, booking_ref: bk.booking_ref, module, containers: containers.length, documents: copied, low_confidence: [...low] });
});
