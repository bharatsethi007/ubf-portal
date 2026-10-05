// STAFF (verify_jwt). GoSweetSpot /api/rates -> courier cartage rates (all carriers).
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import { apiFetch, setApiFn } from "../_shared/apiFetch.ts";
setApiFn("cartage-gss-quote");

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" }
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } })
const r2 = (n) => Math.round(n * 100) / 100

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
  try {
    const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY")
    const userClient = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } })
    const { data: ures } = await userClient.auth.getUser(); if (!ures?.user) return json({ ok: false, reason: "unauthorized" }, 401)
    const { data: staff } = await userClient.from("staff_users").select("user_id").eq("user_id", ures.user.id).maybeSingle(); if (!staff) return json({ ok: false, reason: "forbidden" }, 403)
    const accessKey = Deno.env.get("GSS_ACCESS_KEY"), siteId = Deno.env.get("GSS_SITE_ID") || "", supportEmail = Deno.env.get("GSS_SUPPORT_EMAIL") || "developer@ubfreight.com", base = Deno.env.get("GSS_BASE_URL") || "https://api.gosweetspot.com"
    if (!accessKey) return json({ ok: false, reason: "missing_secret: GSS_ACCESS_KEY" }, 500)
    const body = await req.json().catch(() => ({}))
    const dest = body?.destination ?? {}, origin = body?.origin ?? null
    if (!dest?.city && !dest?.suburb) return json({ ok: false, reason: "destination city/suburb required" }, 400)
    const p = Math.max(1, parseInt(String(body?.pieces ?? "1"), 10) || 1)
    const perKg = Math.max(0.1, r2((Number(body?.weight_kg) || 0) / p || 0.1))
    const perVol = (Number(body?.volume_m3) || 0) / p
    const side = perVol > 0 ? Math.max(1, Math.round(Math.cbrt(perVol) * 100)) : 10
    const Packages = Array.from({ length: p }, () => ({ Height: side, Length: side, Width: side, Kg: perKg, Name: "Item", Type: "Box", HasDG: false }))
    const addr = (a) => { const suburb = a?.suburb || a?.city || ""; const city = a?.city || a?.suburb || ""; return { BuildingName: "", StreetAddress: a?.street || suburb || city || "Address", Suburb: suburb, City: city, PostCode: a?.postcode || "", CountryCode: "NZ" } }
    const payload = { DeliveryReference: String(body?.reference || "QUOTE").slice(0, 60), ...(origin && (origin.city || origin.suburb) ? { Origin: { Name: "Origin", Address: addr(origin) } } : {}), Destination: { Name: "Delivery", Address: addr(dest), ContactPerson: "Quote", PhoneNumber: "000", Email: "", DeliveryInstructions: "" }, IsSaturdayDelivery: false, IsSignatureRequired: false, Packages }
    const headers = { "Content-Type": "application/json", "access_key": accessKey, "support_email": supportEmail }
    if (siteId) headers["site_id"] = siteId
    const res = await apiFetch(`${base}/api/rates`, { method: "POST", headers, body: JSON.stringify(payload) })
    const text = await res.text()
    if (!res.ok) { console.error("gss rates", res.status, text.slice(0, 200)); return json({ ok: false, reason: `gss_${res.status}` }, 502) }
    let data; try { data = JSON.parse(text) } catch { return json({ ok: false, reason: "gss_parse" }, 502) }
    const avail = Array.isArray(data?.Available) ? data.Available : []
    let options = avail.map((a) => ({ carrier: String(a?.CarrierName ?? ""), service: String(a?.DeliveryType ?? ""), cost: Number(a?.Cost) || 0, charge: Number(a?.Charge) || 0, rural: !!a?.IsRuralDelivery, quoteId: a?.QuoteId ?? null }))
    const filter = Array.isArray(body?.carriers) ? body.carriers.map((c) => String(c).toLowerCase()) : null
    if (filter && filter.length) options = options.filter((o) => filter.some((f) => o.carrier.toLowerCase().includes(f)))
    options = options.filter((o) => (o.charge || o.cost) > 0).sort((a, b) => (a.charge || a.cost) - (b.charge || b.cost))
    if (options.length === 0) return json({ ok: false, reason: "no_rate" })
    return json({ ok: true, best: options[0], options: options.slice(0, 12), currency: "NZD" })
  } catch (e) { console.error("gss exception", String(e)); return json({ ok: false, reason: String(e) }, 500) }
})
