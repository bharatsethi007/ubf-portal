// STAFF (verify_jwt = true). Parses an uploaded LCL tariff sheet into structured lane lines via Claude.
// Body: { rate_card_id: uuid, sheet: string[][] }  ->  { lines, model, count }. Does NOT write rates.
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import { SYSTEM_PROMPT, buildUserContent } from "./prompt.ts"

const CLAUDE_MODEL = "claude-sonnet-4-6"
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } })

function parseJsonPayload(text: string): unknown {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  return JSON.parse(fenced ? fenced[1].trim() : trimmed)
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
  try {
    const authHeader = req.headers.get("Authorization") ?? ""
    const url = Deno.env.get("SUPABASE_URL")!
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY")
    if (!apiKey) return json({ error: "Missing ANTHROPIC_API_KEY" }, 500)

    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } })
    const { data: ures } = await userClient.auth.getUser()
    if (!ures?.user) return json({ error: "unauthorized" }, 401)
    const { data: staff } = await userClient.from("staff_users").select("user_id").eq("user_id", ures.user.id).maybeSingle()
    if (!staff) return json({ error: "forbidden" }, 403)

    const body = await req.json()
    const rateCardId = body?.rate_card_id as string | undefined
    const sheet = body?.sheet as string[][] | undefined
    if (!rateCardId) return json({ error: "rate_card_id required" }, 400)
    if (!Array.isArray(sheet) || sheet.length === 0) return json({ error: "sheet rows required" }, 400)

    const db = createClient(url, service)
    const { data: card, error: cardErr } = await db
      .from("rate_cards").select("currency_code, co_loader_code, valid_from, valid_to")
      .eq("id", rateCardId).single()
    if (cardErr || !card) return json({ error: "rate card not found" }, 404)

    const { data: globalRule } = await db.from("rate_rules").select("content").eq("scope", "global").maybeSingle()
    const { data: vendorRule } = await db.from("rate_rules").select("content")
      .eq("scope", "vendor").eq("vendor_kind", "other").eq("vendor_code", card.co_loader_code).maybeSingle()
    const rulesText = [globalRule?.content, vendorRule?.content].filter(Boolean).join("\n\n")

    const { data: ports } = await db.from("ports").select("code, name, country_code").eq("kind", "sea").order("code")
    const { data: aliases } = await db.from("port_aliases").select("alias, port_code")

    const userContent = buildUserContent({
      sheet, card, rulesText, ports: ports ?? [], aliases: aliases ?? [],
    })

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 16000, system: SYSTEM_PROMPT, messages: [{ role: "user", content: userContent }] }),
    })
    if (!res.ok) return json({ error: `Claude API ${res.status}: ${await res.text()}` }, 502)
    const out = await res.json()
    const block = out.content?.find((c: { type: string }) => c.type === "text")
    if (!block?.text) return json({ error: "Claude response missing text" }, 502)

    let parsed: { lines?: unknown[] }
    try { parsed = parseJsonPayload(block.text as string) as { lines?: unknown[] } }
    catch { return json({ error: "Could not parse model JSON (sheet may be too large — try a smaller range)." }, 502) }
    const lines = Array.isArray(parsed?.lines) ? parsed.lines : []
    return json({ lines, model: CLAUDE_MODEL, count: lines.length })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
