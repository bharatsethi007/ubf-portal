// courier-dhl-track. Two modes:
//  - single: staff JWT, body {waybill,id} -> track one, return events.
//  - batch:  service-role bearer, body {batch:true} -> refresh all open shipments (cron).
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import { apiFetch, setApiFn } from "../_shared/apiFetch.ts";
setApiFn("courier-dhl-track");

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" }
const json = (b, st = 200) => new Response(JSON.stringify(b), { status: st, headers: { ...cors, "Content-Type": "application/json" } })
const s = (v) => (v == null ? "" : String(v))

function mapStatus(code, desc) {
  const c = s(code).toLowerCase(), d = s(desc).toLowerCase()
  if (c === "delivered" || d.includes("delivered")) return "delivered"
  if (c === "transit" || d.includes("transit") || d.includes("processed") || d.includes("departed") || d.includes("arrived") || d.includes("clearance") || d.includes("with delivery") || d.includes("picked up") || d.includes("shipment collected")) return "in_transit"
  if (c === "failure" || d.includes("cancel")) return "cancelled"
  return null
}

async function dhlTrack(base, auth, waybill) {
  const res = await apiFetch(`${base}/tracking?shipmentTrackingNumber=${encodeURIComponent(waybill)}`, { headers: { Authorization: auth, "Message-Reference": crypto.randomUUID() } })
  const text = await res.text()
  if (!res.ok) { let dj; try { dj = JSON.parse(text) } catch { dj = null }; return { ok: false, status: res.status, detail: dj?.detail || dj?.message || text.slice(0, 200) } }
  const data = JSON.parse(text)
  const sh = Array.isArray(data?.shipments) ? data.shipments[0] : null
  const rawEvents = Array.isArray(sh?.events) ? sh.events : []
  const events = rawEvents.map((e) => ({ timestamp: e?.timestamp || (e?.date ? `${e.date}T${e?.time || "00:00:00"}` : null), description: s(e?.description), location: s(e?.location?.address?.addressLocality || e?.location?.address?.countryCode), statusCode: s(e?.statusCode) }))
  const headStatus = s(sh?.status?.statusCode || sh?.status || events[0]?.statusCode)
  const headDesc = s(sh?.status?.description || events[0]?.description)
  return { ok: true, events, mapped: mapStatus(headStatus, headDesc), headDesc }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
  try {
    const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY"), svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    const user = Deno.env.get("DHL_API_USER"), secret = Deno.env.get("DHL_API_SECRET"), base = Deno.env.get("DHL_BASE_URL") || "https://express.api.dhl.com/mydhlapi/test"
    if (!user || !secret) return json({ ok: false, reason: "missing_secret: DHL_API_USER/DHL_API_SECRET" })
    const auth = "Basic " + btoa(`${user}:${secret}`)
    const admin = createClient(url, svc)

    const authHeader = req.headers.get("Authorization") ?? ""
    const isServiceRole = authHeader === `Bearer ${svc}`
    const b = await req.json().catch(() => ({}))

    // ---- BATCH MODE (cron, service role) ----
    if (isServiceRole && b?.batch) {
      const { data: open } = await admin.from("courier_shipments").select("id, waybill_no").in("status", ["booked", "in_transit"]).not("waybill_no", "is", null).limit(500)
      let updated = 0, moved = 0, failed = 0
      for (const row of open ?? []) {
        try {
          const r = await dhlTrack(base, auth, row.waybill_no)
          if (!r.ok) { failed++; continue }
          const patch = { tracking_events: r.events, updated_at: new Date().toISOString() }
          if (r.mapped) { patch.status = r.mapped; moved++ }
          await admin.from("courier_shipments").update(patch).eq("id", row.id)
          updated++
        } catch (_e) { failed++ }
      }
      console.log("dhl track batch", JSON.stringify({ total: (open ?? []).length, updated, moved, failed }))
      return json({ ok: true, batch: true, total: (open ?? []).length, updated, moved, failed })
    }

    // ---- SINGLE MODE (staff JWT) ----
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } })
    const { data: ures } = await userClient.auth.getUser(); if (!ures?.user) return json({ ok: false, reason: "unauthorized" }, 401)
    const { data: staff } = await userClient.from("staff_users").select("user_id").eq("user_id", ures.user.id).maybeSingle(); if (!staff) return json({ ok: false, reason: "forbidden" }, 403)

    const waybill = s(b?.waybill).trim(); const id = s(b?.id)
    if (!waybill) return json({ ok: false, reason: "waybill required" })
    const r = await dhlTrack(base, auth, waybill)
    if (!r.ok) { console.error("dhl track FAIL", r.status, r.detail); return json({ ok: false, reason: `dhl_${r.status}`, detail: r.detail }) }
    if (id) { const patch = { tracking_events: r.events, updated_at: new Date().toISOString() }; if (r.mapped) patch.status = r.mapped; await admin.from("courier_shipments").update(patch).eq("id", id) }
    return json({ ok: true, waybill, status: r.mapped, statusText: r.headDesc, events: r.events })
  } catch (e) { console.error("dhl track exception", String(e)); return json({ ok: false, reason: String(e) }, 500) }
})
