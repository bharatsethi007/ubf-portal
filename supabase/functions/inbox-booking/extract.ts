// AI fill for "Create booking from email". One Claude call, only when staff click "AI fill".
import { apiFetch } from "../_shared/apiFetch.ts";

export const CLAUDE_MODEL = "claude-sonnet-4-6";

export type Extract = {
  customer_ref?: string | null; shipper_name?: string | null; consignee_name?: string | null; importer_name?: string | null;
  origin?: string | null; destination?: string | null; incoterm?: string | null; commodity?: string | null;
  goods_description?: string | null; pieces?: number | null; packing_type?: string | null;
  gross_weight_kg?: number | null; volume_m3?: number | null; cargo_ready_date?: string | null;
  etd?: string | null; eta?: string | null; load_type?: "FCL" | "LCL" | null;
  vessel?: string | null; voyage?: string | null; shipping_line?: string | null; mbl_no?: string | null;
  airline?: string | null; flight_no?: string | null; mawb?: string | null; hawb?: string | null;
  containers?: { container_no?: string | null; container_type?: string | null }[] | null;
  is_dg?: boolean | null; un_number?: string | null; special_instructions?: string | null;
  _low_confidence?: string[] | null;
};

const MODE: Record<string, string> = {
  IS: "IMPORT by SEA into New Zealand", IA: "IMPORT by AIR into New Zealand",
  ES: "EXPORT by SEA from New Zealand", EA: "EXPORT by AIR from New Zealand",
};

const SCHEMA = `{"customer_ref":null,"shipper_name":null,"consignee_name":null,"importer_name":null,
"origin":null,"destination":null,"incoterm":null,"commodity":null,"goods_description":null,"pieces":null,
"packing_type":null,"gross_weight_kg":null,"volume_m3":null,"cargo_ready_date":null,"etd":null,"eta":null,
"load_type":null,"vessel":null,"voyage":null,"shipping_line":null,"mbl_no":null,
"airline":null,"flight_no":null,"mawb":null,"hawb":null,
"containers":[{"container_no":null,"container_type":null}],
"is_dg":false,"un_number":null,"special_instructions":null,"_low_confidence":[]}`;

const SYSTEM = `You extract freight booking details from customer emails and their attached documents for UB Freight,
a New Zealand freight forwarder. Return ONLY valid JSON in the given shape. No markdown.
Rules: use null for anything not explicitly stated; never guess. Add field names you are unsure of to _low_confidence.
Party names only when explicitly written. Packing words (pallets, cartons) are packing_type, never goods or parties.
Ports: give the city or port name, or the code if written (UN/LOCODE for sea, IATA for air).
Dates as YYYY-MM-DD. Weights in kg, volume in cubic metres. container_no only if a real ISO number (4 letters + 7 digits).
container_type as 20GP, 40GP, 40HQ, 20RF, 40RF, 20OT, 40OT, 20FR or 40FR.
Ignore email signatures, disclaimers and mail headers. Prefer the newest message when details conflict.`;

export async function aiExtract(module: string, emailText: string, docTexts: string[]): Promise<Extract> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");
  const docs = docTexts.length ? `\n\n--- ATTACHED DOCUMENTS ---\n${docTexts.join("\n\n---\n")}` : "";
  const user = `This is a ${MODE[module] ?? "freight"} booking. Fill this JSON:\n${SCHEMA}\n\n--- EMAIL THREAD ---\n${emailText}${docs}`;
  const res = await apiFetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 3000, system: SYSTEM, messages: [{ role: "user", content: user.slice(0, 180000) }] }),
  });
  if (!res.ok) throw new Error(`AI fill failed: ${res.status}`);
  const out = await res.json();
  const text: string = (out?.content ?? []).map((c: { text?: string }) => c.text ?? "").join("");
  const m = text.match(/\{[\s\S]*\}/);
  return JSON.parse(m ? m[0] : text) as Extract;
}
