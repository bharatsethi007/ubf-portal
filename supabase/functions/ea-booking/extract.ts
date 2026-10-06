// Export Air booking prefill: free regex pass always, optional Claude pass (staff click "AI fill").
import { apiFetch } from "../_shared/apiFetch.ts";

export const CLAUDE_MODEL = "claude-sonnet-4-6";

export type Party = { name?: string | null; address?: string | null; city?: string | null; postcode?: string | null; country?: string | null;
  contact?: string | null; phone?: string | null; email?: string | null };
export type Line = { pieces?: number | null; l?: number | null; w?: number | null; h?: number | null; kg?: number | null };
export type EaForm = {
  shipper: Party; consignee: Party; destination: string | null; incoterm: string | null; goods: string | null;
  po_refs: string | null; ready_date: string | null; is_dg: boolean; un_number: string | null; notes: string | null;
  lines: Line[]; pickup: { needed: boolean | null; address: string | null; contact: string | null; phone: string | null; ready_time: string | null };
  _low_confidence?: string[];
};

// Pacific + common long-haul export airports, by code and city name.
const AIRPORTS: [RegExp, string][] = [
  [/\b(NAN|NADI|LAUTOKA)\b/i, "NAN"], [/\b(SUV|SUVA|NAUSORI)\b/i, "SUV"], [/\b(TBU|TONGA|NUKU'?ALOFA)\b/i, "TBU"],
  [/\b(APW|APIA|SAMOA)\b/i, "APW"], [/\b(HIR|HONIARA|SOLOMON)/i, "HIR"], [/\b(VLI|PORT VILA|VANUATU)\b/i, "VLI"],
  [/\b(RAR|RAROTONGA|COOK ISLANDS)\b/i, "RAR"], [/\b(NOU|NOUMEA|NEW CALEDONIA)\b/i, "NOU"], [/\b(POM|PORT MORESBY|PNG)\b/i, "POM"],
  [/\b(PPT|TAHITI|PAPEETE)\b/i, "PPT"], [/\b(FUN|TUVALU)\b/i, "FUN"], [/\b(TRW|KIRIBATI|TARAWA)\b/i, "TRW"], [/\b(IUE|NIUE)\b/i, "IUE"],
  [/\b(SYD|SYDNEY)\b/i, "SYD"], [/\b(MEL|MELBOURNE)\b/i, "MEL"], [/\b(BNE|BRISBANE)\b/i, "BNE"],
];

export function regexPrefill(text: string): Partial<EaForm> {
  const t = text.replace(/\s+/g, " ");
  const dest = AIRPORTS.find(([re]) => re.test(t))?.[1] ?? null;
  const pos = Array.from(new Set([
    ...[...t.matchAll(/\bP\.?O\b\.?\s*(?:no\.?|number|#)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9\-\/]{3,})/gi)].map((m) => m[1]),
    ...[...t.matchAll(/\b(PO\d{4,}[A-Z0-9\-]*)/gi)].map((m) => m[1]),
  ].map((x) => x.toUpperCase()).filter((x) => /\d/.test(x)))).slice(0, 6);
  const kg = t.match(/(\d{1,5}(?:\.\d+)?)\s?kgs?\b/i);
  const pcs = t.match(/\b(\d{1,4})\s?(?:x\s)?(pcs|pieces|cartons?|ctns?|pallets?|plts?|pkgs?|packages|boxes|crates?)\b/i);
  const dims = [...t.matchAll(/\b(\d{2,3}(?:\.\d)?)\s?[xX*×]\s?(\d{2,3}(?:\.\d)?)\s?[xX*×]\s?(\d{2,3}(?:\.\d)?)\s?(cm|mm)?/g)].slice(0, 10);
  const lines: Line[] = dims.length
    ? dims.map((m) => { const f = m[4]?.toLowerCase() === "mm" ? 0.1 : 1; return { pieces: 1, l: +m[1] * f, w: +m[2] * f, h: +m[3] * f, kg: null }; })
    : (pcs || kg) ? [{ pieces: pcs ? +pcs[1] : null, kg: kg ? +kg[1] : null }] : [];
  if (dims.length === 1 && pcs) lines[0].pieces = +pcs[1];
  if (lines.length === 1 && kg && lines[0].kg == null) lines[0].kg = +kg[1];
  return { destination: dest, po_refs: pos.join(", ") || null, lines, is_dg: /\b(dangerous goods|DG cargo|UN\s?\d{4}|lithium)\b/i.test(t) };
}

const SCHEMA = JSON.stringify({
  shipper: { name: null, address: null, city: null, postcode: null, country: "NZ", contact: null, phone: null, email: null },
  consignee: { name: null, address: null, city: null, country: null, contact: null, phone: null, email: null },
  destination: null, incoterm: null, goods: null, po_refs: null, ready_date: null, is_dg: false, un_number: null, notes: null,
  lines: [{ pieces: null, l: null, w: null, h: null, kg: null }],
  pickup: { needed: null, address: null, contact: null, phone: null, ready_time: null }, _low_confidence: [],
});

const SYSTEM = `You read emails for UB Freight, a New Zealand freight forwarder, and fill an EXPORT AIR booking (cargo flying out of Auckland).
Return ONLY valid JSON in the given shape. No markdown. Use null for anything not stated; never guess.
shipper = the NZ supplier/exporter the goods come from. consignee = the overseas buyer receiving them (often in Fiji or the Pacific).
destination = IATA airport code (Nadi NAN, Suva SUV, Tonga TBU, Apia APW, Honiara HIR, Port Vila VLI, Rarotonga RAR) or null.
lines: one per distinct package size; l/w/h in cm, kg = total weight of that line. po_refs = purchase order / order numbers, comma separated.
pickup.needed = true only if the email asks UBF to collect, false if the supplier will deliver/drop off, else null.
pickup.address = where to collect if different from the shipper address. ready_date YYYY-MM-DD (NZ dates are day first). ready_time HH:MM.
Ignore signatures, disclaimers and quoted older emails when the newest message disagrees. Put unsure field paths in _low_confidence.`;

export async function aiPrefill(emailText: string, docTexts: string[]): Promise<EaForm> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");
  const docs = docTexts.length ? `\n\n--- ATTACHED DOCUMENTS ---\n${docTexts.join("\n\n---\n")}` : "";
  const res = await apiFetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 2500, system: SYSTEM,
      messages: [{ role: "user", content: `Fill this JSON:\n${SCHEMA}\n\n--- EMAIL ---\n${emailText}${docs}`.slice(0, 160000) }] }),
  });
  if (!res.ok) throw new Error(`AI fill failed: ${res.status}`);
  const out = await res.json();
  const text: string = (out?.content ?? []).map((c: { text?: string }) => c.text ?? "").join("");
  const m = text.match(/\{[\s\S]*\}/);
  return JSON.parse(m ? m[0] : text) as EaForm;
}
