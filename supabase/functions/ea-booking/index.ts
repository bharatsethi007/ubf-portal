// ea-booking — Export Air booking from an inbox conversation, reviewed by staff before it is created.
// prefill: { conversation_id, ai?: boolean } -> { form, bill_to }   (free regex pass; AI pass only when asked, ~2c)
// commit:  { conversation_id, form, bill_to_account, attachment_ids[] } -> booking (status confirmed) + cargo lines,
//          supplier row, chosen email attachments as documents, conversation link, and a pickup job when form.pickup.needed.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { setApiFn } from "../_shared/apiFetch.ts";
import { isServiceCaller } from "../_shared/serviceAuth.ts";
import { getObject, putObject } from "../_shared/s3.ts";
import { extractPdfText } from "../booking-email-ingest/pdfText.ts";
import { aiPrefill, CLAUDE_MODEL, type EaForm, regexPrefill } from "./extract.ts";
setApiFn("ea-booking");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "content-type": "application/json" } });
const str = (v: unknown, max = 500) => { const t = v == null ? "" : String(v).trim(); return t ? t.slice(0, max) : null; };
const num = (v: unknown) => { const x = Number(v); return v == null || v === "" || !Number.isFinite(x) || x < 0 ? null : x; };
const safe = (x: string) => x.replace(/[^\w.\-()+ ]/g, "_").slice(0, 120);
const PACIFIC_TLD = /\.(fj|to|ws|sb|vu|ck|nc|pg|pf|tv|ki|nu)$/i;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL")!;
  const user = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } }, auth: { persistSession: false } });
  const sb = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { b = {}; }
  // Staff JWT normally; service key (scripts, tests) acts as the staff user named in as_user.
  const service = await isServiceCaller(req);
  const { data: u } = service ? { data: { user: { id: String(b.as_user ?? "") } } } : await user.auth.getUser();
  if (!u.user?.id) return json({ error: "forbidden" }, 403);
  const { data: staff } = await sb.from("staff_users").select("user_id").eq("user_id", u.user.id).maybeSingle();
  if (!staff) return json({ error: "forbidden" }, 403);
  const uid = u.user.id;
  const rpcClient = service ? sb : user;
  const { data: conv } = await sb.from("inbox_conversations")
    .select("id,account_id,booking_id,subject,contact_email,contact_name").eq("id", String(b.conversation_id ?? "")).maybeSingle();
  if (!conv) return json({ error: "Conversation not found" }, 404);
  const { data: msgs } = await sb.from("inbox_messages").select("id,direction,body,sender_name,created_at")
    .eq("conversation_id", conv.id).eq("kind", "message").order("created_at");
  const list = (msgs ?? []) as { id: number; direction: string; body: string | null; sender_name: string | null; created_at: string }[];
  const ids = list.map((m) => m.id);

  if (b.action === "prefill") {
    const text = `${conv.subject ?? ""}\n${list.map((m) => m.body ?? "").join("\n")}`;
    const r = regexPrefill(text);
    const pacific = PACIFIC_TLD.test(conv.contact_email ?? "");
    const sender = { name: conv.contact_name, email: conv.contact_email };
    let form: EaForm = {
      shipper: pacific ? {} : { ...sender, country: "NZ" }, consignee: pacific ? sender : {},
      destination: r.destination ?? null, incoterm: null, goods: null, po_refs: r.po_refs ?? null, ready_date: null,
      is_dg: !!r.is_dg, un_number: null, notes: conv.subject ? `From email: ${conv.subject}` : null, lines: r.lines ?? [],
      pickup: { needed: null, address: null, contact: null, phone: null, ready_time: null },
    };
    if (b.ai) {
      const { data: metas } = ids.length ? await sb.from("inbox_email_meta").select("message_id,full_text").in("message_id", ids) : { data: [] };
      const lastIn = [...list].reverse().find((m) => m.direction === "in") ?? list[list.length - 1];
      const full = ((metas ?? []) as { message_id: number; full_text: string | null }[]).find((m) => m.message_id === lastIn?.id)?.full_text;
      const emailText = (full ?? list.slice(-6).map((m) => `${m.sender_name ?? ""}: ${m.body ?? ""}`).join("\n\n")).slice(0, 50000);
      const { data: atts } = ids.length ? await sb.from("inbox_attachments").select("name,content_type,s3_key").in("message_id", ids) : { data: [] };
      const docs: string[] = [];
      for (const a of ((atts ?? []) as { name: string; content_type: string | null; s3_key: string }[])
        .filter((a) => /pdf/i.test(a.content_type ?? "") || /\.pdf$/i.test(a.name)).slice(-4)) {
        try {
          const { text: t } = await extractPdfText(new Uint8Array(await (await getObject(`booking-emails/${a.s3_key}`)).arrayBuffer()));
          if (t) docs.push(`[${a.name}]\n${t.slice(0, 15000)}`);
        } catch { /* unreadable */ }
      }
      try {
        const x = await aiPrefill(emailText, docs);
        form = { ...form, ...Object.fromEntries(Object.entries(x).filter(([, v]) => v != null && v !== "")),
          shipper: { ...form.shipper, ...clean(x.shipper) }, consignee: { ...form.consignee, ...clean(x.consignee) },
          pickup: { ...form.pickup, ...clean(x.pickup) }, lines: (x.lines ?? []).filter((l) => l && (l.pieces || l.kg || l.l)).length ? x.lines : form.lines };
      } catch (e) { return json({ error: `${String(e).slice(0, 160)}. Fill the form by hand.` }, 502); }
    }
    const { data: acc } = conv.account_id ? await sb.from("customers").select("account_id,name").eq("account_id", conv.account_id).maybeSingle() : { data: null };
    return json({ form, bill_to: acc ?? null, model: b.ai ? CLAUDE_MODEL : null });
  }

  if (b.action === "commit") {
    const f = (b.form ?? {}) as EaForm;
    const bill = str(b.bill_to_account, 40);
    const lines = (f.lines ?? []).map((l) => ({ pieces: num(l.pieces), l: num(l.l), w: num(l.w), h: num(l.h), kg: num(l.kg) }))
      .filter((l) => l.pieces || l.kg || l.l);
    const pcs = lines.reduce((s, l) => s + (l.pieces ?? 0), 0);
    const kg = lines.reduce((s, l) => s + (l.kg ?? 0), 0);
    const cbm = lines.reduce((s, l) => s + (l.l && l.w && l.h ? (l.l * l.w * l.h / 1e6) * (l.pieces ?? 1) : 0), 0);
    const missing = [!str(f.destination) && "destination", !str(f.shipper?.name) && "shipper", !str(f.consignee?.name) && "consignee",
      !(pcs || kg) && "pieces or weight", typeof f.pickup?.needed !== "boolean" && "pickup yes/no"].filter(Boolean);
    if (missing.length) return json({ error: `Missing: ${missing.join(", ")}` }, 400);

    const row = {
      module: "EA", mode: "air_export", source: "email_import", status: "confirmed", created_by: uid, service_type: f.pickup?.needed ? "door-port" : "port-port",
      account_id: bill, owner_email: conv.contact_email, origin: "AKL", destination: str(f.destination, 5)!.toUpperCase(),
      incoterm: str(f.incoterm, 3)?.toUpperCase() ?? null, customer_ref: str(f.po_refs, 200), goods_description: str(f.goods),
      shipper_name: str(f.shipper.name, 200), shipper_address: str(f.shipper.address), shipper_city: str(f.shipper.city, 100),
      shipper_postcode: str(f.shipper.postcode, 20), shipper_country: str(f.shipper.country, 60) ?? "NZ", shipper_contact: str(f.shipper.contact, 120),
      shipper_phone: str(f.shipper.phone, 60), shipper_email: str(f.shipper.email, 200),
      consignee_name: str(f.consignee.name, 200), consignee_address: str(f.consignee.address), consignee_city: str(f.consignee.city, 100),
      consignee_country: str(f.consignee.country, 60), consignee_contact: str(f.consignee.contact, 120), consignee_phone: str(f.consignee.phone, 60),
      consignee_email: str(f.consignee.email, 200),
      pickup_address: f.pickup.needed ? (str(f.pickup.address) ?? str([f.shipper.address, f.shipper.city].filter(Boolean).join(", "))) : null,
      cargo_ready_date: /^\d{4}-\d{2}-\d{2}$/.test(String(f.ready_date ?? "")) ? f.ready_date : null,
      pieces: pcs || null, gross_weight_kg: kg || null, weight_kg: kg || null, cbm: cbm ? +cbm.toFixed(3) : null, volume_m3: cbm ? +cbm.toFixed(3) : null,
      chargeable_weight_kg: kg || cbm ? Math.round(Math.max(kg, cbm * 167) * 10) / 10 : null,
      is_dg: !!f.is_dg, un_number: str(f.un_number, 20), special_instructions: str(f.notes, 2000),
      extraction_confidence: { low_confidence: f._low_confidence ?? [], from: "inbox-ea", reviewed_by: uid },
    };
    const { data: bk, error } = await sb.from("bookings").insert(row).select("id,booking_ref").single();
    if (error || !bk) return json({ error: error?.message ?? "Booking insert failed" }, 500);

    if (lines.length) {
      await sb.from("booking_cargo_lines").insert(lines.map((l, i) => ({ booking_id: bk.id, ord: i, pieces: l.pieces, length_unit: "cm",
        length: l.l, width: l.w, height: l.h, cbm: l.l && l.w && l.h ? +((l.l * l.w * l.h / 1e6) * (l.pieces ?? 1)).toFixed(3) : null,
        weight_unit: "kg", weight: l.kg, goods_desc: str(f.goods, 200) })));
    }
    await sb.from("booking_suppliers").insert({ booking_id: bk.id, ord: 0, supplier_name: row.shipper_name, supplier_address: row.shipper_address,
      supplier_city: row.shipper_city, supplier_country: row.shipper_country, supplier_phone: row.shipper_phone, supplier_email: row.shipper_email,
      pickup_location: row.pickup_address, po_number: row.customer_ref, pieces: pcs || null, gross_weight_kg: kg || null, cbm: row.cbm,
      goods_description: row.goods_description });

    const want = new Set(((b.attachment_ids ?? []) as unknown[]).map(Number));
    let docs = 0;
    if (want.size && ids.length) {
      const { data: atts } = await sb.from("inbox_attachments").select("id,name,content_type,size,s3_key").in("message_id", ids);
      for (const a of ((atts ?? []) as { id: number; name: string; content_type: string | null; size: number | null; s3_key: string }[]).filter((a) => want.has(a.id))) {
        try {
          const bytes = new Uint8Array(await (await getObject(`booking-emails/${a.s3_key}`)).arrayBuffer());
          const path = `${bill ?? "staff"}/${bk.id}/${Date.now()}_${safe(a.name)}`;
          await putObject(`booking-documents/${path}`, bytes, a.content_type ?? "application/octet-stream");
          await sb.from("booking_documents").insert({ booking_id: bk.id, file_name: a.name, storage_path: path, mime_type: a.content_type,
            size_bytes: a.size, uploaded_by: uid, uploaded_via: "staff", customer_visible: false });
          docs++;
        } catch (e) { console.error("doc copy failed", a.name, e); }
      }
    }

    if (!conv.booking_id) await sb.from("inbox_conversations").update({ booking_id: bk.id, team: "EA" }).eq("id", conv.id);
    const { data: nm } = await sb.rpc("inbox_staff_name", { p_uid: uid });
    await sb.from("inbox_messages").insert({ conversation_id: conv.id, channel: "internal", kind: "event", sender_kind: "staff",
      sender_user_id: uid, sender_name: nm as string | null, body: `Export air booking ${bk.booking_ref} created` });

    let pickup: { consignment_no?: string } | null = null;
    if (f.pickup.needed) {
      const ready = /^\d{4}-\d{2}-\d{2}$/.test(String(f.ready_date ?? ""))
        ? nzTime(String(f.ready_date), /^\d{2}:\d{2}$/.test(String(f.pickup.ready_time ?? "")) ? String(f.pickup.ready_time) : "09:00") : null;
      if (f.pickup.contact || f.pickup.phone) {
        await sb.from("bookings").update({ shipper_contact: str(f.pickup.contact, 120) ?? row.shipper_contact, shipper_phone: str(f.pickup.phone, 60) ?? row.shipper_phone }).eq("id", bk.id);
      }
      const { data: p, error: pErr } = await rpcClient.rpc("booking_create_pickup", { p_booking: bk.id, p_ready: ready });
      if (pErr) return json({ ok: true, id: bk.id, booking_ref: bk.booking_ref, documents: docs, pickup_error: pErr.message });
      pickup = p as { consignment_no?: string };
    }
    return json({ ok: true, id: bk.id, booking_ref: bk.booking_ref, documents: docs, pickup_no: pickup?.consignment_no ?? null });
  }
  return json({ error: "unknown action" }, 400);
});

function clean<T extends Record<string, unknown>>(o: T | null | undefined): Partial<T> {
  return Object.fromEntries(Object.entries(o ?? {}).filter(([, v]) => v != null && v !== "")) as Partial<T>;
}

// Local Auckland date + time to an ISO instant (handles NZST / NZDT).
function nzTime(date: string, time: string): string {
  const probe = new Date(`${date}T12:00:00Z`);
  const off = new Intl.DateTimeFormat("en-US", { timeZone: "Pacific/Auckland", timeZoneName: "shortOffset" })
    .formatToParts(probe).find((p) => p.type === "timeZoneName")?.value.replace("GMT", "") || "+13";
  const [h, m] = off.split(":");
  const sign = h.startsWith("-") ? "-" : "+";
  return new Date(`${date}T${time}:00${sign}${String(Math.abs(+h)).padStart(2, "0")}:${m ?? "00"}`).toISOString();
}
