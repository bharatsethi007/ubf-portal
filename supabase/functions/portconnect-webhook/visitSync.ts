import type { SupabaseClient } from "jsr:@supabase/supabase-js@2"
import type { ParsedWebhookEvent } from "./types.ts"
import { getField } from "./parseEvent.ts"
import { mapVisitToContainerRow } from "../_shared/portconnectVisitMap.ts"
import { mergeContainerTrackingRow } from "../_shared/portconnectVisitMerge.ts"

export async function fetchContainerVisit(
  uri: string,
  apiKey: string,
): Promise<Record<string, unknown> | null> {
  const path = uri.replace(/^\//, "")
  const res = await fetch(`https://api.portconnect.io/${path}`, {
    headers: {
      Accept: "application/json",
      "Ocp-Apim-Subscription-Key": apiKey,
    },
  })
  if (!res.ok) {
    throw new Error(`Container visit fetch failed (${res.status})`)
  }
  const data = await res.json()
  if (!data || typeof data !== "object") return null
  return data as Record<string, unknown>
}

export async function upsertContainerVisitState(
  db: SupabaseClient,
  bookingId: string,
  containerNo: string,
  visitUri: string,
  apiKey: string,
): Promise<void> {
  const visit = await fetchContainerVisit(visitUri, apiKey)
  if (!visit) return

  const { data: existingRow } = await db
    .from("container_tracking")
    .select("*")
    .eq("booking_id", bookingId)
    .eq("container_no", containerNo)
    .maybeSingle()

  const mapped = mapVisitToContainerRow(visit, bookingId, containerNo)
  const row = mergeContainerTrackingRow(
    mapped,
    existingRow as Record<string, unknown> | null,
  )

  const { error } = await db.from("container_tracking").upsert(row, {
    onConflict: "booking_id,container_no",
  })
  if (error) throw new Error(error.message)
}

export async function syncVisitUris(
  db: SupabaseClient,
  pairs: Map<string, { bookingId: string; containerNo: string }>,
  apiKey: string,
  errors: string[],
): Promise<void> {
  for (const [uri, meta] of pairs) {
    try {
      await upsertContainerVisitState(db, meta.bookingId, meta.containerNo, uri, apiKey)
    } catch (err) {
      errors.push(`Visit sync ${uri}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
}

export function rememberVisitUri(
  map: Map<string, { bookingId: string; containerNo: string }>,
  event: ParsedWebhookEvent,
  bookingId: string,
): void {
  if (!event.containerVisitUri) return
  map.set(event.containerVisitUri, {
    bookingId,
    containerNo: event.containerNo,
  })
}
