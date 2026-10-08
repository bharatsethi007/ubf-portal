// STAFF (verify_jwt). Bascik vendor cartage quote (LTL). Extracts the NZ main city from any address string.
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import { apiFetch, setApiFn } from "../_shared/apiFetch.ts";
setApiFn("cartage-bascik-quote");
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" }
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } })
const HOSTS = { prod: { auth: "https://api.bascik.co.nz/fmeauthserver/connect/token", api: "https://api.bascik.co.nz/fmewebapi" }, test: { auth: "https://apitest.bascik.co.nz/fmeauthserver/connect/token", api: "https://apitest.bascik.co.nz/fmewebapi" } }
const num = (s) => { if (s == null) return 0; const n = parseFloat(String(s).replace(/[^0-9.\-]/g, "")); return isNaN(n) ? 0 : n }

const NZ_CITIES = ["Auckland", "Wellington", "Christchurch", "Hamilton", "Tauranga", "Dunedin", "Palmerston North", "Napier", "Hastings", "Nelson", "Rotorua", "New Plymouth", "Whangarei", "Invercargill", "Whanganui", "Gisborne", "Queenstown", "Timaru", "Blenheim", "Masterton", "Levin", "Ashburton", "Oamaru", "Taupo", "Cambridge", "Feilding", "Pukekohe", "Paraparaumu", "Porirua", "Upper Hutt", "Lower Hutt"]
function townVariants(raw) {
  const t = String(raw || "").trim(); if (!t) return []
  const low = t.toLowerCase(); const out = []
  // A known city in the text is what Bascik rates on. Use it alone: other spellings just 400.
  for (const c of NZ_CITIES) { if (low.includes(c.toLowerCase())) return [c] }
  if (t.includes(",")) { const parts = t.split(",").map((x) => x.trim()).filter(Boolean); const seg = parts.length >= 2 ? parts[parts.length - 2] : parts[0]; if (seg && !out.includes(seg)) out.push(seg.replace(/\s+\d{3,4}$/, "").trim()) }
  const stripped = t.replace(/\s+\d{3,4}$/, "").replace(/\s+(central business district|central city|cbd|central|city)$/i, "").trim(); if (stripped && !out.includes(stripped)) out.push(stripped)
  const fw = t.split(/[\s,]+/)[0]; if (fw && !out.includes(fw)) out.push(fw)
  return out.filter(Boolean)
}

// Warm-instance caches: one login per token life, and repeat searches answered without calling Bascik.
const tokenCache = new Map() // env -> { token, exp }
const resultCache = new Map() // key -> { at, body }
const RESULT_TTL = 10 * 60 * 1000
async function getToken(H, envKey, clientId, clientSecret, bUser, bPass) {
  const c = tokenCache.get(envKey)
  if (c && c.exp > Date.now() + 60_000) return c.token
  const tokRes = await apiFetch(H.auth, { method: "POST", headers: { "Authorization": "Basic " + btoa(`${clientId}:${clientSecret}`), "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" }, body: new URLSearchParams({ grant_type: "password", username: bUser, password: bPass, scope: "openid" }) })
  const at = await tokRes.text(); if (!tokRes.ok) throw new Error(`auth_${tokRes.status}`)
  const j = JSON.parse(at); if (!j?.access_token) throw new Error("auth_no_token")
  tokenCache.set(envKey, { token: j.access_token, exp: Date.now() + (Number(j.expires_in) || 3600) * 1000 })
  return j.access_token
}

async function priceenquiry(api, token, account, from, to, pieces, weight, volume) {
  const q = new URLSearchParams({ accountId: account, fromSuburbName: from, toSuburbName: to, numberPieces: String(pieces) })
  if (weight > 0) q.set("weight", String(weight)); if (volume > 0) q.set("volume", String(volume))
  const pe = await apiFetch(`${api}/priceenquiry?${q.toString()}`, { headers: { "Authorization": `Bearer ${token}`, "Accept": "application/json" } })
  const pt = await pe.text(); if (!pe.ok) return []
  let arr; try { arr = JSON.parse(pt) } catch { return [] }
  return Array.isArray(arr) ? arr : []
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
  try {
    const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY")
    const uc = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } })
    const { data: ures } = await uc.auth.getUser(); if (!ures?.user) return json({ ok: false, reason: "unauthorized" }, 401)
    const { data: staff } = await uc.from("staff_users").select("user_id").eq("user_id", ures.user.id).maybeSingle(); if (!staff) return json({ ok: false, reason: "forbidden" }, 403)
    const clientId = Deno.env.get("BASCIK_CLIENT_ID"), clientSecret = Deno.env.get("BASCIK_CLIENT_SECRET"), bUser = Deno.env.get("BASCIK_USER"), bPass = Deno.env.get("BASCIK_PASS"), account = Deno.env.get("BASCIK_ACCOUNT") || "ub"
    if (!clientId || !clientSecret || !bUser || !bPass) return json({ ok: false, reason: "missing_secrets" }, 500)
    const body = await req.json().catch(() => ({}))
    const rawFrom = String(body?.from_suburb ?? "").trim(), rawTo = String(body?.to_suburb ?? "").trim()
    if (!rawFrom || !rawTo) return json({ ok: false, reason: "from/to required" }, 400)
    const pieces = Math.max(1, parseInt(String(body?.pieces ?? "1"), 10) || 1)
    const weight = body?.weight_kg != null ? Number(body.weight_kg) : 0, volume = body?.volume_m3 != null ? Number(body.volume_m3) : 0
    const envKey = body?.env === "test" ? "test" : "prod"
    const H = HOSTS[envKey]
    const froms = townVariants(rawFrom), tos = townVariants(rawTo)
    const ck = JSON.stringify([envKey, froms, tos, pieces, weight, volume])
    const hit = resultCache.get(ck)
    if (hit && Date.now() - hit.at < RESULT_TTL) return json({ ...hit.body, cached: true })
    let token
    try { token = await getToken(H, envKey, clientId, clientSecret, bUser, bPass) } catch (e) { console.error("bascik auth", String(e)); return json({ ok: false, reason: String(e.message ?? e) }, 502) }
    let rows = [], usedFrom = froms[0] ?? rawFrom, usedTo = tos[0] ?? rawTo
    outer: for (const f of froms) { for (const t of tos) { const rr = await priceenquiry(H.api, token, account, f, t, pieces, weight, volume); if (rr.length > 0) { rows = rr; usedFrom = f; usedTo = t; break outer } } }
    const options = rows.map((r) => ({ service: String(r?.serviceLevelDesc ?? r?.productAbbrev ?? ""), cost: num(r?.cost) })).filter((o) => o.cost > 0).sort((a, b) => a.cost - b.cost)
    const out = options.length === 0
      ? { ok: false, reason: "not_ratable", triedFrom: froms, triedTo: tos }
      : { ok: true, best: options[0], options, from: usedFrom, to: usedTo, currency: "NZD" }
    resultCache.set(ck, { at: Date.now(), body: out })
    if (resultCache.size > 300) resultCache.delete(resultCache.keys().next().value)
    return json(out)
  } catch (e) { console.error("bascik exception", String(e)); return json({ ok: false, reason: String(e) }, 500) }
})
