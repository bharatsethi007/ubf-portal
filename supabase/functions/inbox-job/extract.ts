// "Update job from email": one Claude call reading the email + PDFs, returning only job facts stated there.
import { apiFetch } from "../_shared/apiFetch.ts";

export const CLAUDE_MODEL = "claude-sonnet-4-6";

// field -> label. Order = display order. Only these can ever be written by "Update job".
export const FIELDS: Record<string, { label: string; kind: "date" | "text" | "num" }> = {
  eta: { label: "ETA", kind: "date" }, etd: { label: "ETD", kind: "date" },
  vessel: { label: "Vessel", kind: "text" }, voyage: { label: "Voyage", kind: "text" },
  mbl_no: { label: "MBL", kind: "text" }, hawb: { label: "HAWB / HBL", kind: "text" }, mawb: { label: "MAWB", kind: "text" },
  airline_name: { label: "Airline", kind: "text" }, flight_no: { label: "Flight", kind: "text" },
  discharge_date: { label: "Discharge date", kind: "date" }, last_free_day: { label: "Last free day", kind: "date" },
  delivery_date: { label: "Delivery date", kind: "date" }, container_return_date: { label: "Empty return", kind: "date" },
  customer_ref: { label: "Customer ref", kind: "text" }, pieces: { label: "Pieces", kind: "num" },
  gross_weight_kg: { label: "Weight kg", kind: "num" }, volume_m3: { label: "Volume m3", kind: "num" },
  goods_description: { label: "Goods", kind: "text" },
};

export type UpdateExtract = Record<string, unknown> & {
  containers?: { container_no?: string | null; container_type?: string | null }[] | null;
  _low_confidence?: string[] | null;
};

const SCHEMA = JSON.stringify({ ...Object.fromEntries(Object.keys(FIELDS).map((k) => [k, null])),
  containers: [{ container_no: null, container_type: null }], _low_confidence: [] });

const SYSTEM = `You read freight emails and attached documents for UB Freight, a New Zealand forwarder,
and pull out facts that update an existing job. Return ONLY valid JSON in the given shape. No markdown.
Use null for anything not explicitly stated. Never guess. Put unsure field names in _low_confidence.
Dates as YYYY-MM-DD (emails are NZ format: 05/10/2026 is 5 October). Weights kg, volume cubic metres.
discharge_date = vessel discharged at NZ port. last_free_day = last day before storage/demurrage.
container_no only if a real ISO number (4 letters + 7 digits). container_type as 20GP, 40GP, 40HQ, 20RF, 40RF, 20OT, 40OT, 20FR or 40FR.
Ignore signatures, disclaimers and quoted older emails when the newest message disagrees.`;

export async function aiUpdate(jobSummary: string, emailText: string, docTexts: string[]): Promise<UpdateExtract> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");
  const docs = docTexts.length ? `\n\n--- ATTACHED DOCUMENTS ---\n${docTexts.join("\n\n---\n")}` : "";
  const user = `Existing job: ${jobSummary}\nFill this JSON from the email:\n${SCHEMA}\n\n--- EMAIL ---\n${emailText}${docs}`;
  const res = await apiFetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 2000, system: SYSTEM, messages: [{ role: "user", content: user.slice(0, 160000) }] }),
  });
  if (!res.ok) throw new Error(`AI read failed: ${res.status}`);
  const out = await res.json();
  const text: string = (out?.content ?? []).map((c: { text?: string }) => c.text ?? "").join("");
  const m = text.match(/\{[\s\S]*\}/);
  return JSON.parse(m ? m[0] : text) as UpdateExtract;
}

// Normalise a value for the column type; null when unusable.
export function norm(kind: "date" | "text" | "num", v: unknown): string | number | null {
  if (v == null || v === "") return null;
  if (kind === "num") { const n = Number(v); return Number.isFinite(n) ? n : null; }
  const t = String(v).trim();
  if (!t) return null;
  if (kind === "date") return /^\d{4}-\d{2}-\d{2}/.test(t) ? t.slice(0, 10) : null;
  return t.slice(0, 500);
}
