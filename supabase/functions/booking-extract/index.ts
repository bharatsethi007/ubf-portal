// booking-extract — UBF Intelligence add-in, Booking mode (validation stage).
// Email -> Claude extraction -> booking fields + module guess (EA/ES/IA/IS) +
// detected parties with candidate matches (search_entities). NO write.
// Flags an existing booking already created from the same email (dedup).
// Auth: x-ubf-secret shared secret.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { apiFetch, setApiFn } from "../_shared/apiFetch.ts";
setApiFn("booking-extract");

const CLAUDE_MODEL = "claude-sonnet-4-6";
const ALLOWED_ORIGIN = "https://ubf-outlook.netlify.app";
const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-ubf-secret",
  "Access-Control-Max-Age": "86400",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json", ...cors } });

type EmailInput = { subject?: string; fromName?: string; fromEmail?: string; receivedIso?: string | null; internetMessageId?: string | null; staffEmail?: string; body?: string };
type Party = { name?: string | null; email?: string | null; role?: string | null };
type CargoLine = { pieces?: number | null; weight_kg?: number | null; length_cm?: number | null; width_cm?: number | null; height_cm?: number | null; goods_desc?: string | null };
type BookingExtract = {
  module?: string | null; incoterm?: string | null; origin?: string | null; destination?: string | null;
  pol_code?: string | null; pod_code?: string | null; commodity?: string | null; goods_description?: string | null;
  packing_type?: string | null; pieces?: number | null; gross_weight_kg?: number | null; volume_m3?: number | null;
  shipper_address?: string | null; shipper_city?: string | null; shipper_country?: string | null; shipper_phone?: string | null; shipper_email?: string | null;
  consignee_address?: string | null; consignee_city?: string | null; consignee_country?: string | null; consignee_phone?: string | null; consignee_email?: string | null;
  notify_name?: string | null; notify_address?: string | null; notify_country?: string | null;
  cargo_ready_date?: string | null; etd?: string | null;
  is_dg?: boolean | null; un_number?: string | null; dg_class?: string | null; is_temp_controlled?: boolean | null; temp_range?: string | null;
  parties?: Party[] | null; cargo_lines?: CargoLine[] | null; _low_confidence?: string[] | null;
};

const SYSTEM_PROMPT =
  "You extract freight BOOKING details from an email for UB Freight, a freight forwarder based in " +
  "New Zealand (Auckland). Return ONLY valid JSON in the requested shape. No markdown, no preamble.\n\n" +
  "RULES:\n" +
  "- Use null for anything not explicitly supported by the text. Never guess party names.\n" +
  "- Low-confidence inferences: fill them and add the field name to _low_confidence.\n" +
  "- module: one of 'EA','ES','IA','IS'. UBF is in New Zealand. If cargo moves FROM New Zealand to " +
  "overseas it is an EXPORT; if it moves TO New Zealand it is an IMPORT. Air vs Sea from the context. " +
  "EA=Export Air, ES=Export Sea, IA=Import Air, IS=Import Sea. Null only if truly undeterminable.\n" +
  "- pol_code / pod_code: loading/discharge PORT or AIRPORT code when given (map AOL/POL and AOD/POD). " +
  "Air = 3-letter IATA; sea = 5-letter UN/LOCODE. Uppercase. origin/destination = free-text place names.\n" +
  "- parties: list EVERY distinct company named, each with a role from: " +
  "'shipper','consignee','customer','agent','notify','other'. The forwarder sending/relaying the " +
  "request is usually role 'agent'. Explicit names only; include email when known.\n" +
  "- cargo_lines: one per distinct line. pieces, weight_kg (line total), dimensions per package in cm.\n" +
  "- Do not treat packing words (pallets, cartons, crates, boxes) as goods or party names.";

const FIELD_SHAPE = `{
  "module": null, "incoterm": null, "origin": null, "destination": null, "pol_code": null, "pod_code": null,
  "commodity": null, "goods_description": null, "packing_type": null,
  "pieces": null, "gross_weight_kg": null, "volume_m3": null,
  "shipper_address": null, "shipper_city": null, "shipper_country": null, "shipper_phone": null, "shipper_email": null,
  "consignee_address": null, "consignee_city": null, "consignee_country": null, "consignee_phone": null, "consignee_email": null,
  "notify_name": null, "notify_address": null, "notify_country": null,
  "cargo_ready_date": null, "etd": null,
  "is_dg": false, "un_number": null, "dg_class": null, "is_temp_controlled": false, "temp_range": null,
  "parties": [{ "name": null, "email": null, "role": null }],
  "cargo_lines": [{ "pieces": null, "weight_kg": null, "length_cm": null, "width_cm": null, "height_cm": null, "goods_desc": null }],
  "_low_confidence": []
}`;

function parseJson(text: string): BookingExtract {
  const t = text.trim();
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return JSON.parse(fenced ? fenced[1].trim() : t) as BookingExtract;
}

