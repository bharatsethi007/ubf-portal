// Consol tracking. verify_jwt = false: two callers.
//   PUBLIC  { token: "c_..." }            -> customer-safe tracker payload for an ERP consol (portal + tracking.ubfreight.com)
//   SERVICE { mode: "refresh", consol? }  -> SeaVantage refresh for eligible consols (cron every 3h)
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import { readSeaVantageCreds } from "../seavantage-refresh/seaVantageClient.ts"
import { buildConsolPayload } from "./payload.ts"
import { runConsolRefresh } from "./refreshRun.ts"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
}
const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json", ...extra } })

const TOKEN_RE = /^c_[A-Za-z0-9_-]{24,64}$/

function jwtRole(auth: string | null): string | null {
  try {
    const tok = (auth ?? "").replace(/^Bearer\s+/i, "")
    return JSON.parse(atob(tok.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).role ?? null
  } catch { return null }
}

// Legacy service_role JWT (signature checked by the probe), or a new sb_secret_ key.
async function isServiceCaller(auth: string | null): Promise<boolean> {
  const tok = (auth ?? "").replace(/^Bearer\s+/i, "")
  if (!tok || (jwtRole(auth) !== "service_role" && !tok.startsWith("sb_secret_"))) return false
  const probe = createClient(Deno.env.get("SUPABASE_URL")!, tok, { auth: { persistSession: false } })
  const { error } = await probe.rpc("consol_track_candidates", { p_limit: 0 })
  return !error
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
  try {
    const url = new URL(req.url)
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {}
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)

    if (body?.mode === "refresh") {
      if (!(await isServiceCaller(req.headers.get("Authorization")))) return json({ error: "forbidden" }, 403)
      const creds = readSeaVantageCreds()
      if (!creds) return json({ error: "SEAVANTAGE_USERNAME / SEAVANTAGE_PASSWORD not configured" }, 500)
      const maxNew = Number(Deno.env.get("CONSOL_SV_MAX_NEW_PER_RUN") ?? 30)
      const summary = await runConsolRefresh(db, creds, {
        limit: Math.min(Number(body?.limit ?? 40), 80),
        maxNew: Math.min(Number(body?.max_new ?? maxNew), maxNew),
        consol: typeof body?.consol === "string" ? body.consol : null,
      })
      console.log("consol refresh", JSON.stringify(summary))
      return json(summary)
    }

    const token = String(body?.token ?? url.searchParams.get("token") ?? "").trim()
    if (!TOKEN_RE.test(token)) return json({ error: "not_found" }, 404)
    const { data: link } = await db.from("consol_share_links")
      .select("id,consol_key,expires_at,revoked_at,view_count,base_route").eq("token", token).maybeSingle()
    if (!link) return json({ error: "not_found" }, 404)
    if (link.revoked_at) return json({ error: "revoked" }, 410)
    if (new Date(link.expires_at).getTime() < Date.now()) return json({ error: "expired" }, 410)

    const payload = await buildConsolPayload(db, link)
    if (!body?.poll && url.searchParams.get("poll") !== "1") {
      // @ts-ignore EdgeRuntime is provided by Supabase
      EdgeRuntime.waitUntil(db.from("consol_share_links").update({ view_count: (link.view_count ?? 0) + 1, last_viewed_at: new Date().toISOString() }).eq("id", link.id))
    }
    return json(payload, 200, { "cache-control": "no-store" })
  } catch (e) {
    console.error(e)
    return json({ error: "server_error" }, 500)
  }
})
