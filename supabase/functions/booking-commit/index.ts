// booking-commit — UBF Intelligence add-in, Booking mode (commit stage).
// Validated payload -> creates a draft booking (status 'draft', source 'email_import',
// module EA/ES/IA/IS) + booking_cargo_lines, links customer/consignee accounts and
// os agent (via agents.erp_account_code), writes shipper name to booking_suppliers.
// Creates new agents (portal/prospect/untrusted). Dedup-guarded on the email id.
// Auth: x-ubf-secret shared secret.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CLAUDE_MODEL = "claude-sonnet-4-6";
const ALLOWED_ORIGIN = "https://ubf-outlook.netlify.app";
const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-ubf-secret",
  "Access-Control-Max-Age": "86400",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json", ...cors } });

const MODE_BY_MODULE: Record<string, string> = { EA: "air_export", ES: "sea_export", IA: "air_import", IS: "sea_import" };

type Resolution =
  | { type: "customer"; account_id: string; name: string }
  | { type: "agent"; id: string; name: string }
  | { type: "create_customer"; name: string }
  | { type: "create_agent"; name: string }
  | { type: "none" };
type PartyIn = { name: string; email?: string | null; role?: string | null; resolution?: Resolution };
type CargoIn = { pieces?: number | null; weight_kg?: number | null; length_cm?: number | null; width_cm?: number | null; height_cm?: number | null; goods_desc?: string | null };
type Payload = { fields?: Record<string, unknown>; cargo_lines?: CargoIn[]; parties?: PartyIn[]; low_confidence?: string[]; email_meta?: Record<string, unknown>; force?: boolean };

