// Shared Maersk Track & Trace Plus (DCSA v2.2) client + event mapping.
//
// Auth model (developer.maersk.com): OAuth2 client-credentials, where the app's
// Consumer Key is the client_id and the Consumer Secret is the client_secret.
// 1. POST the token endpoint -> Bearer access_token (~2h).
// 2. GET /events with Authorization: Bearer <token> AND Consumer-Key: <key>.
//
// Endpoints are env-overridable so a path change never needs a code edit:
//   MAERSK_CONSUMER_KEY     (required) app Consumer Key  = client_id
//   MAERSK_CONSUMER_SECRET  (required) app Consumer Secret = client_secret
//   MAERSK_TOKEN_URL        (optional) default below
//   MAERSK_EVENTS_URL       (optional) default below
//   MAERSK_API_VERSION      (optional) API-Version header, default "1"

export type JsonRecord = Record<string, unknown>

const DEFAULT_TOKEN_URL = "https://api.maersk.com/customer-identity/oauth/v2/access_token"
const DEFAULT_EVENTS_URL = "https://api.maersk.com/track-and-trace-private/events"

function tokenUrl(): string {
  return (Deno.env.get("MAERSK_TOKEN_URL") ?? DEFAULT_TOKEN_URL).trim()
}
function eventsUrl(): string {
  return (Deno.env.get("MAERSK_EVENTS_URL") ?? DEFAULT_EVENTS_URL).trim()
}

export type MaerskCreds = { consumerKey: string; consumerSecret: string }

export function readMaerskCreds(): MaerskCreds | null {
  const consumerKey = (Deno.env.get("MAERSK_CONSUMER_KEY") ?? "").trim()
  const consumerSecret = (Deno.env.get("MAERSK_CONSUMER_SECRET") ?? "").trim()
  if (!consumerKey || !consumerSecret) return null
  return { consumerKey, consumerSecret }
}

/** OAuth2 client-credentials -> Bearer access token. */
export async function fetchMaerskToken(creds: MaerskCreds): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: creds.consumerKey,
    client_secret: creds.consumerSecret,
  })
  const res = await fetch(tokenUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Consumer-Key": creds.consumerKey,
      "Cache-Control": "no-cache",
    },
    body: body.toString(),
  })
  const data = (await res.json().catch(() => ({}))) as JsonRecord
  if (!res.ok) {
    const msg = String(
      (data.error_description ?? data.error ?? data.message) ?? res.statusText,
    )
    throw new Error(`Maersk token request failed (${res.status}): ${msg}`)
  }
  const token = data.access_token
  if (typeof token !== "string" || !token) {
    throw new Error("Maersk token response missing access_token")
  }
  return token
}

export type MaerskFetchResult = {
  status: number
  events: JsonRecord[]
  message?: string
}

/**
 * Fetch all DCSA events for one container (equipmentReference), following the
 * DCSA `Next-Page` header pagination (bounded to 6 pages as a safety cap).
 * 404 / empty is treated as "no data for this container", not a hard failure.
 */
export async function fetchMaerskEventsByContainer(
  creds: MaerskCreds,
  token: string,
  equipmentReference: string,
): Promise<MaerskFetchResult> {
  const headers: HeadersInit = {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
    "Consumer-Key": creds.consumerKey,
    "API-Version": (Deno.env.get("MAERSK_API_VERSION") ?? "1").trim(),
  }

  const first = new URL(eventsUrl())
  first.searchParams.set("equipmentReference", equipmentReference)
  first.searchParams.set("limit", "100")

  let url: string | null = first.toString()
  const events: JsonRecord[] = []
  let lastStatus = 0
  let pages = 0

  while (url && pages < 6) {
    const res: Response = await fetch(url, { headers })
    lastStatus = res.status

    if (!res.ok) {
      const text = await res.text().catch(() => "")
      let msg = res.statusText
      try {
        const j = JSON.parse(text) as JsonRecord
        msg = String(j.message ?? j.error ?? j.title ?? msg)
      } catch {
        if (text) msg = text.slice(0, 300)
      }
      if (res.status === 404) return { status: 404, events: [], message: msg }
      return { status: res.status, events, message: msg }
    }

    const body = (await res.json().catch(() => [])) as unknown
    if (Array.isArray(body)) {
      events.push(...(body as JsonRecord[]))
    } else if (body && typeof body === "object") {
      // Some gateways wrap the array in { events: [...] }.
      const inner = (body as JsonRecord).events
      if (Array.isArray(inner)) events.push(...(inner as JsonRecord[]))
    }

    const next = res.headers.get("Next-Page") ?? res.headers.get("next-page")
    url = next && next.trim() ? next.trim() : null
    pages += 1
  }

  return { status: lastStatus || 200, events }
}

