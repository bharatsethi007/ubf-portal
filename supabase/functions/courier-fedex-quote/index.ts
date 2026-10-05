// STAFF (verify_jwt). FedEx Rate API -> international courier rates. OAuth2 client_credentials.
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import { apiFetch, setApiFn } from "../_shared/apiFetch.ts";
setApiFn("courier-fedex-quote");

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

    const cid = Deno.env.get("FEDEX_CLIENT_ID"), csec = Deno.env.get("FEDEX_CLIENT_SECRET"), account = Deno.env.get("FEDEX_ACCOUNT"), base = Deno.env.get("FEDEX_BASE_URL") || "https://apis-sandbox.fedex.com"
    if (!cid || !csec) return json({ ok: false, reason: "missing_secret: FEDEX_CLIENT_ID/FEDEX_CLIENT_SECRET" })
    if (!account) return json({ ok: false, reason: "missing_secret: FEDEX_ACCOUNT" })

    const body = await req.json().catch(() => ({}))
    const o = body?.origin ?? {}, d = body?.destination ?? {}
    const oc = String(o?.countryCode || "").toUpperCase(), dc = String(d?.countryCode || "").toUpperCase()
    console.log("fedex inputs", JSON.stringify({ origin: o, destination: d, isDocuments: body?.isDocuments, pieces: body?.pieces }))
    if (!oc || !dc) return json({ ok: false, reason: "origin/destination countryCode required", detail: `origin='${oc}' dest='${dc}' - pick address from dropdown` })

    // OAuth2 token
    const tokRes = await apiFetch(`${base}/oauth/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "client_credentials", client_id: cid, client_secret: csec }) })
    const tokText = await tokRes.text()
    if (!tokRes.ok) { console.error("fedex token FAIL", tokRes.status, tokText.slice(0, 300)); return json({ ok: false, reason: `fedex_auth_${tokRes.status}`, detail: tokText.slice(0, 200) }) }
    const token = JSON.parse(tokText)?.access_token
    if (!token) return json({ ok: false, reason: "fedex_no_token" })

    const rawPieces = Array.isArray(body?.pieces) ? body.pieces : []
    const lineItems = []
    let gi = 0
    for (const p of rawPieces) {
      const qty = Math.max(1, parseInt(String(p?.qty ?? 1), 10) || 1)
      const weight = Math.max(0.1, Number(p?.weightKg) || 0.1)
      const length = Math.max(1, Math.round(Number(p?.lengthCm) || 1)), width = Math.max(1, Math.round(Number(p?.widthCm) || 1)), height = Math.max(1, Math.round(Number(p?.heightCm) || 1))
      for (let i = 0; i < qty; i++) { gi++; lineItems.push({ groupPackageCount: 1, weight: { units: "KG", value: r2(weight) }, dimensions: { length, width, height, units: "CM" } }) }
    }
    if (lineItems.length === 0) return json({ ok: false, reason: "at least one piece required" })

    const payload = {
      accountNumber: { value: String(account) },
      requestedShipment: {
        shipper: { address: { postalCode: String(o?.postcode || ""), city: String(o?.city || ""), countryCode: oc } },
        recipient: { address: { postalCode: String(d?.postcode || ""), city: String(d?.city || ""), countryCode: dc, residential: !!d?.residential } },
        pickupType: "DROPOFF_AT_FEDEX_LOCATION",
        packagingType: body?.isDocuments ? "FEDEX_ENVELOPE" : "YOUR_PACKAGING",
        rateRequestType: ["ACCOUNT", "LIST"],
        preferredCurrency: "NZD",
        requestedPackageLineItems: lineItems
      }
    }

    const res = await apiFetch(`${base}/rate/v1/rates/quotes`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "X-locale": "en_NZ" }, body: JSON.stringify(payload) })
    const text = await res.text()
    if (!res.ok) { console.error("fedex rate FAIL", res.status, text.slice(0, 600)); let ej; try { ej = JSON.parse(text) } catch { ej = null }; const msg = Array.isArray(ej?.errors) ? ej.errors.map((x) => x?.message).join("; ") : (ej?.message || text.slice(0, 200)); return json({ ok: false, reason: `fedex_${res.status}`, detail: msg }) }
    let data; try { data = JSON.parse(text) } catch { return json({ ok: false, reason: "fedex_parse" }) }

    const details = Array.isArray(data?.output?.rateReplyDetails) ? data.output.rateReplyDetails : []
    const options = details.map((rd) => {
      const rsd = Array.isArray(rd?.ratedShipmentDetails) ? rd.ratedShipmentDetails : []
      const acct = rsd.find((x) => String(x?.rateType || "").includes("ACCOUNT") || String(x?.rateType || "").includes("NEGOTIATED")) || rsd[0] || {}
      const charge = Number(acct?.totalNetCharge ?? acct?.totalNetFedExCharge ?? 0)
      const currency = String(acct?.currency || "NZD")
      const eta = rd?.commit?.dateDetail?.dayCxsFormat || rd?.commit?.dateDetail?.dayFormat || rd?.operationalDetail?.deliveryDate || null
      return { carrier: "FedEx", service: String(rd?.serviceName || rd?.serviceType || "FedEx"), code: String(rd?.serviceType || ""), charge, currency, eta }
    }).filter((x) => x.charge > 0).sort((a, b) => a.charge - b.charge)

    if (options.length === 0) return json({ ok: false, reason: "no_rate", detail: `FedEx returned ${details.length} service(s) but no priced option` })
    return json({ ok: true, best: options[0], options: options.slice(0, 12), currency: options[0].currency })
  } catch (e) { console.error("fedex exception", String(e)); return json({ ok: false, reason: String(e) }, 500) }
})
