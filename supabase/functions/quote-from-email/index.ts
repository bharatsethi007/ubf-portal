// quote-from-email — interactive endpoint called by the UBF Outlook add-in.
// The pane reads the open email client-side (Office.js) and POSTs it here.
// We extract quote fields with Claude and write a DRAFT quote
// (status 'open', source 'outlook_email') plus cargo lines, attributed to the
// sending staff member, for a pricer to complete in the portal.
//
// Auth: shared secret in the `x-ubf-secret` header (env QUOTE_INGEST_SECRET).
// verify_jwt is disabled because this implements its own auth. Office SSO will
// replace the shared secret in a later step.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { apiFetch, setApiFn } from "../_shared/apiFetch.ts";
setApiFn("quote-from-email");

const CLAUDE_MODEL = "claude-sonnet-4-6";
const ALLOWED_ORIGIN = "https://ubf-outlook.netlify.app";

const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-ubf-secret",
  "Access-Control-Max-Age": "86400",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });

type EmailInput = {
  subject?: string;
  fromName?: string;
  fromEmail?: string;
  receivedIso?: string | null;
  internetMessageId?: string | null;
  staffEmail?: string;
  body?: string;
};

type CargoLine = {
  description?: string | null;
  package_type?: string | null;
  quantity?: number | null;
  weight_kg?: number | null;
  length_cm?: number | null;
  width_cm?: number | null;
  height_cm?: number | null;
};

type QuoteExtract = {
  shipment_mode?: string | null;
  shipment_type?: string | null;
  incoterms?: string | null;
  customer_name?: string | null;
  agent_name?: string | null;
  shipper?: string | null;
  consignee?: string | null;
  origin?: string | null;
  destination?: string | null;
  pol_code?: string | null;
  pod_code?: string | null;
  pickup_address?: string | null;
  commodity?: string | null;
  cargo_value?: number | null;
  cargo_value_currency?: string | null;
  is_hazardous?: boolean | null;
  need_refrigeration?: boolean | null;
  reefer_temp_c?: number | null;
  dg_un_number?: string | null;
  dg_class?: string | null;
  cargo_lines?: CargoLine[] | null;
  _low_confidence?: string[] | null;
};

const SYSTEM_PROMPT =
  "You extract freight QUOTE-REQUEST details from an email for a freight forwarder " +
  "(UB Freight, New Zealand and Pacific lanes). Return ONLY valid JSON in the requested " +
  "shape. No markdown, no preamble.\n\n" +
  "RULES:\n" +
  "- Use null for anything not explicitly supported by the text. Never guess.\n" +
  "- If you infer a value with low confidence, still fill it and add the field name to _low_confidence.\n" +
  "- shipment_mode: 'sea' or 'air' only, else null.\n" +
  "- shipment_type: 'FCL', 'LCL', or 'air' when clear, else null.\n" +
  "- pol_code / pod_code: the loading/discharge PORT or AIRPORT code when given. Map labels like " +
  "AOL/POL to pol_code and AOD/POD to pod_code. Air uses 3-letter IATA (e.g. WLG, DFW); sea uses " +
  "5-letter UN/LOCODE (e.g. NZAKL, FJSUV). Uppercase. Null if no code/port is stated.\n" +
  "- origin / destination: free-text place names as written (city/country); separate from the codes.\n" +
  "- pickup_address: the full pickup / shipper street address if given (e.g. after a 'PU:' label).\n" +
  "- customer_name: the paying customer, ONLY if explicitly identifiable. If the email is from an " +
  "overseas forwarder/agent on behalf of a shipper, do NOT assume the customer — leave null and flag it.\n" +
  "- agent_name: the forwarding company/partner sending or relaying this request (from the signature " +
  "or sending domain) when it is clearly a forwarder distinct from shipper/consignee; else null.\n" +
  "- shipper / consignee: explicit names only; never invent from ports, addresses, packing words, or domains.\n" +
  "- cargo_lines: one object per distinct cargo line. quantity = number of packages on that line; " +
  "weight_kg = total weight for that line (all its packages); dimensions per package in cm.\n" +
  "- Do not treat packing words (pallets, cartons, crates, boxes) as goods or as party names.";

