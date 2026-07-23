// portconnect-webhook — PortConnect container event callback receiver.
// Auth: X-WebhookToken header (verify_jwt disabled).
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import {
  getContainerPatch,
  insertTrackingEvent,
  flushAllState,
  logWebhook,
} from "./persist.ts"
import { headerValue, parsePayload, parseWebhookEvent } from "./parseEvent.ts"
import { resolveBookingId, touchSubscription } from "./resolveBooking.ts"
import { applyEventState, loadBookingOverrides, sortEvents, webhookTaskTrigger } from "./stateMap.ts"
import { completePortConnectTask } from "../_shared/portconnectBookingAutomation.ts"
import { rememberVisitUri, syncVisitUris } from "./visitSync.ts"
import { autoUnsubscribeCompletedVisits } from "./autoUnsubscribe.ts"
import type { ParsedWebhookEvent } from "./types.ts"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhooktoken",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  })

function serviceDb() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  )
}

async function processEvents(
  db: ReturnType<typeof serviceDb>,
  events: ParsedWebhookEvent[],
  apiKey: string,
): Promise<{ processed: number; skipped: number; errors: string[] }> {
  const errors: string[] = []
  let processed = 0
  let skipped = 0
  const containerBuckets = new Map<string, Record<string, unknown>>()
  const bookingPatches = new Map<string, Record<string, unknown>>()
  const settingsPatches = new Map<string, Record<string, unknown>>()
  const visitPairs = new Map<string, { bookingId: string; containerNo: string }>()
  const overrideCache = new Map<string, Record<string, boolean>>()

  for (const event of sortEvents(events)) {
    try {
      const bookingId = await resolveBookingId(db, event)
      if (!bookingId) {
        skipped += 1
        errors.push(`No booking for ${event.containerNo} (${event.eventTypeCode})`)
        continue
      }

      const insertResult = await insertTrackingEvent(db, bookingId, event)
      if (insertResult === "error") {
        skipped += 1
        continue
      }

      await touchSubscription(db, bookingId, event)
      rememberVisitUri(visitPairs, event, bookingId)

      const overrides = await loadBookingOverrides(db, overrideCache, bookingId)
      const containerPatch = getContainerPatch(containerBuckets, bookingId, event.containerNo)
      const booking = bookingPatches.get(bookingId) ?? {}
      const settings = settingsPatches.get(bookingId) ?? {}

      applyEventState(event, containerPatch, booking, settings, overrides)

      bookingPatches.set(bookingId, booking)
      settingsPatches.set(bookingId, settings)

      const taskTrigger = webhookTaskTrigger(event)
      if (taskTrigger && insertResult === "inserted") {
        await completePortConnectTask(db, bookingId, taskTrigger)
      }

      processed += 1
    } catch (err) {
      skipped += 1
      errors.push(
        `${event.containerNo}/${event.eventTypeCode}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      )
    }
  }

  try {
    await flushAllState(db, containerBuckets, bookingPatches, settingsPatches)
  } catch (err) {
    errors.push(`Flush state: ${err instanceof Error ? err.message : String(err)}`)
  }

  if (apiKey) {
    await autoUnsubscribeCompletedVisits(
      db,
      apiKey,
      containerBuckets,
      bookingPatches,
      errors,
    )
    await syncVisitUris(db, visitPairs, apiKey, errors)
  } else {
    errors.push("PORTCONNECT_API_KEY not configured — visit sync skipped")
  }

  return { processed, skipped, errors }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405)

  const db = serviceDb()
  const expectedToken = Deno.env.get("PORTCONNECT_WEBHOOK_TOKEN") ?? ""
  const token = headerValue(req, "X-WebhookToken") ?? ""
  const tokenValid = !!expectedToken && token === expectedToken

  let payload: unknown = null
  let eventCount = 0
  const errors: string[] = []

  try {
    payload = await req.json()
    const rawEvents = parsePayload(payload)
    eventCount = rawEvents.length

    if (!tokenValid) {
      await logWebhook(db, {
        payload,
        eventCount,
        tokenValid: false,
        httpStatus: 401,
        error: "Invalid or missing X-WebhookToken",
      })
      return json({ ok: false, error: "unauthorized" }, 401)
    }

    const parsed = rawEvents
      .map(parseWebhookEvent)
      .filter((event): event is ParsedWebhookEvent => event != null)

    if (parsed.length !== rawEvents.length) {
      errors.push(`Skipped ${rawEvents.length - parsed.length} malformed event(s)`)
    }

    const apiKey = Deno.env.get("PORTCONNECT_API_KEY") ?? ""
    const result = await processEvents(db, parsed, apiKey)
    errors.push(...result.errors)

    await logWebhook(db, {
      payload,
      eventCount,
      tokenValid: true,
      httpStatus: 200,
      error: errors.length ? errors.join("; ") : null,
    })

    return json({
      ok: true,
      processed: result.processed,
      skipped: result.skipped,
      warnings: errors,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await logWebhook(db, {
      payload,
      eventCount,
      tokenValid,
      httpStatus: 200,
      error: message,
    })
    return json({ ok: true, error: message })
  }
})
