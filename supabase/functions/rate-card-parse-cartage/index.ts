// STAFF (verify_jwt = true). Parses an uploaded cartage rate-card sheet into structured FCL lines + LTL lanes via Claude.
// Body: { rate_card_id: uuid, sheet: string[][] } -> { fcl_lines, ltl_lanes, model }. Does NOT write rates.
// Claude resolves zones/bands by CODE; this function maps code -> id server-side for reliability.
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

const worst = (a: string, b: string) => {
  const rank: Record<string, number> = { green: 0, amber: 1, red: 2 }
  return (rank[b] ?? 0) > (rank[a] ?? 0) ? b : a
}
const cleanConf = (c: unknown) => (c === "amber" || c === "red" ? c : "green")

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
      .from("rate_cards").select("currency_code, vendor_name, valid_from, valid_to")
      .eq("id", rateCardId).eq("rate_type", "cartage").single()
    if (cardErr || !card) return json({ error: "cartage rate card not found" }, 404)

    const { data: globalRule } = await db.from("rate_rules").select("content").eq("scope", "global").maybeSingle()
    const rulesText = globalRule?.content ?? ""

    const [{ data: zones }, { data: bands }, { data: aliases }] = await Promise.all([
      db.from("cartage_zones").select("id, zone_code, name, zone_type").eq("active", true).order("sort_order"),
      db.from("cartage_weight_bands").select("id, band_code, min_kg, max_kg").eq("active", true).order("sort_order"),
      db.from("cartage_aliases").select("raw, zone_id"),
    ])

    const zoneById = new Map((zones ?? []).map((z) => [z.id as string, z]))
    const zoneByCode = new Map((zones ?? []).map((z) => [String(z.zone_code).toLowerCase(), z]))
    const bandByCode = new Map((bands ?? []).map((b) => [String(b.band_code).toLowerCase(), b]))
    const aliasList = (aliases ?? [])
      .map((a) => ({ alias: String(a.raw), zone: zoneById.get(a.zone_id as string) }))
      .filter((a) => a.zone)
      .map((a) => ({ alias: a.alias, zone_code: String(a.zone!.zone_code) }))

    const userContent = buildUserContent({
      sheet,
      card,
      rulesText,
      zones: (zones ?? []).map((z) => ({ zone_code: z.zone_code, name: z.name, zone_type: z.zone_type })),
      bands: (bands ?? []).map((b) => ({ band_code: b.band_code, min_kg: Number(b.min_kg), max_kg: b.max_kg == null ? null : Number(b.max_kg) })),
      aliases: aliasList,
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

    let parsed: { fcl_lines?: unknown[]; ltl_lanes?: unknown[] }
    try { parsed = parseJsonPayload(block.text as string) as typeof parsed }
    catch { return json({ error: "Could not parse model JSON (sheet may be too large — try a smaller range)." }, 502) }

    const resolveZone = (code: unknown): { id: string; conf: string } => {
      const key = String(code ?? "").toLowerCase()
      if (!key) return { id: "", conf: "red" }
      const z = zoneByCode.get(key)
      return z ? { id: String(z.id), conf: "green" } : { id: "", conf: "red" }
    }

    const fcl_lines = (Array.isArray(parsed.fcl_lines) ? parsed.fcl_lines : []).map((raw) => {
      const l = raw as Record<string, unknown>
      const o = resolveZone(l.origin_zone_code)
      const d = resolveZone(l.dest_zone_code)
      let conf = cleanConf(l.confidence)
      conf = worst(worst(conf, o.conf), d.conf)
      const size = String(l.container_size ?? "")
      return {
        direction: l.direction === "import" ? "import" : "export",
        origin_zone_id: o.id,
        dest_zone_id: d.id,
        container_size: size === "20" || size === "40" ? size : "",
        base_rate: l.base_rate == null ? null : Number(l.base_rate),
        min_charge: l.min_charge == null ? null : Number(l.min_charge),
        confidence: conf,
        raw_origin: String(l.raw_origin ?? ""),
        raw_dest: String(l.raw_dest ?? ""),
        note: String(l.note ?? ""),
      }
    })

    const ltl_lanes = (Array.isArray(parsed.ltl_lanes) ? parsed.ltl_lanes : []).map((raw) => {
      const l = raw as Record<string, unknown>
      const o = resolveZone(l.origin_zone_code)
      const d = resolveZone(l.dest_zone_code)
      let conf = cleanConf(l.confidence)
      conf = worst(worst(conf, o.conf), d.conf)
      const band_rates: { band_id: string; per_kg: number }[] = []
      for (const brRaw of (Array.isArray(l.band_rates) ? l.band_rates : []) as Record<string, unknown>[]) {
        const b = bandByCode.get(String(brRaw.band_code ?? "").toLowerCase())
        if (b && brRaw.per_kg != null) band_rates.push({ band_id: String(b.id), per_kg: Number(brRaw.per_kg) })
        else conf = worst(conf, "amber")
      }
      return {
        direction: l.direction === "import" ? "import" : "export",
        origin_zone_id: o.id,
        dest_zone_id: d.id,
        min_charge: l.min_charge == null ? null : Number(l.min_charge),
        per_cbm: l.per_cbm == null ? null : Number(l.per_cbm),
        band_rates,
        confidence: conf,
        raw_origin: String(l.raw_origin ?? ""),
        raw_dest: String(l.raw_dest ?? ""),
        note: String(l.note ?? ""),
      }
    })

    return json({ fcl_lines, ltl_lanes, model: CLAUDE_MODEL, fcl_count: fcl_lines.length, ltl_count: ltl_lanes.length })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