async function extract(email: EmailInput): Promise<BookingExtract> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");
  const userContent = "Extract booking fields from this email. Return JSON matching this shape " +
    "(all fields nullable except booleans):\n" + FIELD_SHAPE +
    "\n\n--- EMAIL ---\nSubject: " + (email.subject ?? "") + "\nFrom: " + (email.fromName ?? "") + " <" + (email.fromEmail ?? "") + ">\n\n" + (email.body ?? "");
  const res = await apiFetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 3072, system: SYSTEM_PROMPT, messages: [{ role: "user", content: userContent }] }),
  });
  if (!res.ok) throw new Error(`Claude API failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const block = data.content?.find((c: { type: string }) => c.type === "text");
  if (!block?.text) throw new Error("Claude response missing text block");
  return parseJson(block.text as string);
}

const str = (v: unknown): string | null => { if (v == null) return null; const s = String(v).trim(); return s || null; };
const num = (v: unknown): number | null => { if (v == null || v === "") return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
const MODULES = ["EA", "ES", "IA", "IS"];

async function findExisting(db: any, email: EmailInput) {
  const imid = str(email.internetMessageId);
  if (!imid) return null;
  const { data } = await db.from("bookings").select("booking_ref, created_at, source_payload")
    .eq("source", "email_import").filter("source_payload->>internet_message_id", "eq", imid)
    .order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (!data) return null;
  return { booking_ref: data.booking_ref, created_at: data.created_at, staff_email: data.source_payload?.staff_email ?? null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const secret = Deno.env.get("QUOTE_INGEST_SECRET");
  if (!secret || req.headers.get("x-ubf-secret") !== secret) return json({ error: "unauthorized" }, 401);
  const url = Deno.env.get("SUPABASE_URL"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !service) return json({ error: "missing supabase env" }, 500);
  const db = createClient(url, service);

  let email: EmailInput;
  try { email = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  if (!str(email.body) && !str(email.subject)) return json({ error: "empty email" }, 400);

  try {
    const [ex, existing] = await Promise.all([extract(email), findExisting(db, email)]);
    const moduleGuess = MODULES.includes(String(ex.module ?? "").toUpperCase()) ? String(ex.module).toUpperCase() : null;

    const rawParties = (ex.parties ?? []).filter((p) => str(p?.name));
    const parties = [] as Array<Record<string, unknown>>;
    for (const p of rawParties) {
      const nm = str(p.name)!;
      const { data: m } = await db.rpc("search_entities", { q: nm });
      parties.push({
        name: nm, email: str(p.email), role: (str(p.role) ?? "other").toLowerCase(),
        customer_matches: (m as any)?.customers ?? [], agent_matches: (m as any)?.agents ?? [],
      });
    }

    return json({
      ok: true, doc_type: "booking", existing, module_guess: moduleGuess,
      fields: {
        module: moduleGuess, incoterm: str(ex.incoterm),
        origin: str(ex.origin), destination: str(ex.destination),
        pol_code: str(ex.pol_code) ? String(ex.pol_code).toUpperCase() : null,
        pod_code: str(ex.pod_code) ? String(ex.pod_code).toUpperCase() : null,
        commodity: str(ex.commodity), goods_description: str(ex.goods_description), packing_type: str(ex.packing_type),
        pieces: num(ex.pieces), gross_weight_kg: num(ex.gross_weight_kg), volume_m3: num(ex.volume_m3),
        shipper_address: str(ex.shipper_address), shipper_city: str(ex.shipper_city), shipper_country: str(ex.shipper_country),
        shipper_phone: str(ex.shipper_phone), shipper_email: str(ex.shipper_email),
        consignee_address: str(ex.consignee_address), consignee_city: str(ex.consignee_city), consignee_country: str(ex.consignee_country),
        consignee_phone: str(ex.consignee_phone), consignee_email: str(ex.consignee_email),
        notify_name: str(ex.notify_name), notify_address: str(ex.notify_address), notify_country: str(ex.notify_country),
        cargo_ready_date: str(ex.cargo_ready_date), etd: str(ex.etd),
        is_dg: ex.is_dg === true, un_number: str(ex.un_number), dg_class: str(ex.dg_class),
        is_temp_controlled: ex.is_temp_controlled === true, temp_range: str(ex.temp_range),
      },
      cargo_lines: (ex.cargo_lines ?? []).filter(Boolean).map((ln, i) => ({
        ord: i, pieces: num(ln.pieces), weight_kg: num(ln.weight_kg),
        length_cm: num(ln.length_cm), width_cm: num(ln.width_cm), height_cm: num(ln.height_cm), goods_desc: str(ln.goods_desc),
      })),
      parties, low_confidence: ex._low_confidence ?? [],
      email_meta: {
        subject: email.subject ?? null, from_name: email.fromName ?? null, from_email: email.fromEmail ?? null,
        received_at: email.receivedIso ?? null, internet_message_id: email.internetMessageId ?? null, staff_email: str(email.staffEmail),
      },
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
