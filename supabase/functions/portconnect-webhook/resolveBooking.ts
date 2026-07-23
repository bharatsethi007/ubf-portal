import type { SupabaseClient } from "jsr:@supabase/supabase-js@2"
import type { ParsedWebhookEvent } from "./types.ts"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function resolveBookingId(
  db: SupabaseClient,
  event: ParsedWebhookEvent,
): Promise<string | null> {
  const ref = event.userDefinedReference?.trim()
  if (ref) {
    if (UUID_RE.test(ref)) {
      const { data } = await db.from("bookings").select("id").eq("id", ref).maybeSingle()
      if (data?.id) return data.id as string
    }
    const { data: byRef } = await db
      .from("bookings")
      .select("id")
      .eq("booking_ref", ref)
      .maybeSingle()
    if (byRef?.id) return byRef.id as string
  }

  const { data: sub } = await db
    .from("portconnect_subscriptions")
    .select("booking_id")
    .eq("container_no", event.containerNo)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  return (sub?.booking_id as string | undefined) ?? null
}

export async function touchSubscription(
  db: SupabaseClient,
  bookingId: string,
  event: ParsedWebhookEvent,
): Promise<void> {
  await db.from("portconnect_subscriptions").upsert(
    {
      booking_id: bookingId,
      container_no: event.containerNo,
      subscription_id: event.subscriptionId,
      subscription_container_id: event.subscriptionContainerId,
      user_defined_reference: event.userDefinedReference,
      port_code: event.partnerPortCode ?? "ALL",
      category: event.containerVisitTypeCode ?? "IMPORT",
      status:
        event.eventTypeCode.replace(/[^a-z0-9]/gi, "").toUpperCase() === "ACTIVE"
          ? "live"
          : "active",
    },
    { onConflict: "booking_id,container_no" },
  )
}
