import type { SupabaseClient } from "jsr:@supabase/supabase-js@2"
import { portconnectDeleteContainer } from "./portconnectClient.ts"

type SubRow = {
  id: string
  container_no: string
  subscription_id: number | null
}

export async function unsubscribeBookingContainers(
  db: SupabaseClient,
  apiKey: string,
  bookingId: string,
  containerNos?: string[],
): Promise<string[]> {
  let query = db
    .from("portconnect_subscriptions")
    .select("id, container_no, subscription_id")
    .eq("booking_id", bookingId)
    .is("deleted_at", null)

  if (containerNos?.length) query = query.in("container_no", containerNos)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const rows = (data ?? []) as SubRow[]
  const errors: string[] = []

  for (const row of rows) {
    if (!row.subscription_id) {
      await db.from("portconnect_subscriptions").update({
        deleted_at: new Date().toISOString(),
        status: "cancelled",
      }).eq("id", row.id)
      continue
    }
    try {
      await portconnectDeleteContainer(apiKey, row.subscription_id, row.container_no)
      await db.from("portconnect_subscriptions").update({
        deleted_at: new Date().toISOString(),
        status: "cancelled",
      }).eq("id", row.id)
    } catch (err) {
      errors.push(
        `${row.container_no}: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  await db.from("booking_tracking").upsert(
    {
      booking_id: bookingId,
      portconnect_enabled: false,
      portconnect_error: errors.length ? errors.join("; ") : null,
    },
    { onConflict: "booking_id" },
  )

  return errors
}
