// tms-commit — UBF Intelligence add-in, TMS mode (commit stage).
// Validated payload -> creates a live dispatch consignment (source 'email',
// status defaults to 'unassigned') + tms_consignment_cargo lines.
// consignment_no is assigned by the tms_assign_consignment_no trigger.
// Dedup-guarded on the email id (app check + DB unique index race catch).
// Auth: x-ubf-secret shared secret (QUOTE_INGEST_SECRET).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ALLOWED_ORIGIN = "https://ubf-outlook.netlify.app";
const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-ubf-secret",
  "Access-Control-Max-Age": "86400",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json", ...cors } });

type CargoIn = { type?: string | null; units?: number | null; weight_kg?: number | null; length_cm?: number | null; width_cm?: number | null; height_cm?: number | null; marks?: string | null };
type Payload = { fields?: Record<string, unknown>; cargo_lines?: CargoIn[]; email_meta?: Record<string, unknown>; low_confidence?: string[]; force?: boolean };

const str = (v: unknown): string | null => { if (v == null) return null; const s = String(v).trim(); return s || null; };
const num = (v: unknown): number | null => { if (v == null || v === "") return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
const bool = (v: unknown): boolean => v === true;
const ORDER_TYPES = ["transfer", "pick-up", "drop-off"];
const CARGO_TYPES = ["pallet", "carton"];
function lineCube(l: number | null, w: number | null, h: number | null, units: number | null): number | null {
  if (l == null || w == null || h == null) return null;
  const per = (l * w * h) / 1_000_000; const total = per * (units && units > 0 ? units : 1);
  return Number.isFinite(total) ? Math.round(total * 10000) / 10000 : null;
}

async function findExisting(db: any, meta: Record<string, unknown>) {
  const imid = str(meta.internet_message_id);
  if (!imid) return null;
  const { data } = await db.from("tms_consignments").select("id, consignment_no")
    .eq("source", "email").filter("source_payload->>internet_message_id", "eq", imid)
    .order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (!data) return null;
  return { consignment_id: data.id, consignment_no: data.consignment_no };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const secret = Deno.env.get("QUOTE_INGEST_SECRET");
  if (!secret || req.headers.get("x-ubf-secret") !== secret) return json({ error: "unauthorized" }, 401);
  const url = Deno.env.get("SUPABASE_URL"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !service) return json({ error: "missing supabase env" }, 500);
  const db = createClient(url, service);

  let payload: Payload;
  try { payload = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  const f = (payload.fields ?? {}) as Record<string, unknown>;
  const meta = (payload.email_meta ?? {}) as Record<string, unknown>;

  try {
    if (!payload.force) {
      const dup = await findExisting(db, meta);
      if (dup) return json({ ok: true, duplicate: true, consignment_id: dup.consignment_id, consignment_no: dup.consignment_no });
    }

    let createdBy: string | null = null;
    const staffEmail = str(meta.staff_email);
    if (staffEmail) {
      const { data: su } = await db.from("staff_users").select("user_id").ilike("email", staffEmail).maybeSingle();
      createdBy = su?.user_id ?? null;
    }

    const orderType = ORDER_TYPES.includes(String(f.order_type ?? "").toLowerCase()) ? String(f.order_type).toLowerCase() : "transfer";
    const isDg = bool(f.is_dg);

    const row: Record<string, unknown> = {
      order_type: orderType, source: "email",
      sender_company: str(f.sender_company), sender_contact: str(f.sender_contact), sender_phone: str(f.sender_phone), sender_email: str(f.sender_email), sender_address: str(f.sender_address), sender_additional_info: str(f.sender_additional_info),
      receiver_company: str(f.receiver_company), receiver_contact: str(f.receiver_contact), receiver_phone: str(f.receiver_phone), receiver_email: str(f.receiver_email), receiver_address: str(f.receiver_address), receiver_additional_info: str(f.receiver_additional_info),
      preferred_pickup_at: str(f.preferred_pickup_at), preferred_delivery_at: str(f.preferred_delivery_at),
      reference: str(f.reference), po_number: str(f.po_number), delivery_instructions: str(f.delivery_instructions),
      urgent: bool(f.urgent), tail_lift_required: bool(f.tail_lift_required), fragile: bool(f.fragile),
      temperature_control: bool(f.temperature_control), signature_required: bool(f.signature_required),
      goods_type: isDg ? "dangerous" : "general", dangerous_goods_reason: isDg ? str(f.dangerous_goods_reason) : null,
      created_by: createdBy,
      source_payload: {
        channel: "outlook_add_in", subject: str(meta.subject), from_name: str(meta.from_name), from_email: str(meta.from_email),
        received_at: meta.received_at ?? null, internet_message_id: meta.internet_message_id ?? null, staff_email: staffEmail,
        low_confidence: payload.low_confidence ?? [],
      },
    };

    const ins = await db.from("tms_consignments").insert(row).select("id, consignment_no").single();
    if (ins.error) {
      // DB unique-index race: another commit for the same email won.
      if ((ins.error as any).code === "23505") {
        const dup = await findExisting(db, meta);
        if (dup) return json({ ok: true, duplicate: true, consignment_id: dup.consignment_id, consignment_no: dup.consignment_no });
      }
      throw new Error(ins.error.message);
    }
    const cons = ins.data;

    const lines = (payload.cargo_lines ?? []).filter(Boolean);
    if (lines.length) {
      const rows = lines.map((ln, i) => {
        const type = CARGO_TYPES.includes(String(ln.type ?? "").toLowerCase()) ? String(ln.type).toLowerCase() : "carton";
        const l = num(ln.length_cm), w = num(ln.width_cm), h = num(ln.height_cm), u = num(ln.units);
        return { consignment_id: cons.id, type, units: u, weight_kg: num(ln.weight_kg), length_cm: l, width_cm: w, height_cm: h, marks: str(ln.marks), total_cube_m3: lineCube(l, w, h, u), sort_order: i };
      });
      const { error: cErr } = await db.from("tms_consignment_cargo").insert(rows);
      if (cErr) throw new Error(cErr.message);
    }

    return json({ ok: true, duplicate: false, consignment_id: cons.id, consignment_no: cons.consignment_no, order_type: orderType });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
