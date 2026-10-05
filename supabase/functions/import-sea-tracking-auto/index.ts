// CRON — Import Sea FCL tracking automation (service-role only).
//  {mode:"portconnect"}: daily PortConnect refresh until all containers gate out (or ETA + 10d, with alert).
//  {mode:"carrier"}:     2-hourly shipping line sync (Maersk API or SeaVantage) until empties return (or ETA + 17d).
// Stop rules + candidate selection live in SQL: public.import_sea_tracking_sweep(kind).
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2"
import { refreshBookingPortConnect } from "../_shared/portconnectRefreshRun.ts"
import { refreshBookingCarrier } from "../carrier-refresh/carrierRefreshRun.ts"
import { fetchMaerskToken, readMaerskCreds } from "../carrier-refresh/maerskClient.ts"
import { refreshBookingSeaVantage } from "../seavantage-refresh/seavantageRefreshRun.ts"
import { readSeaVantageCreds } from "../seavantage-refresh/seaVantageClient.ts"
import { apiFetch, setApiFn } from "../_shared/apiFetch.ts";
setApiFn("import-sea-tracking-auto");

const BUDGET_MS = 130_000
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } })

async function isServiceCaller(req: Request): Promise<boolean> {
  const tok = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim()
  if (!tok) return false
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (legacy && tok === legacy) return true
  if (!tok.startsWith("sb_secret_")) return false
  const probe = createClient(Deno.env.get("SUPABASE_URL")!, tok, { auth: { persistSession: false } })
  const { error } = await probe.auth.admin.listUsers({ page: 1, perPage: 1 })
  return !error
}

type Row = { booking_id: string; engine: string }
type Outcome = { booking_id: string; engine: string; ok: boolean; error?: string }

async function sweep(db: SupabaseClient, kind: string, limit: number): Promise<Row[]> {
  const { data, error } = await db.rpc("import_sea_tracking_sweep", { p_kind: kind, p_limit: limit })
  if (error) throw new Error(`sweep(${kind}): ${error.message}`)
  return (data ?? []) as Row[]
}

async function runPortConnect(db: SupabaseClient, rows: Row[], started: number): Promise<Outcome[]> {
  const apiKey = Deno.env.get("PORTCONNECT_API_KEY") ?? ""
  if (!apiKey) throw new Error("PORTCONNECT_API_KEY not configured")
  const out: Outcome[] = []
  for (const r of rows) {
    if (Date.now() - started > BUDGET_MS) break
    try {
      const s = await refreshBookingPortConnect(db, apiKey, r.booking_id)
      out.push({ booking_id: r.booking_id, engine: "portconnect", ok: s.ok, error: s.error })
      if (!s.ok && /\b(401|403|429)\b/.test(s.error ?? "")) break // auth or rate limit: stop, next run continues
    } catch (e) {
      out.push({ booking_id: r.booking_id, engine: "portconnect", ok: false, error: e instanceof Error ? e.message : String(e) })
    }
  }
  return out
}

async function runCarrier(db: SupabaseClient, rows: Row[], started: number): Promise<Outcome[]> {
  const maersk = readMaerskCreds()
  const sv = readSeaVantageCreds()
  let token: string | undefined
  if (maersk && rows.some((r) => r.engine === "carrier")) {
    try { token = await fetchMaerskToken(maersk) } catch { token = undefined }
  }
  const out: Outcome[] = []
  const queue = [...rows]
  const worker = async () => {
    while (queue.length && Date.now() - started < BUDGET_MS) {
      const r = queue.shift()!
      try {
        if (r.engine === "carrier" && maersk) {
          const s = await refreshBookingCarrier(db, maersk, r.booking_id, { token })
          out.push({ booking_id: r.booking_id, engine: "carrier", ok: s.ok, error: s.error })
        } else if (sv) {
          const s = await refreshBookingSeaVantage(db, sv, r.booking_id)
          out.push({ booking_id: r.booking_id, engine: "seavantage", ok: s.ok, error: s.error })
        } else {
          out.push({ booking_id: r.booking_id, engine: r.engine, ok: false, error: "credentials not configured" })
        }
      } catch (e) {
        out.push({ booking_id: r.booking_id, engine: r.engine, ok: false, error: e instanceof Error ? e.message : String(e) })
      }
    }
  }
  await Promise.all([worker(), worker(), worker()])
  return out
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405)
  if (!(await isServiceCaller(req))) return json({ error: "forbidden" }, 403)
  const started = Date.now()
  try {
    const body = await req.json().catch(() => ({}))
    const mode = body?.mode === "carrier" ? "carrier" : body?.mode === "portconnect" ? "portconnect" : null
    if (!mode) return json({ error: "mode must be portconnect or carrier" }, 400)
    const limit = Math.min(Math.max(Number(body?.limit) || 200, 1), 500)
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } })

    const due = await sweep(db, mode, limit)
    const results = mode === "portconnect" ? await runPortConnect(db, due, started) : await runCarrier(db, due, started)
    await sweep(db, mode, 0) // apply stop rules to what we just refreshed (e.g. gated out today)

    const failed = results.filter((r) => !r.ok)
    return json({
      mode, due: due.length, refreshed: results.length, ok: results.length - failed.length,
      deferred: due.length - results.length, errors: failed.slice(0, 20), ms: Date.now() - started,
    })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
