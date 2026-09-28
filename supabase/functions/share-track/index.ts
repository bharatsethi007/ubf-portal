// PUBLIC — customer tracking link. Auth is the unguessable token, not a JWT (verify_jwt = false).
// GET/POST { token } -> customer-safe tracking payload. Stale data refreshes in the background.
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import { buildPayload } from "./payload.ts"
import { refreshIfStale } from "./refresh.ts"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
}
const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json", ...extra } })

const TOKEN_RE = /^[A-Za-z0-9_-]{24,64}$/

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
  try {
    const url = new URL(req.url)
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {}
    const token = String(body?.token ?? url.searchParams.get("token") ?? "").trim()
    if (!TOKEN_RE.test(token)) return json({ error: "not_found" }, 404)

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
    const { data: link } = await db.from("booking_share_links")
      .select("id,booking_id,expires_at,revoked_at,view_count,base_route").eq("token", token).maybeSingle()
    if (!link) return json({ error: "not_found" }, 404)
    if (link.revoked_at) return json({ error: "revoked" }, 410)
    if (new Date(link.expires_at).getTime() < Date.now()) return json({ error: "expired" }, 410)

    const payload = await buildPayload(db, link)

    // Count real opens only (the page polls with ?poll=1).
    const bg: Promise<unknown>[] = []
    if (!body?.poll && url.searchParams.get("poll") !== "1") {
      bg.push(db.from("booking_share_links").update({ view_count: (link.view_count ?? 0) + 1, last_viewed_at: new Date().toISOString() }).eq("id", link.id))
    }
    bg.push(refreshIfStale(db, link.id, link.booking_id, payload.status, payload.eta.actual ?? payload.eta.predicted))
    // @ts-ignore EdgeRuntime is provided by Supabase
    EdgeRuntime.waitUntil(Promise.allSettled(bg))

    return json(payload, 200, { "cache-control": "no-store" })
  } catch (e) {
    console.error(e)
    return json({ error: "server_error" }, 500)
  }
})