const FIELD_SHAPE = `{
  "shipment_mode": null,
  "shipment_type": null,
  "incoterms": null,
  "customer_name": null,
  "agent_name": null,
  "shipper": null,
  "consignee": null,
  "origin": null,
  "destination": null,
  "pol_code": null,
  "pod_code": null,
  "pickup_address": null,
  "commodity": null,
  "cargo_value": null,
  "cargo_value_currency": null,
  "is_hazardous": false,
  "need_refrigeration": false,
  "reefer_temp_c": null,
  "dg_un_number": null,
  "dg_class": null,
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
    "\nFrom: " + (email.fromName ?? "") + " <" + (email.fromEmail ?? "") + ">\n\n" +
    (email.body ?? "");

  const res = await apiFetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 3072,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const block = data.content?.find((c: { type: string }) => c.type === "text");
  if (!block?.text) throw new Error("Claude response missing text block");
  return parseJson(block.text as string);
}

const num = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown): string | null => {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
};
const upper = (v: unknown): string | null => {
  const s = str(v);
  return s ? s.toUpperCase() : null;
};
function cbm(l: number | null, w: number | null, h: number | null): number | null {
  if (l == null || w == null || h == null) return null;
  const v = (l * w * h) / 1_000_000;
  return Number.isFinite(v) ? Math.round(v * 10000) / 10000 : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const secret = Deno.env.get("QUOTE_INGEST_SECRET");
  if (!secret || req.headers.get("x-ubf-secret") !== secret) {
    return json({ error: "unauthorized" }, 401);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !service) return json({ error: "missing supabase env" }, 500);
  const db = createClient(url, service);

  let email: EmailInput;
  try {
    email = await req.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }
  if (!str(email.body) && !str(email.subject)) return json({ error: "empty email" }, 400);

  try {
    const ex = await extractQuote(email);

    // Attribute the draft to the staff member who pushed it (their Outlook address).
    let createdBy: string | null = null;
    const staffEmail = str(email.staffEmail);
    if (staffEmail) {
      const { data: su } = await db.from("staff_users")
        .select("user_id").ilike("email", staffEmail).maybeSingle();
      createdBy = (su?.user_id as string) ?? null;
    }

    const low = ex._low_confidence ?? [];
    const provenance = [
      "Draft created from Outlook email.",
      email.subject ? `Subject: ${email.subject}` : null,
      email.fromEmail ? `From: ${email.fromName ?? ""} <${email.fromEmail}>` : null,
      ex.agent_name ? `Requesting agent: ${ex.agent_name}` : null,
      ex.commodity ? `Commodity: ${ex.commodity}` : null,
      ex.pickup_address ? `Pickup: ${ex.pickup_address}` : null,
      low.length ? `Needs review: ${low.join(", ")}` : null,
    ].filter(Boolean).join("\n");

    const quoteRow: Record<string, unknown> = {
      status: "open",
      source: "outlook_email",
      shipment_mode: str(ex.shipment_mode),
      shipment_type: str(ex.shipment_type),
      incoterms: str(ex.incoterms),
      customer_name: str(ex.customer_name),
      shipper: str(ex.shipper),
      consignee: str(ex.consignee),
      from_port_code: upper(ex.pol_code),
      to_port_code: upper(ex.pod_code),
      pickup_location: str(ex.origin),
      drop_location: str(ex.destination),
      pickup_address: str(ex.pickup_address),
      shipper_address: str(ex.pickup_address),
      cargo_value: num(ex.cargo_value),
      cargo_value_currency: str(ex.cargo_value_currency) ?? "NZD",
      is_hazardous: ex.is_hazardous === true,
      need_refrigeration: ex.need_refrigeration === true,
      reefer_temp_c: num(ex.reefer_temp_c),
      dg_un_number: str(ex.dg_un_number),
      dg_class: str(ex.dg_class),
      request_received_from: str(email.fromEmail),
      internal_notes: provenance,
      created_by: createdBy,
      sales_executive_id: createdBy,
      source_meta: {
        channel: "outlook_add_in",
        subject: email.subject ?? null,
        from_name: email.fromName ?? null,
        from_email: email.fromEmail ?? null,
        received_at: email.receivedIso ?? null,
        internet_message_id: email.internetMessageId ?? null,
        staff_email: staffEmail,
        agent_name: str(ex.agent_name),
        commodity: str(ex.commodity),
        low_confidence: low,
        model: CLAUDE_MODEL,
        extracted_at: new Date().toISOString(),
      },
    };

    const { data: quote, error: qErr } = await db.from("quotes")
      .insert(quoteRow).select("id, quote_no").single();
    if (qErr || !quote) throw new Error(qErr?.message ?? "quote insert failed");

    const lines = (ex.cargo_lines ?? []).filter(Boolean);
    if (lines.length) {
      const rows = lines.map((ln, i) => {
        const q = num(ln.quantity) ?? 1;
        const totalWt = num(ln.weight_kg);
        const perPkg = (totalWt != null && q) ? Math.round((totalWt / q) * 1000) / 1000 : null;
        const l = num(ln.length_cm), w = num(ln.width_cm), h = num(ln.height_cm);
        const unitCbm = cbm(l, w, h);
        return {
          quote_id: quote.id,
          ord: i,
          cargo_description: str(ln.description),
          package_type: str(ln.package_type),
          quantity: q,
          packages: q,
          weight_unit: "KG",
          per_package_weight: perPkg,
          total_weight: totalWt,
          gross_wt: totalWt,
          length: l, width: w, height: h, dim_unit: "CM",
          volume_cbm: unitCbm,
          total_cbm: unitCbm != null ? Math.round(unitCbm * q * 10000) / 10000 : null,
        };
      });
      const { error: clErr } = await db.from("quote_cargo_lines").insert(rows);
      if (clErr) throw new Error(clErr.message);
    }

    return json({
      ok: true,
      quote_id: quote.id,
      quote_no: quote.quote_no,
      low_confidence: low,
      staff_matched: !!createdBy,
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
