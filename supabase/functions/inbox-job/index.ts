// inbox-job — staff actions from an inbox conversation onto an existing job (bookings row).
// attach:  { conversation_id, booking_id, attachment_ids[], tag_id? }  copy email attachments into job documents.
// propose: { conversation_id, booking_id, message_id? }               AI reads the email, returns field changes (no writes).
// apply:   { conversation_id, booking_id, changes{}, containers[] }    writes only the fields staff ticked.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { setApiFn } from "../_shared/apiFetch.ts";
import { getObject, putObject } from "../_shared/s3.ts";
import { extractPdfText } from "../booking-email-ingest/pdfText.ts";
import { aiUpdate, FIELDS, norm } from "./extract.ts";
setApiFn("inbox-job");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "content-type": "application/json" } });
const safe = (x: string) => x.replace(/[^\w.\-()+ ]/g, "_").slice(0, 120);
const CNTR = /^[A-Z]{4}\d{7}$/;
const TYPES = ["20GP", "40GP", "40HQ", "20HC", "20RF", "40RF", "20OT", "40OT", "20FR", "40FR"];
type Att = { id: number; message_id: number; name: string; content_type: string | null; size: number | null; s3_key: string };

async function event(sb: SupabaseClient, conv: string, uid: string, body: string) {
  const { data: nm } = await sb.rpc("inbox_staff_name", { p_uid: uid });
  await sb.from("inbox_messages").insert({ conversation_id: conv, channel: "internal", kind: "event", sender_kind: "staff",
    sender_user_id: uid, sender_name: nm as string | null, body });
}

