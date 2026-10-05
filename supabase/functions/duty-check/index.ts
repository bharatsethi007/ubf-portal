// duty-check — given a commodity, value and country of origin, ask Claude for the
// NZ import HS code, indicative duty rate and GST. Advisory only; human-gated in the UI.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { apiFetch, setApiFn } from "../_shared/apiFetch.ts";
setApiFn("duty-check");

const CLAUDE_MODEL = "claude-sonnet-4-6";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const SYSTEM =
  "You are a New Zealand customs classification assistant for a freight forwarder. " +
  "Given a commodity description, its value and country of origin, determine the most likely " +
  "NZ Tariff (HS) code and the duty treatment for IMPORT INTO NEW ZEALAND.\n\n" +
  "Rules:\n" +
  "- The HS code and its description should be your best classification (8-digit NZ tariff if possible, else 6-digit HS).\n" +
  "- duty_rate_pct is the INDICATIVE normal-tariff ad valorem duty rate for that code (a number, e.g. 5 for 5%). Many goods are Free (0). Consider NZ's FTAs with the origin country where clearly applicable, but treat duty as indicative only.\n" +
  "- gst_rate_pct is always 15 (NZ GST).\n" +
  "- confidence is 'high' | 'medium' | 'low' for the HS classification.\n" +
  "- Never invent a precise legal ruling. If unsure of the code, give your best 6-digit HS and set confidence 'low'.\n" +
  "Return ONLY valid JSON, no markdown, no preamble, matching exactly:\n" +
  '{"hs_code": "", "hs_description": "", "duty_rate_pct": 0, "gst_rate_pct": 15, "confidence": "low", "notes": ""}';

function parseJson(text: string): Record<string, unknown> {
  const t = text.trim();
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return JSON.parse(fenced ? fenced[1].trim() : t);
}

function num(v: unknown): number { const n = Number(v); return Number.isFinite(n) ? n : 0; }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "missing ANTHROPIC_API_KEY" }, 500);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }

  const commodity = String(body.commodity ?? "").trim();
  const originCountry = String(body.originCountry ?? "").trim();
  const value = num(body.value);
  const currency = String(body.currency ?? "NZD").trim() || "NZD";
  if (!commodity) return json({ error: "commodity is required" }, 400);

  const userMsg =
    `Commodity: ${commodity}\n` +
    `Country of origin: ${originCountry || "(unspecified)"}\n` +
    `Customs value: ${value} ${currency}\n` +
    `Destination: New Zealand (import).\n` +
    `Classify and give indicative duty + GST as instructed.`;

  let res: Response;
  try {
    res = await apiFetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 1024, system: SYSTEM, messages: [{ role: "user", content: userMsg }] }),
    });
  } catch (e) {
    return json({ error: `Claude request failed: ${e instanceof Error ? e.message : String(e)}` }, 502);
  }
  if (!res.ok) return json({ error: `Claude API ${res.status}: ${await res.text()}` }, 502);

  let parsed: Record<string, unknown>;
  try {
    const data = await res.json();
    const block = data.content?.find((c: { type: string }) => c.type === "text");
    if (!block?.text) throw new Error("no text block");
    parsed = parseJson(block.text as string);
  } catch (e) {
    return json({ error: `Could not parse Claude response: ${e instanceof Error ? e.message : String(e)}` }, 502);
  }

  const dutyRate = num(parsed.duty_rate_pct);
  const gstRate = num(parsed.gst_rate_pct) || 15;
  const estDuty = Math.round(value * dutyRate) / 100 * 100 / 100; // value * rate%
  const duty = Math.round(value * (dutyRate / 100) * 100) / 100;
  const gstBase = value + duty;
  const gst = Math.round(gstBase * (gstRate / 100) * 100) / 100;

  return json({
    commodity,
    originCountry: originCountry || null,
    value,
    currency,
    hsCode: String(parsed.hs_code ?? ""),
    hsDescription: String(parsed.hs_description ?? ""),
    dutyRatePct: dutyRate,
    gstRatePct: gstRate,
    estimatedDuty: duty,
    estimatedGst: gst,
    confidence: String(parsed.confidence ?? "low"),
    notes: String(parsed.notes ?? ""),
    disclaimer: "Indicative only — HS code and GST are guidance; verify duty against the NZ Working Tariff / a customs broker before relying on it.",
  });
});
