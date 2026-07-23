// STAFF — disable PortConnect polling for a booking (no webhook teardown).
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { cors, json, requireStaff } from "../_shared/portalCommon.ts"

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405)

  try {
    const gate = await requireStaff(req)
    if (!gate.ok) return gate.response

    const body = await req.json().catch(() => ({}))
    const bookingId = typeof body?.booking_id === "string" ? body.booking_id.trim() : ""
    if (!bookingId) return json({ error: "booking_id is required" }, 400)

    await gate.db.from("booking_tracking").upsert(
      {
        booking_id: bookingId,
        portconnect_enabled: false,
        portconnect_error: null,
      },
      { onConflict: "booking_id" },
    )

    return json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return json({ error: message }, 500)
  }
})