async function threadAtts(sb: SupabaseClient, conv: string): Promise<{ ids: number[]; atts: Att[] }> {
  const { data: msgs } = await sb.from("inbox_messages").select("id").eq("conversation_id", conv).eq("kind", "message");
  const ids = ((msgs ?? []) as { id: number }[]).map((m) => m.id);
  const { data } = ids.length ? await sb.from("inbox_attachments").select("id,message_id,name,content_type,size,s3_key").in("message_id", ids) : { data: [] };
  return { ids, atts: (data ?? []) as Att[] };
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
  const uid = u.user.id;

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { b = {}; }
  const action = String(b.action ?? "");
  const convId = String(b.conversation_id ?? "");
  const bookingId = String(b.booking_id ?? "");
  if (!convId || !bookingId) return json({ error: "conversation_id and booking_id required" }, 400);

  const { data: conv } = await sb.from("inbox_conversations").select("id,booking_id").eq("id", convId).maybeSingle();
  if (!conv) return json({ error: "Conversation not found" }, 404);
  const { data: job } = await sb.from("bookings").select("*").eq("id", bookingId).maybeSingle();
  if (!job) return json({ error: "Job not found" }, 404);
  const linkIfNone = async () => { if (!conv.booking_id) await sb.from("inbox_conversations").update({ booking_id: bookingId }).eq("id", convId); };

  if (action === "attach") {
    const want = new Set(((b.attachment_ids ?? []) as unknown[]).map(Number));
    const { atts } = await threadAtts(sb, convId);
    const pick = atts.filter((a) => want.has(a.id));
    if (!pick.length) return json({ error: "No attachments picked" }, 400);
    const { data: have } = await sb.from("booking_documents").select("file_name,size_bytes").eq("booking_id", bookingId);
    const dup = new Set(((have ?? []) as { file_name: string; size_bytes: number | null }[]).map((d) => `${d.file_name}|${d.size_bytes ?? ""}`));
    let saved = 0, skipped = 0;
    for (const a of pick) {
      if (dup.has(`${a.name}|${a.size ?? ""}`)) { skipped++; continue; }
      try {
        const bytes = new Uint8Array(await (await getObject(`booking-emails/${a.s3_key}`)).arrayBuffer());
        const path = `${job.account_id ?? job.importer_account_id ?? "staff"}/${bookingId}/${Date.now()}_${safe(a.name)}`;
        await putObject(`booking-documents/${path}`, bytes, a.content_type ?? "application/octet-stream");
        await sb.from("booking_documents").insert({ booking_id: bookingId, file_name: a.name, storage_path: path, mime_type: a.content_type,
          size_bytes: a.size, uploaded_by: uid, uploaded_via: "staff", customer_visible: false, tag_id: b.tag_id ? String(b.tag_id) : null });
        saved++;
      } catch (e) { console.error("attach failed", a.name, e); }
    }
    await linkIfNone();
    if (saved) await event(sb, convId, uid, `Saved ${saved} document${saved > 1 ? "s" : ""} to job ${job.booking_ref}`);
    return json({ ok: true, saved, skipped, booking_ref: job.booking_ref });
  }

  if (action === "propose") {
    const { ids, atts } = await threadAtts(sb, convId);
    const msgId = b.message_id ? Number(b.message_id) : null;
    const { data: metas } = ids.length ? await sb.from("inbox_email_meta").select("message_id,full_text").in("message_id", ids) : { data: [] };
    const { data: msgs } = await sb.from("inbox_messages").select("id,body,sender_name,created_at").in("id", ids.length ? ids : [0]).order("created_at");
    const list = (msgs ?? []) as { id: number; body: string | null; sender_name: string | null; created_at: string }[];
    const target = msgId ?? list[list.length - 1]?.id;
    const full = ((metas ?? []) as { message_id: number; full_text: string | null }[]).find((m) => m.message_id === target)?.full_text;
    const text = (full ?? list.slice(-6).map((m) => `${m.sender_name ?? ""} (${m.created_at.slice(0, 10)}): ${m.body ?? ""}`).join("\n\n")).slice(0, 50000);
    const docTexts: string[] = [];
    const pdfs = atts.filter((a) => (msgId ? a.message_id === msgId : true) && (/pdf/i.test(a.content_type ?? "") || /\.pdf$/i.test(a.name))).slice(-4);
    for (const a of pdfs) {
      try {
        const { text: t } = await extractPdfText(new Uint8Array(await (await getObject(`booking-emails/${a.s3_key}`)).arrayBuffer()));
        if (t) docTexts.push(`[${a.name}]\n${t.slice(0, 15000)}`);
      } catch { /* unreadable pdf */ }
    }
    const summary = `${job.booking_ref} module ${job.module}, ${job.origin ?? "?"} to ${job.destination ?? "?"}, vessel ${job.vessel ?? "-"}, MBL ${job.mbl_no ?? "-"}`;
    let x: Awaited<ReturnType<typeof aiUpdate>>;
    try { x = await aiUpdate(summary, text, docTexts); } catch (e) { return json({ error: String(e).slice(0, 200) }, 502); }
    const changes = Object.entries(FIELDS).flatMap(([f, meta]) => {
      const next = norm(meta.kind, x[f]);
      const cur = norm(meta.kind, (job as Record<string, unknown>)[f]);
      if (next == null || String(next).toUpperCase() === String(cur ?? "").toUpperCase()) return [];
      return [{ field: f, label: meta.label, current: cur, proposed: next, unsure: (x._low_confidence ?? []).includes(f) }];
    });
    const { data: have } = await sb.from("booking_containers").select("container_no").eq("booking_id", bookingId);
    const known = new Set(((have ?? []) as { container_no: string | null }[]).map((c) => (c.container_no ?? "").toUpperCase()));
    const containers = (x.containers ?? []).map((c) => ({ no: String(c.container_no ?? "").toUpperCase().replace(/\s/g, ""), type: c.container_type ? String(c.container_type).toUpperCase() : null }))
      .filter((c) => CNTR.test(c.no) && !known.has(c.no));
    return json({ ok: true, booking_ref: job.booking_ref, changes, containers });
  }

  if (action === "apply") {
    const changes = (b.changes ?? {}) as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    for (const [f, v] of Object.entries(changes)) {
      const meta = FIELDS[f];
      if (!meta) continue;
      const val = norm(meta.kind, v);
      if (val != null) patch[f] = val;
    }
    const cntrs = ((b.containers ?? []) as { no?: string; type?: string | null }[])
      .map((c) => ({ no: String(c.no ?? "").toUpperCase(), type: c.type && TYPES.includes(c.type) ? c.type : null })).filter((c) => CNTR.test(c.no));
    if (!Object.keys(patch).length && !cntrs.length) return json({ error: "Nothing to update" }, 400);
    if (Object.keys(patch).length) {
      const overrides = { ...((job.field_overrides as Record<string, boolean> | null) ?? {}) };
      Object.keys(patch).forEach((f) => { overrides[f] = true });
      const { error } = await sb.from("bookings").update({ ...patch, field_overrides: overrides, updated_at: new Date().toISOString() }).eq("id", bookingId);
      if (error) return json({ error: error.message }, 500);
    }
    if (cntrs.length) {
      const { count } = await sb.from("booking_containers").select("id", { count: "exact", head: true }).eq("booking_id", bookingId);
      await sb.from("booking_containers").insert(cntrs.map((c, i) => ({ booking_id: bookingId, container_no: c.no, container_type: c.type,
        source: "manual", sort_order: (count ?? 0) + i, created_by: uid })));
    }
    await linkIfNone();
    const what = [...Object.keys(patch).map((f) => FIELDS[f].label), ...(cntrs.length ? [`${cntrs.length} container${cntrs.length > 1 ? "s" : ""}`] : [])];
    await event(sb, convId, uid, `Updated job ${job.booking_ref}: ${what.join(", ")}`);
    return json({ ok: true, booking_ref: job.booking_ref, updated: what });
  }

  return json({ error: "unknown action" }, 400);
});