const str = (v: unknown): string | null => { if (v == null) return null; const s = String(v).trim(); return s || null; };
const upper = (v: unknown): string | null => { const s = str(v); return s ? s.toUpperCase() : null; };
const num = (v: unknown): number | null => { if (v == null || v === "") return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
const bool = (v: unknown): boolean => v === true;
const dateOnly = (v: unknown): string | null => { const s = str(v); return s ? s.slice(0, 10) : null; };
function cbm(l: number | null, w: number | null, h: number | null): number | null {
  if (l == null || w == null || h == null) return null;
  const v = (l * w * h) / 1_000_000; return Number.isFinite(v) ? Math.round(v * 10000) / 10000 : null;
}

async function findExisting(db: any, meta: Record<string, unknown>) {
  const imid = str(meta.internet_message_id);
  if (!imid) return null;
  const { data } = await db.from("bookings").select("id, booking_ref, source_payload")
    .eq("source", "email_import").filter("source_payload->>internet_message_id", "eq", imid)
    .order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (!data) return null;
  return { booking_id: data.id, booking_ref: data.booking_ref };
}

async function resolveOrCreateAgent(db: any, name: string): Promise<{ id: string; name: string; erp: string | null; created: boolean }> {
  const { data: ex } = await db.from("agents").select("id,name,erp_account_code").ilike("name", name).limit(1).maybeSingle();
  if (ex?.id) return { id: ex.id, name: ex.name, erp: ex.erp_account_code ?? null, created: false };
  const { data: ins, error } = await db.from("agents").insert({ name, source: "portal", status: "prospect", trusted: false, notes: "Created from UBF Intelligence add-in" }).select("id,name").single();
  if (error || !ins) throw new Error(error?.message ?? "agent insert failed");
  return { id: ins.id, name: ins.name, erp: null, created: true };
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
  const parties = (payload.parties ?? []).filter((p) => str(p?.name));

  const module = upper(f.module);
  if (!module || !MODE_BY_MODULE[module]) return json({ error: "module required (EA/ES/IA/IS)" }, 400);

  try {
    if (!payload.force) {
      const dup = await findExisting(db, meta);
      if (dup) return json({ ok: true, duplicate: true, booking_id: dup.booking_id, booking_ref: dup.booking_ref });
    }

    let createdBy: string | null = null;
    const staffEmail = str(meta.staff_email);
    if (staffEmail) {
      const { data: su } = await db.from("staff_users").select("user_id").ilike("email", staffEmail).maybeSingle();
      createdBy = su?.user_id ?? null;
    }

    let accountId: string | null = null, custPending = false, custName: string | null = null;
    let consigneeAcc: string | null = null, consigneeName: string | null = null;
    let osAgentAcc: string | null = null, agentName: string | null = null, agentCreated = false;
    let shipperName: string | null = null;

    for (const p of parties) {
      const role = (str(p.role) ?? "other").toLowerCase();
      const r = (p.resolution ?? { type: "none" }) as Resolution;
      if (role === "shipper" && !shipperName) shipperName = (r.type === "customer" || r.type === "agent") ? r.name : p.name;

      if (role === "consignee") {
        if (r.type === "customer") { consigneeAcc = r.account_id; consigneeName = r.name; }
        else if (!consigneeName) consigneeName = p.name;
      }
      if (r.type === "customer" && role !== "consignee") { if (!accountId) { accountId = r.account_id; custName = r.name; } }
      else if (r.type === "create_customer" && role !== "consignee") { if (!accountId && !custName) { custName = p.name; custPending = true; } }
      else if (r.type === "agent") { const { data: a } = await db.from("agents").select("erp_account_code,name").eq("id", r.id).maybeSingle(); osAgentAcc = a?.erp_account_code ?? null; agentName = a?.name ?? r.name; }
      else if (r.type === "create_agent") { const a = await resolveOrCreateAgent(db, p.name); osAgentAcc = a.erp; agentName = a.name; agentCreated = agentCreated || a.created; }
    }

    const origin = upper(f.pol_code) ?? str(f.origin);
    const destination = upper(f.pod_code) ?? str(f.destination);
    const low = payload.low_confidence ?? [];

    const bookingRow: Record<string, unknown> = {
      module, mode: MODE_BY_MODULE[module], status: "draft", source: "email_import",
      account_id: accountId, importer_name: custName,
      consignee_account_id: consigneeAcc, consignee_name: consigneeName,
      consignee_address: str(f.consignee_address), consignee_city: str(f.consignee_city), consignee_country: str(f.consignee_country),
      consignee_phone: str(f.consignee_phone), consignee_email: str(f.consignee_email),
      shipper_address: str(f.shipper_address), shipper_city: str(f.shipper_city), shipper_country: str(f.shipper_country),
      shipper_phone: str(f.shipper_phone), shipper_email: str(f.shipper_email),
      notify_name: str(f.notify_name), notify_address: str(f.notify_address), notify_country: str(f.notify_country),
      os_agent_account_id: osAgentAcc,
      origin, destination, incoterm: str(f.incoterm),
      commodity: str(f.commodity), goods_description: str(f.goods_description), packing_type: str(f.packing_type),
      pieces: num(f.pieces), gross_weight_kg: num(f.gross_weight_kg), weight_kg: num(f.gross_weight_kg),
      volume_m3: num(f.volume_m3), cbm: num(f.volume_m3),
      cargo_ready_date: dateOnly(f.cargo_ready_date), etd: dateOnly(f.etd),
      is_dg: bool(f.is_dg), un_number: str(f.un_number), dg_class: str(f.dg_class),
      is_temp_controlled: bool(f.is_temp_controlled), temp_range: str(f.temp_range),
      owner_email: str(meta.from_email), created_by: createdBy,
      extraction_confidence: { low_confidence: low, model: CLAUDE_MODEL, extracted_at: new Date().toISOString() },
      source_payload: {
        channel: "outlook_add_in", subject: str(meta.subject), from_name: str(meta.from_name), from_email: str(meta.from_email),
        received_at: meta.received_at ?? null, internet_message_id: meta.internet_message_id ?? null, staff_email: staffEmail,
        customer_pending: custPending, agent_name: agentName, agent_created: agentCreated, shipper_name: shipperName,
      },
    };

    const { data: bk, error: bErr } = await db.from("bookings").insert(bookingRow).select("id, booking_ref").single();
    if (bErr || !bk) throw new Error(bErr?.message ?? "booking insert failed");

    const lines = (payload.cargo_lines ?? []).filter(Boolean);
    if (lines.length) {
      const rows = lines.map((ln, i) => {
        const l = num(ln.length_cm), w = num(ln.width_cm), h = num(ln.height_cm);
        return { booking_id: bk.id, ord: i, pieces: num(ln.pieces), length_unit: "cm", length: l, width: w, height: h, cbm: cbm(l, w, h), weight_unit: "kg", weight: num(ln.weight_kg), goods_desc: str(ln.goods_desc) };
      });
      const { error: clErr } = await db.from("booking_cargo_lines").insert(rows);
      if (clErr) throw new Error(clErr.message);
    }

    if (shipperName) {
      await db.from("booking_suppliers").insert({ booking_id: bk.id, ord: 0, supplier_name: shipperName });
    }

    return json({ ok: true, duplicate: false, booking_id: bk.id, booking_ref: bk.booking_ref, module, customer_pending: custPending, agent_created: agentCreated });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
