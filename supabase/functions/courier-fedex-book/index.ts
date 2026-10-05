// STAFF (verify_jwt). FedEx Ship API POST /ship/v1/shipments -> book + label, store in courier_shipments.
// Label PDF -> S3 courier-labels/<waybill>.pdf; label_url keeps plain path.
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import { putObject } from "../_shared/s3.ts"
import { apiFetch, setApiFn } from "../_shared/apiFetch.ts";
setApiFn("courier-fedex-book");

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" }
const json = (b, st = 200) => new Response(JSON.stringify(b), { status: st, headers: { ...cors, "Content-Type": "application/json" } })
const r2 = (n) => Math.round(n * 100) / 100
const s = (v) => (v == null ? "" : String(v))
const cap = (v, n) => s(v).slice(0, n)

function shipDate(d) {
  const base = d ? new Date(d + "T12:00:00Z") : new Date()
  if (!d) base.setUTCDate(base.getUTCDate() + 1)
  return base.toISOString().slice(0, 10)
}

// FedEx address: streetLines[], city, stateOrProvinceCode, postalCode, countryCode, residential
function addr(p) {
  const lines = [cap(p?.address1, 35), cap(p?.address2, 35), cap(p?.address3, 35)].filter(Boolean)
  return {
    address: {
      streetLines: lines.length ? lines : [cap(p?.city || "Address", 35)],
      city: cap(p?.city || p?.state, 35),
      stateOrProvinceCode: p?.state ? cap(s(p.state).toUpperCase(), 14) : undefined,
      postalCode: cap(p?.postcode, 10),
      countryCode: cap(s(p?.countryCode).toUpperCase(), 2),
      residential: !!p?.residential
    },
    contact: {
      personName: cap(p?.name || p?.company || "Contact", 70),
      companyName: cap(p?.company || p?.name || "Company", 35),
      phoneNumber: cap(s(p?.phone).replace(/[^0-9]/g, "") || "0000000000", 15),
      emailAddress: s(p?.email) || undefined
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
  try {
    const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY"), svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    const userClient = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } })
    const { data: ures } = await userClient.auth.getUser(); if (!ures?.user) return json({ ok: false, reason: "unauthorized" }, 401)
    const { data: staff } = await userClient.from("staff_users").select("user_id").eq("user_id", ures.user.id).maybeSingle(); if (!staff) return json({ ok: false, reason: "forbidden" }, 403)

    const cid = Deno.env.get("FEDEX_CLIENT_ID"), csec = Deno.env.get("FEDEX_CLIENT_SECRET"), account = Deno.env.get("FEDEX_ACCOUNT"), base = Deno.env.get("FEDEX_BASE_URL") || "https://apis-sandbox.fedex.com"
    if (!cid || !csec) return json({ ok: false, reason: "missing_secret: FEDEX_CLIENT_ID/FEDEX_CLIENT_SECRET" })
    if (!account) return json({ ok: false, reason: "missing_secret: FEDEX_ACCOUNT" })

    const b = await req.json().catch(() => ({}))
    const shipper = b?.shipper ?? {}, receiver = b?.receiver ?? {}
    const isDocuments = !!b?.isDocuments
    if (!s(shipper?.countryCode) || !s(receiver?.countryCode)) return json({ ok: false, reason: "shipper/receiver countryCode required" })

    // OAuth token
    const tokRes = await apiFetch(`${base}/oauth/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "client_credentials", client_id: cid, client_secret: csec }) })
    const tokText = await tokRes.text()
    if (!tokRes.ok) { console.error("fedex token FAIL", tokRes.status, tokText.slice(0, 300)); return json({ ok: false, reason: `fedex_auth_${tokRes.status}`, detail: tokText.slice(0, 200) }) }
    const token = JSON.parse(tokText)?.access_token
    if (!token) return json({ ok: false, reason: "fedex_no_token" })

    const rawPieces = Array.isArray(b?.pieces) ? b.pieces : []
    const lineItems = []
    for (const p of rawPieces) {
      const qty = Math.max(1, parseInt(s(p?.qty ?? 1), 10) || 1)
      const weight = Math.max(0.1, Number(p?.weightKg) || 0.1)
      const length = Math.max(1, Math.round(Number(p?.lengthCm) || 1)), width = Math.max(1, Math.round(Number(p?.widthCm) || 1)), height = Math.max(1, Math.round(Number(p?.heightCm) || 1))
      for (let i = 0; i < qty; i++) lineItems.push({ weight: { units: "KG", value: r2(weight) }, dimensions: { length, width, height, units: "CM" } })
    }
    if (lineItems.length === 0) return json({ ok: false, reason: "at least one piece required" })

    const commodities = Array.isArray(b?.commodities) ? b.commodities : []
    const declaredValue = Number(b?.declaredValue) || commodities.reduce((a, c) => a + (Number(c?.value) || 0) * (Number(c?.qty) || 1), 0)
    const declaredCurrency = s(b?.declaredCurrency) || "NZD"
    const serviceType = s(b?.serviceCode) || "INTERNATIONAL_PRIORITY"
    // FedEx duties: SENDER/RECIPIENT payment for duties+taxes
    const dutiesPayor = (s(b?.dutiesPaidBy) || "receiver").toLowerCase() === "sender" ? "SENDER" : "RECIPIENT"

    const customsCommodities = commodities.map((c) => ({
      description: cap(c?.description || "Goods", 450),
      countryOfManufacture: cap(s(c?.countryOfManufacture || shipper?.countryCode).toUpperCase(), 2),
      quantity: Number(c?.qty) || 1, quantityUnits: "PCS",
      unitPrice: { amount: Number(c?.value) || 0, currency: cap(c?.currency || declaredCurrency, 3) },
      customsValue: { amount: (Number(c?.value) || 0) * (Number(c?.qty) || 1), currency: cap(c?.currency || declaredCurrency, 3) },
      weight: { units: "KG", value: 0.5 },
      ...(c?.hsCode ? { harmonizedCode: cap(s(c.hsCode), 14) } : {})
    }))

    const payload = {
      labelResponseOptions: "LABEL",
      accountNumber: { value: s(account) },
      requestedShipment: {
        shipDatestamp: shipDate(b?.shipDate),
        pickupType: "DROPOFF_AT_FEDEX_LOCATION",
        serviceType,
        packagingType: isDocuments ? "FEDEX_ENVELOPE" : "YOUR_PACKAGING",
        shipper: addr(shipper),
        recipients: [addr(receiver)],
        shippingChargesPayment: { paymentType: "SENDER", payor: { responsibleParty: { accountNumber: { value: s(account) } } } },
        labelSpecification: { labelStockType: "PAPER_85X11_TOP_HALF_LABEL", imageType: "PDF", labelFormatType: "COMMON2D" },
        ...(isDocuments ? {} : {
          customsClearanceDetail: {
            dutiesPayment: { paymentType: dutiesPayor, ...(dutiesPayor === "SENDER" ? { payor: { responsibleParty: { accountNumber: { value: s(account) } } } } : {}) },
            isDocumentOnly: false,
            commodities: customsCommodities.length ? customsCommodities : [{ description: "Goods", countryOfManufacture: cap(s(shipper?.countryCode).toUpperCase(), 2), quantity: 1, quantityUnits: "PCS", unitPrice: { amount: declaredValue, currency: declaredCurrency }, customsValue: { amount: declaredValue, currency: declaredCurrency }, weight: { units: "KG", value: 0.5 } }]
          }
        }),
        requestedPackageLineItems: lineItems
      }
    }

    const res = await apiFetch(`${base}/ship/v1/shipments`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "X-locale": "en_NZ" }, body: JSON.stringify(payload) })
    const text = await res.text()
    if (!res.ok) { console.error("fedex ship FAIL", res.status, text.slice(0, 800)); let ej; try { ej = JSON.parse(text) } catch { ej = null }; const detail = Array.isArray(ej?.errors) ? ej.errors.map((x) => `${x?.code}: ${x?.message}`).join("; ") : (ej?.message || text.slice(0, 300)); return json({ ok: false, reason: `fedex_${res.status}`, detail }) }
    const data = JSON.parse(text)

    const txn = data?.output?.transactionShipments?.[0]
    const pieceResp = txn?.pieceResponses?.[0] || txn?.completedShipmentDetail?.completedPackageDetails?.[0]
    const waybill = s(txn?.masterTrackingNumber || pieceResp?.trackingNumber)
    // label (base64) lives in packageDocuments[].encodedLabel
    let labelB64 = null
    const pkgDocs = pieceResp?.packageDocuments || txn?.pieceResponses?.[0]?.packageDocuments
    if (Array.isArray(pkgDocs) && pkgDocs.length) labelB64 = pkgDocs[0]?.encodedLabel || pkgDocs[0]?.docContent || null

    const admin = createClient(url, svc)
    let labelUrl = null
    if (labelB64) {
      try {
        const bytes = Uint8Array.from(atob(labelB64), (c) => c.charCodeAt(0))
        const path = `${waybill || crypto.randomUUID()}.pdf`
        await putObject(`courier-labels/${path}`, bytes, "application/pdf")
        labelUrl = path
      } catch (e) { console.error("label store", String(e)) }
    }

    const row = {
      ...(b?.quoteId ? { quote_id: b.quoteId } : {}),
      carrier: "FedEx", service: s(b?.service), service_code: serviceType,
      shipment_type: isDocuments ? "documents" : "packages", direction: s(b?.direction) || null,
      status: "booked", waybill_no: waybill || null,
      shipper_name: s(shipper?.name), shipper_company: s(shipper?.company), shipper_is_business: !!shipper?.isBusiness,
      shipper_country: s(shipper?.countryCode), shipper_address1: s(shipper?.address1), shipper_address2: s(shipper?.address2), shipper_address3: s(shipper?.address3),
      shipper_postcode: s(shipper?.postcode), shipper_city: s(shipper?.city), shipper_state: s(shipper?.state), shipper_residential: !!shipper?.residential,
      shipper_email: s(shipper?.email), shipper_phone: s(shipper?.phone), shipper_vat: s(shipper?.vat),
      receiver_name: s(receiver?.name), receiver_company: s(receiver?.company), receiver_is_business: !!receiver?.isBusiness,
      receiver_country: s(receiver?.countryCode), receiver_address1: s(receiver?.address1), receiver_address2: s(receiver?.address2), receiver_address3: s(receiver?.address3),
      receiver_postcode: s(receiver?.postcode), receiver_city: s(receiver?.city), receiver_state: s(receiver?.state), receiver_residential: !!receiver?.residential,
      receiver_email: s(receiver?.email), receiver_phone: s(receiver?.phone), receiver_vat: s(receiver?.vat),
      purpose: s(b?.purpose), incoterm: s(b?.incoterm) || null, duties_paid_by: s(b?.dutiesPaidBy) || "receiver", payer_account: s(account),
      declared_value: isDocuments ? null : r2(declaredValue), declared_currency: declaredCurrency,
      ship_date: b?.shipDate || null, pieces: rawPieces, commodities,
      invoice_number: s(b?.invoiceNumber), invoice_remarks: s(b?.invoiceRemarks),
      rate_charge: b?.rateCharge != null ? Number(b.rateCharge) : null, rate_currency: s(b?.rateCurrency),
      label_url: labelUrl, label_format: "PDF", carrier_response: data, created_by: ures.user.id
    }
    const ins = await admin.from("courier_shipments").insert(row).select("id, booking_ref, waybill_no, status").single()
    if (ins.error) { console.error("insert", ins.error.message); return json({ ok: false, reason: "store_failed", detail: ins.error.message, waybill }) }

    return json({ ok: true, id: ins.data.id, bookingRef: ins.data.booking_ref, waybill, labelBase64: labelB64, labelStored: !!labelUrl })
  } catch (e) { console.error("fedex book exception", String(e)); return json({ ok: false, reason: String(e) }, 500) }
})
