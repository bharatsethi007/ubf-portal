// STAFF (verify_jwt=true). Extracts structured fields from a business-card image via Claude vision.
// Body: { image: { media_type: string, data_base64: string } }
// Returns: { card: {...}, suggested_agent_match: {id,name}|null, model }. Does NOT write anything.
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import { apiFetch, setApiFn } from "../_shared/apiFetch.ts";
setApiFn("business-card-ocr");

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

function normalize(s: string): string {
  return s.toLowerCase().replace(/\b(co|ltd|llc|inc|limited|pvt|company|logistics|shipping|freight|forwarding|international|intl)\b/g, "").replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim()
}

const SYSTEM_PROMPT = `You read a business card image and extract structured contact details.
Return ONLY JSON, no prose, no markdown fences:
{
  "person_name": "or null",
  "title": "job title or null",
  "company": "company name or null",
  "email": "or null",
  "phone": "primary phone or null",
  "mobile": "mobile/cell or null",
  "website": "or null",
  "address": "or null",
  "country": "country if determinable or null"
}
Be faithful to what is printed. If a field is not present, use null. Do not invent details.`

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
    const image = body?.image as { media_type: string; data_base64: string } | undefined
    if (!image?.data_base64) return json({ error: "image required" }, 400)

    const res = await apiFetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: CLAUDE_MODEL, max_tokens: 1024, system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: [
          { type: "image", source: { type: "base64", media_type: image.media_type, data: image.data_base64 } },
          { type: "text", text: "Extract the business card fields as JSON." },
        ] }],
      }),
    })
    if (!res.ok) return json({ error: `Claude API ${res.status}: ${await res.text()}` }, 502)
    const out = await res.json()
    const block = out.content?.find((c: { type: string }) => c.type === "text")
    if (!block?.text) return json({ error: "Claude response missing text" }, 502)

    let card: Record<string, string | null>
    try { card = parseJsonPayload(block.text as string) as Record<string, string | null> }
    catch { return json({ error: "Could not parse card JSON" }, 502) }

    // Try to match the company to an existing agent (deterministic normalize compare).
    let match: { id: string; name: string } | null = null
    if (card.company) {
      const target = normalize(card.company)
      const db = createClient(url, service)
      const { data: agents } = await db.from("agents").select("id, name").limit(2000)
      for (const a of agents ?? []) {
        const n = normalize(a.name)
        if (n && (n === target || n.includes(target) || target.includes(n))) { match = { id: a.id, name: a.name }; break }
      }
    }

    return json({ card, suggested_agent_match: match, model: CLAUDE_MODEL })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
