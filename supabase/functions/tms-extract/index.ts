// tms-extract — UBF Intelligence add-in, TMS mode (validation stage).
// Email -> Claude extraction -> a transport job (sender/receiver + cargo lines).
// NO write. Flags an existing email-sourced consignment (dedup on internetMessageId).
// Auth: x-ubf-secret shared secret (QUOTE_INGEST_SECRET).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { apiFetch, setApiFn } from "../_shared/apiFetch.ts";
setApiFn("tms-extract");

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
type CargoLine = { type?: string | null; units?: number | null; weight_kg?: number | null; length_cm?: number | null; width_cm?: number | null; height_cm?: number | null; marks?: string | null };
type TmsExtract = {
  order_type?: string | null;
  sender_company?: string | null; sender_contact?: string | null; sender_phone?: string | null; sender_email?: string | null; sender_address?: string | null; sender_additional_info?: string | null;
  receiver_company?: string | null; receiver_contact?: string | null; receiver_phone?: string | null; receiver_email?: string | null; receiver_address?: string | null; receiver_additional_info?: string | null;
  preferred_pickup_at?: string | null; preferred_delivery_at?: string | null;
  reference?: string | null; po_number?: string | null; delivery_instructions?: string | null;
  urgent?: boolean | null; tail_lift_required?: boolean | null; fragile?: boolean | null; temperature_control?: boolean | null; signature_required?: boolean | null;
  is_dg?: boolean | null; dangerous_goods_reason?: string | null;
  cargo_lines?: CargoLine[] | null; _low_confidence?: string[] | null;
};

const SYSTEM_PROMPT =
  "You extract a road TRANSPORT (cartage) job from an email for UB Freight, a freight forwarder in " +
  "Auckland, New Zealand. The job is a local pickup/delivery of cargo by truck. Return ONLY valid JSON " +
  "in the requested shape. No markdown, no preamble.\n\n" +
  "RULES:\n" +
  "- Use null for anything not explicitly supported by the text. Never invent names or addresses.\n" +
  "- Low-confidence inferences: fill them and add the field name to _low_confidence.\n" +
  "- order_type: one of 'transfer','pick-up','drop-off'. 'transfer' = a point-to-point move with both " +
  "a collection and a delivery address (the usual case). 'pick-up' = collect only. 'drop-off' = deliver " +
  "only. Default to 'transfer' when both ends are present.\n" +
  "- sender_* = the COLLECTION party/address (where we pick up). receiver_* = the DELIVERY party/address.\n" +
  "- preferred_pickup_at / preferred_delivery_at: ISO 8601 with timezone if a date/time is given; else null.\n" +
  "- cargo_lines: one per distinct line. type is the packaging unit: 'pallet' or 'carton' (map boxes/" +
  "cartons->carton, pallets/skids->pallet; if unclear use 'carton'). units = count of that unit. " +
  "weight_kg = line total. dimensions per unit in cm.\n" +
  "- is_dg true only if dangerous goods are clearly indicated; put the reason in dangerous_goods_reason.";

const FIELD_SHAPE = `{
  "order_type": "transfer",
  "sender_company": null, "sender_contact": null, "sender_phone": null, "sender_email": null, "sender_address": null, "sender_additional_info": null,
  "receiver_company": null, "receiver_contact": null, "receiver_phone": null, "receiver_email": null, "receiver_address": null, "receiver_additional_info": null,
  "preferred_pickup_at": null, "preferred_delivery_at": null,
  "reference": null, "po_number": null, "delivery_instructions": null,
  "urgent": false, "tail_lift_required": false, "fragile": false, "temperature_control": false, "signature_required": false,
  "is_dg": false, "dangerous_goods_reason": null,
  "cargo_lines": [{ "type": "carton", "units": null, "weight_kg": null, "length_cm": null, "width_cm": null, "height_cm": null, "marks": null }],
  "_low_confidence": []
}`;

function parseJson(text: string): TmsExtract {
  const t = text.trim();
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return JSON.parse(fenced ? fenced[1].trim() : t) as TmsExtract;
}

async function extract(email: EmailInput): Promise<TmsExtract> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");
  const userContent = "Extract a transport job from this email. Return JSON matching this shape " +
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
const ORDER_TYPES = ["transfer", "pick-up", "drop-off"];
const CARGO_TYPES = ["pallet", "carton"];

async function findExisting(db: any, email: EmailInput) {
  const imid = str(email.internetMessageId);
  if (!imid) return null;
  const { data } = await db.from("tms_consignments").select("consignment_no, created_at, source_payload")
    .eq("source", "email").filter("source_payload->>internet_message_id", "eq", imid)
    .order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (!data) return null;
  return { consignment_no: data.consignment_no, created_at: data.created_at, staff_email: data.source_payload?.staff_email ?? null };
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
    const orderType = ORDER_TYPES.includes(String(ex.order_type ?? "").toLowerCase()) ? String(ex.order_type).toLowerCase() : "transfer";

    return json({
      ok: true, doc_type: "tms", existing,
      fields: {
        order_type: orderType,
        sender_company: str(ex.sender_company), sender_contact: str(ex.sender_contact), sender_phone: str(ex.sender_phone), sender_email: str(ex.sender_email), sender_address: str(ex.sender_address), sender_additional_info: str(ex.sender_additional_info),
        receiver_company: str(ex.receiver_company), receiver_contact: str(ex.receiver_contact), receiver_phone: str(ex.receiver_phone), receiver_email: str(ex.receiver_email), receiver_address: str(ex.receiver_address), receiver_additional_info: str(ex.receiver_additional_info),
        preferred_pickup_at: str(ex.preferred_pickup_at), preferred_delivery_at: str(ex.preferred_delivery_at),
        reference: str(ex.reference), po_number: str(ex.po_number), delivery_instructions: str(ex.delivery_instructions),
        urgent: ex.urgent === true, tail_lift_required: ex.tail_lift_required === true, fragile: ex.fragile === true,
        temperature_control: ex.temperature_control === true, signature_required: ex.signature_required === true,
        is_dg: ex.is_dg === true, dangerous_goods_reason: str(ex.dangerous_goods_reason),
      },
      cargo_lines: (ex.cargo_lines ?? []).filter(Boolean).map((ln, i) => ({
        ord: i, type: CARGO_TYPES.includes(String(ln.type ?? "").toLowerCase()) ? String(ln.type).toLowerCase() : "carton",
        units: num(ln.units), weight_kg: num(ln.weight_kg),
        length_cm: num(ln.length_cm), width_cm: num(ln.width_cm), height_cm: num(ln.height_cm), marks: str(ln.marks),
      })),
      low_confidence: ex._low_confidence ?? [],
      email_meta: {
        subject: email.subject ?? null, from_name: email.fromName ?? null, from_email: email.fromEmail ?? null,
        received_at: email.receivedIso ?? null, internet_message_id: email.internetMessageId ?? null, staff_email: str(email.staffEmail),
      },
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
