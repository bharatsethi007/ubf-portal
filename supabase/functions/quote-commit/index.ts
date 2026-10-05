// quote-commit — final stage of the UBF Outlook add-in flow. Takes the payload
// the pane produced after the user validated the extraction and creates the quote.
//   - existing customer  -> link customer_account_id
//   - create customer    -> keep typed name, flag customer_pending (ERP creates it later)
//   - existing agent      -> link agent_id
//   - create agent        -> insert into public.agents (portal, prospect, untrusted), link
// Dedup: if a quote already exists for this email, returns it instead of creating a second.
//
// Auth: shared secret in the `x-ubf-secret` header (env QUOTE_INGEST_SECRET).
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
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors } });

type Resolution =
  | { type: "customer"; account_id: string; name: string }
  | { type: "agent"; id: string; name: string }
  | { type: "create_customer"; name: string }
  | { type: "create_agent"; name: string }
  | { type: "none" };
type PartyIn = { name: string; email?: string | null; role?: string | null; resolution?: Resolution };
type CargoIn = {
  description?: string | null; package_type?: string | null; quantity?: number | null;
  weight_kg?: number | null; length_cm?: number | null; width_cm?: number | null; height_cm?: number | null;
};
type Fields = Record<string, unknown>;
type Payload = {
  doc_type?: string; fields?: Fields; cargo_lines?: CargoIn[]; parties?: PartyIn[];
  low_confidence?: string[]; email_meta?: Record<string, unknown>; force?: boolean;
};

