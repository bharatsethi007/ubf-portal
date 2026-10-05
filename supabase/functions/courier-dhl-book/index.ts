// STAFF (verify_jwt). DHL Express MyDHL API POST /shipments -> book + A4 label, store in courier_shipments.
// Label PDF -> S3 courier-labels/<waybill>.pdf; label_url keeps plain path.
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import { putObject } from "../_shared/s3.ts"

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" }
const json = (b, st = 200) => new Response(JSON.stringify(b), { status: st, headers: { ...cors, "Content-Type": "application/json" } })
const r2 = (n) => Math.round(n * 100) / 100
const s = (v) => (v == null ? "" : String(v))
const cap = (v, n) => s(v).slice(0, n)

function plannedDate(shipDate) {
  let d = shipDate ? new Date(shipDate + "T12:00:00Z") : new Date()
  if (!shipDate) d.setUTCDate(d.getUTCDate() + 1)
  const day = d.getUTCDay(); if (day === 6) d.setUTCDate(d.getUTCDate() + 2); else if (day === 0) d.setUTCDate(d.getUTCDate() + 1)
  const y = d.getUTCFullYear(), m = String(d.getUTCMonth() + 1).padStart(2, "0"), dd = String(d.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${dd}T12:00:00 GMT+00:00`
}

// DHL maxLengths: addressLine1/2/3 = 45, cityName = 45, postalCode = 12, fullName/companyName = 60, phone = 25
function contact(p) {
  const a1 = cap(p?.address1, 45) || cap(p?.city, 45) || "Address"
  return {
    postalAddress: {
      postalCode: cap(p?.postcode, 12), cityName: cap(p?.city || p?.state, 45), countryCode: cap(s(p?.countryCode).toUpperCase(), 2),
      addressLine1: a1, ...(p?.address2 ? { addressLine2: cap(p.address2, 45) } : {}), ...(p?.address3 ? { addressLine3: cap(p.address3, 45) } : {}),
      ...(p?.state ? { provinceCode: s(p.state).slice(0, 3).toUpperCase() } : {})
    },
    contactInformation: { fullName: cap(p?.name || p?.company || "Contact", 60), companyName: cap(p?.company || p?.name || "Company", 60), phone: cap(p?.phone || "0000000000", 25), email: s(p?.email) || undefined }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
  try {
    const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY"), svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    const userClient = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } })
    const { data: ures } = await userClient.auth.getUser(); if (!ures?.user) return json({ ok: false, reason: "unauthorized" }, 401)
    const { data: staff } = await userClient.from("staff_users").select("user_id").eq("user_id", ures.user.id).maybeSingle(); if (!staff) return json({ ok: false, reason: "forbidden" }, 403)

    const user = Deno.env.get("DHL_API_USER"), secret = Deno.env.get("DHL_API_SECRET"), account = Deno.env.get("DHL_ACCOUNT"), base = Deno.env.get("DHL_BASE_URL") || "https://express.api.dhl.com/mydhlapi/test"
    if (!user || !secret) return json({ ok: false, reason: "missing_secret: DHL_API_USER/DHL_API_SECRET" })

    const b = await req.json().catch(() => ({}))
    const shipper = b?.shipper ?? {}, receiver = b?.receiver ?? {}
    const isDocuments = !!b?.isDocuments
    const payerAccount = s(b?.payerAccount) || s(account)
    if (!s(shipper?.countryCode) || !s(receiver?.countryCode)) return json({ ok: false, reason: "shipper/receiver countryCode required" })

    const rawPieces = Array.isArray(b?.pieces) ? b.pieces : []
    const packages = []
    for (const p of rawPieces) {
      const qty = Math.max(1, parseInt(s(p?.qty ?? 1), 10) || 1)
      const weight = Math.max(0.1, Number(p?.weightKg) || 0.1)
      const length = Math.max(1, Number(p?.lengthCm) || 1), width = Math.max(1, Number(p?.widthCm) || 1), height = Math.max(1, Number(p?.heightCm) || 1)
      for (let i = 0; i < qty; i++) packages.push({ weight: r2(weight), dimensions: { length, width, height } })
    }
    if (packages.length === 0) return json({ ok: false, reason: "at least one piece required" })

    const commodities = Array.isArray(b?.commodities) ? b.commodities : []
    const declaredValue = Number(b?.declaredValue) || commodities.reduce((a, c) => a + (Number(c?.value) || 0) * (Number(c?.qty) || 1), 0)
    const declaredCurrency = s(b?.declaredCurrency) || "NZD"
    const incoterm = s(b?.incoterm) || "DAP"

    const lineItems = commodities.map((c, i) => ({
      number: i + 1, description: cap(c?.description || "Goods", 155), price: Number(c?.value) || 0, priceCurrency: cap(c?.currency || declaredCurrency, 3),
      quantity: { value: Number(c?.qty) || 1, unitOfMeasurement: "PCS" }, manufacturerCountry: cap(s(c?.countryOfManufacture || shipper?.countryCode).toUpperCase(), 2),
      commodityCodes: c?.hsCode ? [{ typeCode: "outbound", value: cap(c.hsCode, 18) }] : undefined,
      weight: { netValue: 0.1, grossValue: 0.1 }
    }))

    const payload = {
      plannedShippingDateAndTime: plannedDate(b?.shipDate),
      pickup: { isRequested: false },
      productCode: s(b?.serviceCode) || "P",
      accounts: [{ typeCode: "shipper", number: s(account) }],
      customerDetails: { shipperDetails: contact({ ...shipper }), receiverDetails: contact({ ...receiver }) },
      content: {
        isCustomsDeclarable: !isDocuments,
        description: isDocuments ? "Documents" : cap(commodities[0]?.description || "Goods", 70),
        incoterm, unitOfMeasurement: "metric",
        packages: packages.map((p, i) => ({ ...p, description: `Piece ${i + 1}` })),
        ...(isDocuments ? {} : { declaredValue: r2(declaredValue), declaredValueCurrency: declaredCurrency, exportDeclaration: { lineItems, invoice: { number: cap(b?.invoiceNumber || `INV-${Date.now()}`, 35), date: (b?.shipDate || new Date().toISOString().slice(0, 10)) } } })
      },
      outputImageProperties: { encodingFormat: "pdf", imageOptions: [{ typeCode: "label", templateName: "ECOM26_A4_001" }] }
    }

    const auth = "Basic " + btoa(`${user}:${secret}`)
    const res = await fetch(`${base}/shipments`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: auth, "Message-Reference": crypto.randomUUID() }, body: JSON.stringify(payload) })
    const text = await res.text()
    if (!res.ok) { console.error("dhl ship FAIL", res.status, text.slice(0, 800)); let dj; try { dj = JSON.parse(text) } catch { dj = null }; const detail = (Array.isArray(dj?.additionalDetails) ? dj.additionalDetails.join("; ") : null) || dj?.detail || dj?.message || text.slice(0, 300); return json({ ok: false, reason: `dhl_${res.status}`, detail }) }
    const data = JSON.parse(text)

    const waybill = s(data?.shipmentTrackingNumber)
    const docs = Array.isArray(data?.documents) ? data.documents : []
    const labelDoc = docs.find((x) => x?.typeCode === "label") || docs[0]
    const labelB64 = labelDoc?.content || null

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
      carrier: "DHL", service: s(b?.service), service_code: s(b?.serviceCode) || "P",
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
      purpose: s(b?.purpose), incoterm, duties_paid_by: s(b?.dutiesPaidBy) || "receiver", payer_account: payerAccount,
      declared_value: isDocuments ? null : r2(declaredValue), declared_currency: declaredCurrency,
      ship_date: b?.shipDate || null, pieces: rawPieces, commodities,
      invoice_number: s(b?.invoiceNumber), invoice_remarks: s(b?.invoiceRemarks),
      rate_charge: b?.rateCharge != null ? Number(b.rateCharge) : null, rate_currency: s(b?.rateCurrency),
      label_url: labelUrl, label_format: "PDF", carrier_response: data, created_by: ures.user.id
    }
    const ins = await admin.from("courier_shipments").insert(row).select("id, booking_ref, waybill_no, status").single()
    if (ins.error) { console.error("insert", ins.error.message); return json({ ok: false, reason: "store_failed", detail: ins.error.message, waybill }) }

    return json({ ok: true, id: ins.data.id, bookingRef: ins.data.booking_ref, waybill, labelBase64: labelB64, labelStored: !!labelUrl })
  } catch (e) { console.error("dhl book exception", String(e)); return json({ ok: false, reason: String(e) }, 500) }
})
