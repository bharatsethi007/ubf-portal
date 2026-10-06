// inbox-suggest — drafts 3 short reply options for a staff inbox conversation.
// verify_jwt=true. Reads the thread via inbox_get as the calling user (is_staff gated by the RPC).
// Draft only: staff edits and sends. Never sends, never changes data.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { apiFetch, setApiFn } from "../_shared/apiFetch.ts";
setApiFn("inbox-suggest");

const CLAUDE_MODEL = "claude-sonnet-4-6";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "content-type": "application/json" } });

const SYSTEM = `You draft replies for staff at UB Freight, an Auckland freight forwarder (NZ, Australia, Fiji, Pacific).
Write like a helpful ops coordinator on WhatsApp or a customer portal: short, plain NZ English, friendly, no corporate fluff, no emojis, no em dashes.
Use only facts given in the context. Never invent dates, prices, vessel names or promises. If a fact is missing, say the team will confirm.
Return JSON only: {"replies":[{"label":"2-3 word label","text":"reply"}, ...]} with exactly 3 different options
(for example: direct answer, ask a clarifying question, holding reply). Each reply under 60 words.`;

type Msg = { kind: string; direction: string | null; sender_name: string | null; body: string | null; channel: string; created_at: string };
type Ship = { booking_ref: string | null; origin: string | null; destination: string | null; stage: string | null;
  next_action: string | null; eta: string | null; last_free_day: string | null; focus: boolean };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "Missing ANTHROPIC_API_KEY" }, 500);

  const auth = req.headers.get("Authorization") ?? "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });

  let body: { conversation_id?: string };
  try { body = await req.json(); } catch { body = {}; }
  if (!body.conversation_id) return json({ error: "conversation_id required" }, 400);

  const { data, error } = await sb.rpc("inbox_get", { p_id: body.conversation_id });
  if (error) return json({ error: error.message }, 403);
  const d = data as { account: { name: string } | null; contact: { display_name: string | null; contact_type: string | null } | null;
    messages: Msg[]; shipments: Ship[] };

  const thread = d.messages.filter((m) => m.kind !== "event").slice(-20).map((m) => {
    const who = m.kind === "note" ? `[internal note by ${m.sender_name ?? "staff"}]`
      : m.direction === "in" ? (m.sender_name ?? "Customer") : `UBF (${m.sender_name ?? "staff"})`;
    return `${m.created_at.slice(0, 16)} ${who} via ${m.channel}: ${m.body ?? "[attachment]"}`;
  }).join("\n");
  const ships = d.shipments.map((s) =>
    `${s.booking_ref}${s.focus ? " (this thread)" : ""}: ${s.origin ?? "?"} to ${s.destination ?? "?"}, stage ${s.stage ?? "?"}` +
    `${s.eta ? `, ETA ${s.eta}` : ""}${s.last_free_day ? `, last free day ${s.last_free_day}` : ""}` +
    `${s.next_action ? `, our next step: ${s.next_action}` : ""}`).join("\n");
  const ctx = `Customer account: ${d.account?.name ?? "none (unknown or not a customer)"}
Contact: ${d.contact?.display_name ?? "unknown"}${d.contact?.contact_type ? ` (${d.contact.contact_type})` : ""}
Today: ${new Date().toISOString().slice(0, 10)}
Open shipments:
${ships || "none"}

Conversation (oldest first):
${thread}

Draft 3 replies to the latest customer message. Internal notes are context only, never quote them.`;

  const res = await apiFetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 800, system: SYSTEM, messages: [{ role: "user", content: ctx }] }),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) return json({ error: out?.error?.message ?? "AI call failed" }, 502);
  const text: string = (out?.content ?? []).map((c: { text?: string }) => c.text ?? "").join("");
  const m = text.match(/\{[\s\S]*\}/);
  try {
    const parsed = JSON.parse(m ? m[0] : text) as { replies?: { label: string; text: string }[] };
    const replies = (parsed.replies ?? []).filter((r) => r?.text).slice(0, 3)
      .map((r) => ({ label: String(r.label ?? "Option").slice(0, 30), text: String(r.text).replace(/—/g, ",").trim() }));
    return json({ replies });
  } catch {
    return json({ error: "Could not read AI reply" }, 502);
  }
});
