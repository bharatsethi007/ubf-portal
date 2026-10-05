// STAFF (verify_jwt). DHL Express MyDHL API POST /rates -> international courier rates.
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import { apiFetch, setApiFn } from "../_shared/apiFetch.ts";
setApiFn("courier-dhl-quote");

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" }
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } })
const r2 = (n) => Math.round(n * 100) / 100

function plannedDate() {
  const d = new Date(); d.setUTCDate(d.getUTCDate() + 3)
  const day = d.getUTCDay(); if (day === 6) d.setUTCDate(d.getUTCDate() + 2); else if (day === 0) d.setUTCDate(d.getUTCDate() + 1)
  const y = d.getUTCFullYear(), m = String(d.getUTCMonth() + 1).padStart(2, "0"), dd = String(d.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${dd}T12:00:00 GMT+00:00`
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
  try {
    const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY")
    const userClient = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } })
    const { data: ures } = await userClient.auth.getUser(); if (!ures?.user) return json({ ok: false, reason: "unauthorized" }, 401)
    const { data: staff } = await userClient.from("staff_users").select("user_id").eq("user_id", ures.user.id).maybeSingle(); if (!staff) return json({ ok: false, reason: "forbidden" }, 403)

    const user = Deno.env.get("DHL_API_USER"), secret = Deno.env.get("DHL_API_SECRET"), account = Deno.env.get("DHL_ACCOUNT"), base = Deno.env.get("DHL_BASE_URL") || "https://express.api.dhl.com/mydhlapi/test"
    if (!user || !secret) return json({ ok: false, reason: "missing_secret: DHL_API_USER/DHL_API_SECRET" })

    const body = await req.json().catch(() => ({}))
    const o = body?.origin ?? {}, d = body?.destination ?? {}
    const oc = String(o?.countryCode || "").toUpperCase(), dc = String(d?.countryCode || "").toUpperCase()
    console.log("dhl inputs", JSON.stringify({ origin: o, destination: d, isDocuments: body?.isDocuments, pieces: body?.pieces, account_set: !!account }))
    if (!oc || !dc) return json({ ok: false, reason: "origin/destination countryCode required", detail: `origin='${oc}' dest='${dc}' - address not selected from the dropdown` })
    if (!o?.postcode && !o?.city) return json({ ok: false, reason: "origin postcode/city required" })
    if (!d?.postcode && !d?.city) return json({ ok: false, reason: "destination postcode/city required" })

    const rawPieces = Array.isArray(body?.pieces) ? body.pieces : []
    const packages = []
    for (const p of rawPieces) {
      const qty = Math.max(1, parseInt(String(p?.qty ?? 1), 10) || 1)
      const weight = Math.max(0.1, Number(p?.weightKg) || 0.1)
      const length = Math.max(1, Number(p?.lengthCm) || 1), width = Math.max(1, Number(p?.widthCm) || 1), height = Math.max(1, Number(p?.heightCm) || 1)
      for (let i = 0; i < qty; i++) packages.push({ weight: r2(weight), dimensions: { length, width, height } })
    }
    if (packages.length === 0) return json({ ok: false, reason: "at least one piece required" })

    const payload = {
      customerDetails: {
        shipperDetails: { postalCode: String(o?.postcode || ""), cityName: String(o?.city || ""), countryCode: oc },
        receiverDetails: { postalCode: String(d?.postcode || ""), cityName: String(d?.city || ""), countryCode: dc }
      },
      accounts: account ? [{ typeCode: "shipper", number: String(account) }] : undefined,
      plannedShippingDateAndTime: plannedDate(),
      unitOfMeasurement: "metric",
      isCustomsDeclarable: !body?.isDocuments,
      returnStandardProductsOnly: false,
      nextBusinessDay: false,
      packages
    }

    const auth = "Basic " + btoa(`${user}:${secret}`)
    const res = await apiFetch(`${base}/rates`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: auth, "Message-Reference": crypto.randomUUID() }, body: JSON.stringify(payload) })
    const text = await res.text()
    if (!res.ok) { console.error("dhl rates FAIL", res.status, text.slice(0, 500)); let dj; try { dj = JSON.parse(text) } catch { dj = null }; return json({ ok: false, reason: `dhl_${res.status}`, detail: dj?.detail || dj?.message || (Array.isArray(dj?.additionalDetails) ? dj.additionalDetails.join("; ") : null) || text.slice(0, 200) }) }
    let data; try { data = JSON.parse(text) } catch { return json({ ok: false, reason: "dhl_parse" }) }

    const products = Array.isArray(data?.products) ? data.products : []
    const options = products.map((pr) => {
      const prices = Array.isArray(pr?.totalPrice) ? pr.totalPrice : []
      const bill = prices.find((x) => x?.currencyType === "BILLC") || prices[0] || {}
      const eta = pr?.deliveryCapabilities?.estimatedDeliveryDateAndTime || null
      return { carrier: "DHL", service: String(pr?.productName || pr?.productCode || "DHL Express"), code: String(pr?.productCode || ""), charge: Number(bill?.price) || 0, currency: String(bill?.priceCurrency || "NZD"), eta }
    }).filter((x) => x.charge > 0).sort((a, b) => a.charge - b.charge)

    if (options.length === 0) return json({ ok: false, reason: "no_rate", detail: `DHL returned ${products.length} product(s) but no priced option` })
    return json({ ok: true, best: options[0], options: options.slice(0, 12), currency: options[0].currency })
  } catch (e) { console.error("dhl exception", String(e)); return json({ ok: false, reason: String(e) }, 500) }
})
