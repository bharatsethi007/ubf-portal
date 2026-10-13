// STAFF (verify_jwt = true). Parses one FCL rate sheet (or a chunk of one) via Claude.
// Body: { sheet: string[][], rate_card_id?: uuid, context?: { shipping_line_code, currency_code, valid_from, valid_to, sheet_name } }
//   -> { lines, surcharges, local_charges, model, count }. Does NOT write rates.
// lines carry base_rate (buy) AND sell_rate when the sheet has both, plus carrier for multi-carrier sheets.
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import { SYSTEM_PROMPT, buildUserContent } from "./prompt.ts"
import { resolveAll } from "./resolve.ts"
import { apiFetch, setApiFn } from "../_shared/apiFetch.ts";
setApiFn("rate-card-parse");

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

type Ctx = { shipping_line_code: string | null; currency_code: string | null; valid_from: string | null; valid_to: string | null; sheet_name?: string | null }

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
    const sheet = body?.sheet as string[][] | undefined
    if (!Array.isArray(sheet) || sheet.length === 0) return json({ error: "sheet rows required" }, 400)

    const db = createClient(url, service)
    let card: Ctx
    if (body?.rate_card_id) {
      const { data, error } = await db.from("rate_cards").select("currency_code, shipping_line_code, valid_from, valid_to").eq("id", body.rate_card_id).single()
      if (error || !data) return json({ error: "rate card not found" }, 404)
      card = { ...(data as Ctx), sheet_name: body?.context?.sheet_name ?? null }
    } else {
      const c = body?.context ?? {}
      card = { shipping_line_code: c.shipping_line_code ?? null, currency_code: c.currency_code ?? null, valid_from: c.valid_from ?? null, valid_to: c.valid_to ?? null, sheet_name: c.sheet_name ?? null }
    }

    const { data: globalRule } = await db.from("rate_rules").select("content").eq("scope", "global").maybeSingle()
    const { data: vendorRule } = card.shipping_line_code
      ? await db.from("rate_rules").select("content").eq("scope", "vendor").eq("vendor_kind", "shipping_line").eq("vendor_code", card.shipping_line_code).maybeSingle()
      : { data: null }
    const rulesText = [globalRule?.content, vendorRule?.content].filter(Boolean).join("\n\n")

    const [{ data: containers }, { data: carriers }, { data: ports }, { data: aliases }] = await Promise.all([
      db.from("container_types").select("code, label").eq("active", true).order("sort_order"),
      db.from("shipping_lines").select("code, name").order("sort_order"),
      // Core ports only in the prompt; resolve.ts validates every code against the full table afterwards.
      db.from("ports").select("code, name, country_code").eq("kind", "sea").eq("is_core", true).order("code"),
      db.from("port_aliases").select("alias, port_code"),
    ])

    const userContent = buildUserContent({
      sheet, card, rulesText, containers: containers ?? [], carriers: carriers ?? [], ports: ports ?? [], aliases: aliases ?? [],
    })

    const res = await apiFetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 32000, system: SYSTEM_PROMPT, messages: [{ role: "user", content: userContent }] }),
    })
    if (!res.ok) return json({ error: `Claude API ${res.status}: ${await res.text()}` }, 502)
    const out = await res.json()
    const block = out.content?.find((c: { type: string }) => c.type === "text")
    if (!block?.text) return json({ error: "Claude response missing text" }, 502)
    if (out.stop_reason === "max_tokens") return json({ error: "Sheet too large for one pass. Send fewer rows per chunk." }, 502)

    let parsed: unknown
    try { parsed = parseJsonPayload(block.text as string) }
    catch { return json({ error: "Could not parse model JSON (try a smaller row range)." }, 502) }
    const r = await resolveAll(db, parsed)
    return json({ ...r, model: CLAUDE_MODEL, count: r.lines.length })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