const str = (v: unknown): string | null => { if (v == null) return null; const s = String(v).trim(); return s || null; };
const upper = (v: unknown): string | null => { const s = str(v); return s ? s.toUpperCase() : null; };
const num = (v: unknown): number | null => { if (v == null || v === "") return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
const bool = (v: unknown): boolean => v === true;
function cbm(l: number | null, w: number | null, h: number | null): number | null {
  if (l == null || w == null || h == null) return null;
  const v = (l * w * h) / 1_000_000;
  return Number.isFinite(v) ? Math.round(v * 10000) / 10000 : null;
}

async function findExisting(db: any, meta: Record<string, unknown>) {
  const imid = str(meta.internet_message_id);
  const from = str(meta.from_email);
  const subj = str(meta.subject);
  let row: any = null;
  if (imid) {
    const { data } = await db.from("quotes").select("id, quote_no, source_meta")
      .eq("source", "outlook_email").filter("source_meta->>internet_message_id", "eq", imid)
      .order("created_at", { ascending: true }).limit(1).maybeSingle();
    row = data;
  }
  if (!row && from && subj) {
    const { data } = await db.from("quotes").select("id, quote_no, source_meta")
      .eq("source", "outlook_email")
      .filter("source_meta->>from_email", "eq", from)
      .filter("source_meta->>subject", "eq", subj)
      .order("created_at", { ascending: true }).limit(1).maybeSingle();
    row = data;
  }
  if (!row) return null;
  return { quote_id: row.id, quote_no: row.quote_no, staff_email: row.source_meta?.staff_email ?? null };
}

async function resolveOrCreateAgent(db: any, name: string): Promise<{ id: string; name: string; created: boolean }> {
  const { data: ex } = await db.from("agents").select("id,name").ilike("name", name).limit(1).maybeSingle();
  if (ex?.id) return { id: ex.id as string, name: ex.name as string, created: false };
  const { data: ins, error } = await db.from("agents").insert({
    name, source: "portal", status: "prospect", trusted: false,
    notes: "Created from Outlook quote add-in",
  }).select("id,name").single();
  if (error || !ins) throw new Error(error?.message ?? "agent insert failed");
  return { id: ins.id as string, name: ins.name as string, created: true };
}

function resolvedName(p: PartyIn): string {
  const r = p.resolution;
  if (r && (r.type === "customer" || r.type === "agent")) return r.name;
  return p.name;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const secret = Deno.env.get("QUOTE_INGEST_SECRET");
  if (!secret || req.headers.get("x-ubf-secret") !== secret) return json({ error: "unauthorized" }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !service) return json({ error: "missing supabase env" }, 500);
  const db = createClient(url, service);

  let payload: Payload;
  try { payload = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  const f = (payload.fields ?? {}) as Fields;
  const meta = (payload.email_meta ?? {}) as Record<string, unknown>;
  const parties = (payload.parties ?? []).filter((p) => str(p?.name));

  try {
    // Dedup guard: unless force=true, refuse to create a second quote for the same email.
    if (!payload.force) {
      const dup = await findExisting(db, meta);
      if (dup) return json({ ok: true, duplicate: true, quote_id: dup.quote_id, quote_no: dup.quote_no, existing_staff: dup.staff_email });
    }

    let createdBy: string | null = null;
    const staffEmail = str(meta.staff_email);
    if (staffEmail) {
      const { data: su } = await db.from("staff_users").select("user_id").ilike("email", staffEmail).maybeSingle();
      createdBy = (su?.user_id as string) ?? null;
    }

    let custByRole: { account_id: string | null; name: string; pending: boolean } | null = null;
    let custAny: { account_id: string | null; name: string; pending: boolean } | null = null;
    let agentId: string | null = null, agentName: string | null = null, agentCreated = false;
    let shipper: string | null = null, consignee: string | null = null;

    for (const p of parties) {
      const role = (str(p.role) ?? "other").toLowerCase();
      const r = (p.resolution ?? { type: "none" }) as Resolution;
      if (role === "shipper" && !shipper) shipper = resolvedName(p);
      if (role === "consignee" && !consignee) consignee = resolvedName(p);

      if (r.type === "agent") { agentId = r.id; agentName = r.name; }
      else if (r.type === "create_agent") {
        const a = await resolveOrCreateAgent(db, p.name); agentId = a.id; agentName = a.name; agentCreated = agentCreated || a.created;
      } else if (r.type === "customer") {
        const cand = { account_id: r.account_id, name: r.name, pending: false };
        if (role === "customer") custByRole = cand; custAny = custAny ?? cand;
      } else if (r.type === "create_customer") {
        const cand = { account_id: null, name: p.name, pending: true };
        if (role === "customer") custByRole = cand; custAny = custAny ?? cand;
      }
    }
    const cust = custByRole ?? custAny;

    const low = payload.low_confidence ?? [];
    const provenance = [
      "Quote created from Outlook (validated in add-in).",
      str(meta.subject) ? `Subject: ${meta.subject}` : null,
      str(meta.from_email) ? `From: ${str(meta.from_name) ?? ""} <${meta.from_email}>` : null,
      agentName ? `Agent: ${agentName}${agentCreated ? " (new)" : ""}` : null,
      str(f.commodity) ? `Commodity: ${f.commodity}` : null,
      cust?.pending ? `New customer to create in ERP: ${cust.name}` : null,
      str(f.pickup_address) ? `Pickup: ${f.pickup_address}` : null,
      low.length ? `Flagged at extraction: ${low.join(", ")}` : null,
    ].filter(Boolean).join("\n");

    const quoteRow: Record<string, unknown> = {
      status: "open", source: "outlook_email",
      shipment_mode: str(f.shipment_mode), shipment_type: str(f.shipment_type), incoterms: str(f.incoterms),
      customer_account_id: cust?.account_id ?? null, customer_name: cust?.name ?? null,
      shipper, consignee, agent_id: agentId, agent_name: agentName,
      from_port_code: upper(f.pol_code), to_port_code: upper(f.pod_code),
      pickup_location: str(f.origin), drop_location: str(f.destination),
      pickup_address: str(f.pickup_address), shipper_address: str(f.pickup_address),
      cargo_value: num(f.cargo_value), cargo_value_currency: str(f.cargo_value_currency) ?? "NZD",
      is_hazardous: bool(f.is_hazardous), need_refrigeration: bool(f.need_refrigeration),
      reefer_temp_c: num(f.reefer_temp_c), dg_un_number: str(f.dg_un_number), dg_class: str(f.dg_class),
      request_received_from: str(meta.from_email), internal_notes: provenance,
      created_by: createdBy, sales_executive_id: createdBy,
      source_meta: {
        channel: "outlook_add_in", subject: str(meta.subject),
        from_name: str(meta.from_name), from_email: str(meta.from_email),
        received_at: meta.received_at ?? null, internet_message_id: meta.internet_message_id ?? null,
        staff_email: staffEmail, customer_pending: cust?.pending ?? false,
        agent_created: agentCreated, low_confidence: low, model: CLAUDE_MODEL,
        committed_at: new Date().toISOString(),
      },
    };

    const { data: quote, error: qErr } = await db.from("quotes").insert(quoteRow).select("id, quote_no").single();
    if (qErr || !quote) throw new Error(qErr?.message ?? "quote insert failed");

    const lines = (payload.cargo_lines ?? []).filter(Boolean);
    if (lines.length) {
      const rows = lines.map((ln, i) => {
        const q = num(ln.quantity) ?? 1;
        const totalWt = num(ln.weight_kg);
        const perPkg = (totalWt != null && q) ? Math.round((totalWt / q) * 1000) / 1000 : null;
        const l = num(ln.length_cm), w = num(ln.width_cm), h = num(ln.height_cm);
        const unitCbm = cbm(l, w, h);
        return {
          quote_id: quote.id, ord: i,
          cargo_description: str(ln.description), package_type: str(ln.package_type),
          quantity: q, packages: q, weight_unit: "KG",
          per_package_weight: perPkg, total_weight: totalWt, gross_wt: totalWt,
          length: l, width: w, height: h, dim_unit: "CM",
          volume_cbm: unitCbm, total_cbm: unitCbm != null ? Math.round(unitCbm * q * 10000) / 10000 : null,
        };
      });
      const { error: clErr } = await db.from("quote_cargo_lines").insert(rows);
      if (clErr) throw new Error(clErr.message);
    }

    return json({
      ok: true, duplicate: false,
      quote_id: quote.id, quote_no: quote.quote_no,
      customer_pending: cust?.pending ?? false, agent_created: agentCreated, staff_matched: !!createdBy,
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
