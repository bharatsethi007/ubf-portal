import type { SupabaseClient } from "jsr:@supabase/supabase-js@2"
import { unsubscribeBookingContainers } from "../_shared/portconnectUnsubscribe.ts"
import type { ContainerStatePatch } from "./types.ts"

export async function autoUnsubscribeCompletedVisits(
  db: SupabaseClient,
  apiKey: string,
  containerBuckets: Map<string, ContainerStatePatch>,
  bookingPatches: Map<string, Record<string, unknown>>,
  errors: string[],
): Promise<void> {
  if (!apiKey) return

  const checked = new Set<string>()

  for (const [key, patch] of containerBuckets) {
    if (!patch.gate_out_at) continue
    const [bookingId, containerNo] = key.split(":")
    const booking = bookingPatches.get(bookingId)
    if (!booking?.container_return_date) continue

    const dedupe = `${bookingId}:${containerNo}`
    if (checked.has(dedupe)) continue
    checked.add(dedupe)

    try {
      const warnings = await unsubscribeBookingContainers(
        db,
        apiKey,
        bookingId,
        [containerNo],
      )
      warnings.forEach((w) => errors.push(`Auto-unsubscribe ${w}`))
    } catch (err) {
      errors.push(
        `Auto-unsubscribe ${containerNo}: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }
}