// ---------------------------------------------------------------------------
// DCSA event -> tracking_events row mapping
// ---------------------------------------------------------------------------

/** Case-insensitive field getter (DCSA JSON mixes camelCase and ALLCAPS keys). */
function field(obj: JsonRecord | null | undefined, ...names: string[]): unknown {
  if (!obj) return null
  const map = new Map<string, unknown>()
  for (const [k, v] of Object.entries(obj)) map.set(k.toLowerCase(), v)
  for (const n of names) {
    const hit = map.get(n.toLowerCase())
    if (hit !== undefined && hit !== null && hit !== "") return hit
  }
  return null
}

function str(v: unknown): string | null {
  if (typeof v === "string") return v.trim() || null
  if (typeof v === "number") return String(v)
  return null
}

export type CarrierEventRow = {
  booking_id: string
  container_no: string | null
  event_type_code: string
  event_datetime: string
  event_location: string | null
  partner_port_code: string | null
  event_value: string | null
  event_value2: string | null
  container_iso_type: string | null
  container_status: string | null
  inbound_vessel_name: string | null
  inbound_vessel_ref: string | null
  inbound_vessel_imo: number | null
  operator_scac: string | null
  source: "carrier"
  is_estimated: boolean
  carrier_event_id: string | null
  raw: JsonRecord
}

/**
 * Map one DCSA event object to a tracking_events row (source='carrier').
 * Returns null if the event has no usable timestamp.
 */
export function mapMaerskEvent(
  bookingId: string,
  fallbackContainerNo: string,
  scac: string | null,
  ev: JsonRecord,
): CarrierEventRow | null {
  const eventType = String(field(ev, "eventType") ?? "").toUpperCase()
  const classifier = String(field(ev, "eventClassifierCode") ?? "").toUpperCase() // ACT | EST | PLN
  const eventDateTime = str(field(ev, "eventDateTime", "eventCreatedDateTime"))
  if (!eventDateTime) return null

  let typeCode: string | null = null
  if (eventType === "EQUIPMENT") typeCode = str(field(ev, "equipmentEventTypeCode"))
  else if (eventType === "TRANSPORT") typeCode = str(field(ev, "transportEventTypeCode"))
  else if (eventType === "SHIPMENT") typeCode = str(field(ev, "shipmentEventTypeCode"))
  const event_type_code = typeCode ?? (eventType || "EVENT")

  const tc = (field(ev, "transportCall") as JsonRecord | null) ?? null
  const tcLoc = (field(tc ?? {}, "location") as JsonRecord | null) ?? null
  const evLoc = (field(ev, "eventLocation") as JsonRecord | null) ?? null
  const vessel = (field(tc ?? {}, "vessel") as JsonRecord | null) ?? null

  const equipmentReference = str(field(ev, "equipmentReference"))
  const unloc =
    str(field(tc ?? {}, "UNLocationCode")) ??
    str(field(tcLoc ?? {}, "UNLocationCode")) ??
    str(field(evLoc ?? {}, "UNLocationCode"))
  const locName =
    str(field(tcLoc ?? {}, "locationName")) ??
    str(field(evLoc ?? {}, "locationName")) ??
    unloc

  const vesselName = str(field(vessel ?? {}, "vesselName"))
  const vesselImoRaw = str(field(vessel ?? {}, "vesselIMONumber"))
  const vesselImo = vesselImoRaw && /^\d+$/.test(vesselImoRaw) ? Number(vesselImoRaw) : null
  const voyage = str(field(tc ?? {}, "importVoyageNumber", "exportVoyageNumber", "carrierVoyageNumber"))

  const isoType = str(field(ev, "ISOEquipmentCode"))
  const emptyInd = str(field(ev, "emptyIndicatorCode")) // EMPTY | LADEN

  return {
    booking_id: bookingId,
    container_no: equipmentReference ?? fallbackContainerNo ?? null,
    event_type_code,
    event_datetime: eventDateTime,
    event_location: locName,
    partner_port_code: unloc,
    event_value: eventType || null,        // SHIPMENT | TRANSPORT | EQUIPMENT
    event_value2: classifier || null,      // ACT | EST | PLN
    container_iso_type: isoType,
    container_status: emptyInd,
    inbound_vessel_name: vesselName,
    inbound_vessel_ref: voyage,
    inbound_vessel_imo: vesselImo,
    operator_scac: scac ?? str(field(vessel ?? {}, "vesselOperatorCarrierCode")),
    source: "carrier",
    is_estimated: classifier !== "ACT",
    carrier_event_id: str(field(ev, "eventID", "eventId")),
    raw: ev,
  }
}
