// STAFF — enable PortConnect polling for a booking (manual refresh only; no webhooks).
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { cors, json, requireStaff } from "../_shared/portalCommon.ts"

function normalizeContainerNos(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return [...new Set(
    raw
      .filter((v): v is string => typeof v === "string")
      .map((v) => v.trim().toUpperCase())
      .filter(Boolean),
  )]
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405)

  try {
    const gate = await requireStaff(req)
    if (!gate.ok) return gate.response

    const body = await req.json().catch(() => ({}))
    const bookingId = typeof body?.booking_id === "string" ? body.booking_id.trim() : ""
    if (!bookingId) return json({ error: "booking_id is required" }, 400)

    let containerNos = normalizeContainerNos(body?.container_numbers)
    if (!containerNos.length) {
      const { data: bcRows } = await gate.db
        .from("booking_containers")
        .select("container_no")
        .eq("booking_id", bookingId)
        .order("sort_order")
        .order("container_no")
      containerNos = normalizeContainerNos((bcRows ?? []).map((c) => c.container_no))
    }

    if (!containerNos.length) {
      return json({ error: "no_containers", message: "At least one container number is required" }, 400)
    }

    const apiKey = Deno.env.get("PORTCONNECT_API_KEY") ?? ""
    if (!apiKey) {
      return json({ error: "PORTCONNECT_API_KEY not configured" }, 500)
    }

    await gate.db.from("booking_tracking").upsert(
      {
        booking_id: bookingId,
        portconnect_enabled: true,
        portconnect_error: null,
      },
      { onConflict: "booking_id" },
    )

    return json({ ok: true, subscribed: containerNos, count: containerNos.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return json({ error: message }, 500)
  }
})
