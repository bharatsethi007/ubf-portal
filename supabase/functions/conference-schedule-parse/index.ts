// STAFF (verify_jwt=true). Parses an uploaded conference schedule (spreadsheet rows OR image)
// into structured meeting drafts via Claude. Matches agent names against existing agents.
// Body: { conference_id: uuid, days: string[], default_minutes: number,
//         sheet?: string[][], image?: { media_type: string, data_base64: string } }
// Returns: { meetings: [...], model, count }. Does NOT write meetings.
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import { apiFetch, setApiFn } from "../_shared/apiFetch.ts";
setApiFn("conference-schedule-parse");

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

const SYSTEM_PROMPT = `You extract a freight-conference meeting schedule into structured JSON.
Conferences (WCA/WFN/etc.) run back-to-back meetings across several days. Each meeting has a time slot and a counterparty company (an overseas freight agent), sometimes a contact person.

You are given: the list of valid day dates for the conference, a default meeting length in minutes, a candidate list of known agents (id + name + country), and either spreadsheet rows or an image of the schedule.

Return ONLY JSON, no prose, no markdown fences:
{
  "meetings": [
    {
      "meeting_date": "YYYY-MM-DD",   // MUST be one of the provided day dates; pick the best match
      "start_time": "HH:MM",           // 24h
      "end_time": "HH:MM",             // if absent, add default_minutes to start
      "agent_name_raw": "as written on the sheet",
      "matched_agent_id": "uuid or null",  // ONLY if confident it is the same company as a candidate; else null
      "contact_name": "person or null",
      "contact_email": "or null",
      "contact_phone": "or null",
      "confidence": "green|amber|red"   // green=clear row+known agent, amber=parsed but unmatched agent, red=uncertain time/date
    }
  ]
}

Rules:
- Only use dates from the provided day list. If the sheet groups by "Day 1/Day 2", map in order to the day dates.
- Match an agent only on clear company-name similarity (ignore Ltd/Co/LLC, punctuation, case). When unsure, matched_agent_id=null and confidence amber.
- If a time is missing or ambiguous, still emit the row with your best guess and confidence red.
- Never invent agents that are not on the sheet.`

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
    const conferenceId = body?.conference_id as string | undefined
    const days = body?.days as string[] | undefined
    const defaultMinutes = (body?.default_minutes as number | undefined) ?? 30
    const sheet = body?.sheet as string[][] | undefined
    const image = body?.image as { media_type: string; data_base64: string } | undefined
    if (!conferenceId) return json({ error: "conference_id required" }, 400)
    if (!Array.isArray(days) || days.length === 0) return json({ error: "days required" }, 400)
    if (!sheet && !image) return json({ error: "sheet or image required" }, 400)

    const db = createClient(url, service)
    // Candidate agents: cap to keep prompt bounded. Prefer agents already linked to this conference's network if any.
    const { data: agents } = await db.from("agents").select("id, name, country").order("name").limit(1500)

    const header = {
      day_dates: days,
      default_minutes: defaultMinutes,
      known_agents: (agents ?? []).map((a) => ({ id: a.id, name: a.name, country: a.country })),
    }

    const content: unknown[] = [
      { type: "text", text: "CONTEXT (JSON):\n" + JSON.stringify(header) },
    ]
    if (image) {
      content.push({ type: "image", source: { type: "base64", media_type: image.media_type, data: image.data_base64 } })
      content.push({ type: "text", text: "Extract the schedule from the image above." })
    } else {
      content.push({ type: "text", text: "SCHEDULE ROWS (JSON):\n" + JSON.stringify(sheet) })
    }

    const res = await apiFetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 16000, system: SYSTEM_PROMPT, messages: [{ role: "user", content }] }),
    })
    if (!res.ok) return json({ error: `Claude API ${res.status}: ${await res.text()}` }, 502)
    const out = await res.json()
    const block = out.content?.find((c: { type: string }) => c.type === "text")
    if (!block?.text) return json({ error: "Claude response missing text" }, 502)

    let parsed: { meetings?: unknown[] }
    try { parsed = parseJsonPayload(block.text as string) as { meetings?: unknown[] } }
    catch { return json({ error: "Could not parse model JSON (schedule may be too large — try one day at a time)." }, 502) }
    const meetings = Array.isArray(parsed?.meetings) ? parsed.meetings : []
    return json({ meetings, model: CLAUDE_MODEL, count: meetings.length })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
