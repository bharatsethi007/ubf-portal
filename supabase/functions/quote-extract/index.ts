// quote-extract — called by the UBF Outlook add-in (validation stage).
// Email in (already read client-side) -> Claude extraction -> returns header
// fields + cargo lines + detected PARTIES, each enriched with candidate matches
// from customers/agents via the search_entities RPC. NO database write.
// Also flags if a quote already exists for this same email (dedup).
//
// Auth: shared secret in the `x-ubf-secret` header (env QUOTE_INGEST_SECRET).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { apiFetch, setApiFn } from "../_shared/apiFetch.ts";
setApiFn("quote-extract");

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

type EmailInput = {
  subject?: string; fromName?: string; fromEmail?: string;
  receivedIso?: string | null; internetMessageId?: string | null;
  staffEmail?: string; body?: string;
};
type CargoLine = {
  description?: string | null; package_type?: string | null; quantity?: number | null;
  weight_kg?: number | null; length_cm?: number | null; width_cm?: number | null; height_cm?: number | null;
};
type Party = { name?: string | null; email?: string | null; role?: string | null };
type QuoteExtract = {
  shipment_mode?: string | null; shipment_type?: string | null; incoterms?: string | null;
  origin?: string | null; destination?: string | null; pol_code?: string | null; pod_code?: string | null;
  pickup_address?: string | null; commodity?: string | null;
  cargo_value?: number | null; cargo_value_currency?: string | null;
  is_hazardous?: boolean | null; need_refrigeration?: boolean | null; reefer_temp_c?: number | null;
  dg_un_number?: string | null; dg_class?: string | null;
  parties?: Party[] | null; cargo_lines?: CargoLine[] | null; _low_confidence?: string[] | null;
};

const SYSTEM_PROMPT =
  "You extract freight QUOTE-REQUEST details from an email for a freight forwarder " +
  "(UB Freight, New Zealand and Pacific lanes). Return ONLY valid JSON in the requested shape. " +
  "No markdown, no preamble.\n\n" +
  "RULES:\n" +
  "- Use null for anything not explicitly supported by the text. Never guess.\n" +
  "- Low-confidence inferences: still fill them, and add the field name to _low_confidence.\n" +
  "- shipment_mode: 'sea' or 'air' only, else null. shipment_type: 'FCL','LCL','air' when clear, else null.\n" +
  "- pol_code / pod_code: loading/discharge PORT or AIRPORT code when given (map AOL/POL and AOD/POD). " +
  "Air = 3-letter IATA (WLG, DFW); sea = 5-letter UN/LOCODE (NZAKL, FJSUV). Uppercase. Null if none stated.\n" +
  "- origin / destination: free-text place names as written; separate from the codes.\n" +
  "- pickup_address: full pickup/shipper street address if given (e.g. after a 'PU:' label).\n" +
  "- parties: list EVERY distinct company/person named, each with a role. role is one of: " +
  "'shipper','consignee','customer','agent','notify','other'. The company SENDING or relaying the " +
  "request (from the signature or sending domain) is usually role 'agent' when it is a forwarder " +
  "distinct from shipper/consignee. Include an email per party when known. Use explicit names only; " +
  "never invent a party from ports, addresses, packing words, or email domains alone.\n" +
  "- cargo_lines: one per distinct line. quantity = packages on that line; weight_kg = total line weight; " +
  "dimensions per package in cm.\n" +
  "- Do not treat packing words (pallets, cartons, crates, boxes) as goods or party names.";

const FIELD_SHAPE = `{
  "shipment_mode": null, "shipment_type": null, "incoterms": null,
  "origin": null, "destination": null, "pol_code": null, "pod_code": null, "pickup_address": null,
  "commodity": null, "cargo_value": null, "cargo_value_currency": null,
  "is_hazardous": false, "need_refrigeration": false, "reefer_temp_c": null,
  "dg_un_number": null, "dg_class": null,
  "parties": [{ "name": null, "email": null, "role": null }],
  "cargo_lines": [{ "description": null, "package_type": null, "quantity": null, "weight_kg": null, "length_cm": null, "width_cm": null, "height_cm": null }],
  "_low_confidence": []
}`;

function parseJson(text: string): QuoteExtract {
  const t = text.trim();
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return JSON.parse(fenced ? fenced[1].trim() : t) as QuoteExtract;
}

