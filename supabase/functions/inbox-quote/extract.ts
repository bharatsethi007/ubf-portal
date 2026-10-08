// AI read for "Create quote" from a Sales Support email thread. One Claude call: thread + PDF text.
import { apiFetch } from "../_shared/apiFetch.ts";

export const CLAUDE_MODEL = "claude-sonnet-4-6";

export type QExtract = {
  movement_type?: "import" | "export" | "crosstrade" | null; shipment_mode?: "sea" | "air" | null;
  shipment_type?: "FCL" | "LCL" | "Air" | null; incoterms?: string | null; incoterm_place?: string | null;
  customer_name?: string | null; agent_name?: string | null; contact_name?: string | null;
  contact_email?: string | null; contact_phone?: string | null; customer_po?: string | null;
  shipper?: string | null; shipper_address?: string | null; consignee?: string | null; consignee_address?: string | null;
  origin?: string | null; destination?: string | null; pol_code?: string | null; pod_code?: string | null;
  pickup_address?: string | null; pickup_postal_code?: string | null; delivery_address?: string | null; delivery_postal_code?: string | null;
  pickup_date?: string | null; delivery_date?: string | null; commodity?: string | null;
  cargo_value?: number | null; cargo_value_currency?: string | null; need_insurance?: boolean | null;
  stackable?: boolean | null; is_hazardous?: boolean | null; dg_un_number?: string | null; dg_class?: string | null;
  need_refrigeration?: boolean | null; reefer_temp_c?: number | null; service_type?: string | null;
  notes?: string | null;
  containers?: { size?: string | null; kind?: string | null; qty?: number | null; weight_mt?: number | null }[] | null;
  cargo_lines?: { description?: string | null; package_type?: string | null; quantity?: number | null;
    weight_kg?: number | null; length_cm?: number | null; width_cm?: number | null; height_cm?: number | null }[] | null;
  _low_confidence?: string[] | null;
};

const SCHEMA = `{"movement_type":null,"shipment_mode":null,"shipment_type":null,"incoterms":null,"incoterm_place":null,
"customer_name":null,"agent_name":null,"contact_name":null,"contact_email":null,"contact_phone":null,"customer_po":null,
"shipper":null,"shipper_address":null,"consignee":null,"consignee_address":null,
"origin":null,"destination":null,"pol_code":null,"pod_code":null,
"pickup_address":null,"pickup_postal_code":null,"delivery_address":null,"delivery_postal_code":null,
"pickup_date":null,"delivery_date":null,"commodity":null,"cargo_value":null,"cargo_value_currency":null,
"need_insurance":false,"stackable":null,"is_hazardous":false,"dg_un_number":null,"dg_class":null,
"need_refrigeration":false,"reefer_temp_c":null,"service_type":null,"notes":null,
"containers":[{"size":null,"kind":null,"qty":null,"weight_mt":null}],
"cargo_lines":[{"description":null,"package_type":null,"quantity":null,"weight_kg":null,"length_cm":null,"width_cm":null,"height_cm":null}],
"_low_confidence":[]}`;

const SYSTEM = `You read freight QUOTE REQUESTS (rate enquiries) sent to UB Freight, a New Zealand forwarder on NZ, Australia and Pacific lanes.
Return ONLY valid JSON in the given shape. No markdown. Fill every field the email or attachments support. Null when not stated; never guess.
Add any field you inferred with low confidence to _low_confidence.
movement_type: import = into New Zealand, export = out of New Zealand, crosstrade = neither end in NZ.
shipment_mode: sea or air. shipment_type: FCL, LCL or Air.
pol_code / pod_code: port or airport codes if written (sea UN/LOCODE like NZAKL, air IATA like AKL). Uppercase.
origin / destination: place names as written.
containers (FCL only): size is one of 20, 20HC, 40, 40HC (40HQ = 40HC, 20GP = 20, 40GP = 40). kind is standard, reefer, opentop, flatrack, isotank or openside. qty per size. weight_mt per container in tonnes.
cargo_lines (LCL / Air): one per distinct line. quantity = packages; weight_kg = total line weight; dimensions per package in cm.
customer_name: the paying customer if clear. agent_name: an overseas forwarder sending on behalf of a shipper, if any.
contact_*: the person asking for the quote. Dates YYYY-MM-DD. Packing words (pallets, cartons) are package_type, never goods or parties.
notes: one or two short lines of anything else pricing needs (transit needs, special handling, frequency). Ignore signatures and disclaimers. Prefer the newest message when details conflict.`;

export async function aiExtract(emailText: string, docTexts: string[]): Promise<QExtract> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");
  const docs = docTexts.length ? `\n\n--- ATTACHED DOCUMENTS ---\n${docTexts.join("\n\n---\n")}` : "";
  const user = `Fill this JSON:\n${SCHEMA}\n\n--- EMAIL THREAD ---\n${emailText}${docs}`;
  const res = await apiFetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 3500, system: SYSTEM, messages: [{ role: "user", content: user.slice(0, 180000) }] }),
  });
  if (!res.ok) throw new Error(`AI read failed: ${res.status}`);
  const out = await res.json();
  const text: string = (out?.content ?? []).map((c: { text?: string }) => c.text ?? "").join("");
  const m = text.match(/\{[\s\S]*\}/);
  return JSON.parse(m ? m[0] : text) as QExtract;
}
