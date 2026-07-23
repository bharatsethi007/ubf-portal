// STAFF — on-demand PortConnect container-visits refresh for a booking.
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { cors, json, requireStaff } from "../_shared/portalCommon.ts"
import { refreshBookingPortConnect } from "../_shared/portconnectRefreshRun.ts"

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405)

  try {
    const gate = await requireStaff(req)
    if (!gate.ok) return gate.response

    const body = await req.json().catch(() => ({}))
    const bookingId = typeof body?.booking_id === "string" ? body.booking_id.trim() : ""
    if (!bookingId) return json({ error: "booking_id is required" }, 400)

    const apiKey = Deno.env.get("PORTCONNECT_API_KEY") ?? ""
    if (!apiKey) return json({ error: "PORTCONNECT_API_KEY not configured" }, 500)

    const summary = await refreshBookingPortConnect(gate.db, apiKey, bookingId)
    if (!summary.ok) {
      return json({ error: summary.error ?? "Refresh failed", ...summary }, 502)
    }
    return json(summary)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return json({ error: message }, 500)
  }
})
