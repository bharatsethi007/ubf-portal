// Maersk consol tracking. verify_jwt = false; service role only (cron every 3h, offset from consol-track).
// POST { consol? }  -> refresh one consol, or the next batch of live Maersk consols.
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import { readMaerskCreds } from "../carrier-refresh/maerskClient.ts"
import { runMaerskConsolRefresh } from "./maerskRun.ts"

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } })

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
  const { error } = await probe.rpc("consol_maersk_candidates", { p_limit: 0 })
  return !error
}

Deno.serve(async (req) => {
  try {
    if (!(await isServiceCaller(req.headers.get("Authorization")))) return json({ error: "forbidden" }, 403)
    const body = await req.json().catch(() => ({}))
    const creds = readMaerskCreds()
    if (!creds) return json({ error: "MAERSK_CONSUMER_KEY / MAERSK_CONSUMER_SECRET not configured" }, 500)
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
    const summary = await runMaerskConsolRefresh(db, creds, {
      limit: Math.min(Number(body?.limit ?? 60), 120),
      consol: typeof body?.consol === "string" ? body.consol : null,
    })
    console.log("maersk consol refresh", JSON.stringify(summary))
    return json(summary)
  } catch (e) {
    console.error(e)
    return json({ error: String(e) }, 500)
  }
})