async function extractQuote(email: EmailInput): Promise<QuoteExtract> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");
  const userContent =
    "Extract quote-request fields from this email. Return JSON matching this shape " +
    "(all fields nullable except booleans):\n" + FIELD_SHAPE +
    "\n\n--- EMAIL ---\nSubject: " + (email.subject ?? "") +
    "\nFrom: " + (email.fromName ?? "") + " <" + (email.fromEmail ?? "") + ">\n\n" + (email.body ?? "");
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

// Look for an existing quote already created from this same email.
async function findExisting(db: any, email: EmailInput) {
  const imid = str(email.internetMessageId);
  const from = str(email.fromEmail);
  const subj = str(email.subject);
  let row: any = null;
  if (imid) {
    const { data } = await db.from("quotes").select("quote_no, created_at, source_meta")
      .eq("source", "outlook_email").filter("source_meta->>internet_message_id", "eq", imid)
      .order("created_at", { ascending: true }).limit(1).maybeSingle();
    row = data;
  }
  if (!row && from && subj) {
    const { data } = await db.from("quotes").select("quote_no, created_at, source_meta")
      .eq("source", "outlook_email")
      .filter("source_meta->>from_email", "eq", from)
      .filter("source_meta->>subject", "eq", subj)
      .order("created_at", { ascending: true }).limit(1).maybeSingle();
    row = data;
  }
  if (!row) return null;
  return { quote_no: row.quote_no, created_at: row.created_at, staff_email: row.source_meta?.staff_email ?? null };
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

  let email: EmailInput;
  try { email = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  if (!str(email.body) && !str(email.subject)) return json({ error: "empty email" }, 400);

  try {
    const [ex, existing] = await Promise.all([extractQuote(email), findExisting(db, email)]);

    const rawParties = (ex.parties ?? []).filter((p) => str(p?.name));
    const parties = [] as Array<Record<string, unknown>>;
    for (const p of rawParties) {
      const nm = str(p.name)!;
      let customer_matches: unknown[] = [];
      let agent_matches: unknown[] = [];
      const { data: m } = await db.rpc("search_entities", { q: nm });
      if (m && typeof m === "object") {
        customer_matches = (m as any).customers ?? [];
        agent_matches = (m as any).agents ?? [];
      }
      parties.push({
        name: nm, email: str(p.email),
        role: (str(p.role) ?? "other").toLowerCase(),
        customer_matches, agent_matches,
      });
    }

    return json({
      ok: true,
      doc_type: "quotation",
      existing,
      fields: {
        shipment_mode: str(ex.shipment_mode),
        shipment_type: str(ex.shipment_type),
        incoterms: str(ex.incoterms),
        origin: str(ex.origin),
        destination: str(ex.destination),
        pol_code: str(ex.pol_code) ? String(ex.pol_code).toUpperCase() : null,
        pod_code: str(ex.pod_code) ? String(ex.pod_code).toUpperCase() : null,
        pickup_address: str(ex.pickup_address),
        commodity: str(ex.commodity),
        cargo_value: num(ex.cargo_value),
        cargo_value_currency: str(ex.cargo_value_currency) ?? "NZD",
        is_hazardous: ex.is_hazardous === true,
        need_refrigeration: ex.need_refrigeration === true,
        reefer_temp_c: num(ex.reefer_temp_c),
        dg_un_number: str(ex.dg_un_number),
        dg_class: str(ex.dg_class),
      },
      cargo_lines: (ex.cargo_lines ?? []).filter(Boolean).map((ln, i) => ({
        ord: i,
        description: str(ln.description),
        package_type: str(ln.package_type),
        quantity: num(ln.quantity) ?? 1,
        weight_kg: num(ln.weight_kg),
        length_cm: num(ln.length_cm),
        width_cm: num(ln.width_cm),
        height_cm: num(ln.height_cm),
      })),
      parties,
      low_confidence: ex._low_confidence ?? [],
      email_meta: {
        subject: email.subject ?? null,
        from_name: email.fromName ?? null,
        from_email: email.fromEmail ?? null,
        received_at: email.receivedIso ?? null,
        internet_message_id: email.internetMessageId ?? null,
        staff_email: str(email.staffEmail),
      },
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
