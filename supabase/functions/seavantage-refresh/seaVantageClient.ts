// SeaVantage Insight client + mappers (Basic Auth).
// Two-step model: POST /cargo registers a container (billable — do once),
// GET /cargo/search/past-track returns container events + AIS pastTrack positions.
//   SEAVANTAGE_USERNAME (required), SEAVANTAGE_PASSWORD (required)
//   SEAVANTAGE_BASE_URL (optional) default https://insight.seavantage.com/api
export type JsonRecord = Record<string, unknown>

const DEFAULT_BASE = "https://insight.seavantage.com/api"
function baseUrl(): string {
  return (Deno.env.get("SEAVANTAGE_BASE_URL") ?? DEFAULT_BASE).trim().replace(/\/+$/, "")
}

export type SvCreds = { username: string; password: string }
export function readSeaVantageCreds(): SvCreds | null {
  const username = (Deno.env.get("SEAVANTAGE_USERNAME") ?? "").trim()
  const password = (Deno.env.get("SEAVANTAGE_PASSWORD") ?? "").trim()
  if (!username || !password) return null
  return { username, password }
}
function authHeader(creds: SvCreds): string {
  return "Basic " + btoa(`${creds.username}:${creds.password}`)
}

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
function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v)
  return null
}
// SeaVantage times are "YYYY-MM-DD HH:mm" or ISO. Normalise to ISO when possible.
function toIso(v: unknown): string | null {
  const s = str(v)
  if (!s) return null
  const d = new Date(s.includes("T") ? s : s.replace(" ", "T") + "Z")
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export type SvResult<T> = { status: number; ok: boolean; data: T | null; message?: string }

/** POST /cargo — register a container for tracking. Returns documentId. */
export async function registerCargo(
  creds: SvCreds, carrierCode: string, containerNo: string,
): Promise<SvResult<{ documentId: string | null }>> {
  const res = await fetch(`${baseUrl()}/cargo`, {
    method: "POST",
    headers: { Authorization: authHeader(creds), "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ carrierCode, containerNo }),
  })
  const body = (await res.json().catch(() => ({}))) as JsonRecord
  return {
    status: res.status, ok: res.ok,
    data: { documentId: str(field(body.response as JsonRecord, "documentId")) },
    message: str(field(body, "message")) ?? undefined,
  }
}

export type SvPastTrack = JsonRecord
/** GET /cargo/search/past-track?containerNo= — container events + AIS pastTrack. */
export async function fetchPastTrack(creds: SvCreds, containerNo: string): Promise<SvResult<SvPastTrack>> {
  const url = new URL(`${baseUrl()}/cargo/search/past-track`)
  url.searchParams.set("containerNo", containerNo)
  const res = await fetch(url.toString(), { headers: { Authorization: authHeader(creds), Accept: "application/json" } })
  const body = (await res.json().catch(() => ({}))) as JsonRecord
  return { status: res.status, ok: res.ok, data: (body.response as JsonRecord) ?? null, message: str(field(body, "message")) ?? undefined }
}

// ---- mappers ---------------------------------------------------------------
export type TrackingEventRow = {
  booking_id: string; container_no: string | null; event_type_code: string; event_datetime: string
  event_location: string | null; partner_port_code: string | null; event_value: string | null; event_value2: string | null
  inbound_vessel_name: string | null; inbound_vessel_imo: number | null; operator_scac: string | null
  source: "seavantage"; is_estimated: boolean; carrier_event_id: string | null; raw: JsonRecord
}
/** Deterministic id for a SeaVantage container event (no native event id). */
function svEventId(containerNo: string, ev: JsonRecord): string {
  return `SV:${containerNo}:${str(field(ev, "eventCode")) ?? "EVENT"}:${str(field(ev, "carrierEventTime")) ?? ""}:${str(field(ev, "trackingSeq")) ?? ""}`
}
/** Map one trackings[] item -> tracking_events row. Null if no timestamp. */
export function mapSvTracking(
  bookingId: string, containerNo: string, carrierCode: string | null, ev: JsonRecord,
): TrackingEventRow | null {
  const dt = toIso(field(ev, "carrierEventTime"))
  if (!dt) return null
  const status = str(field(ev, "eventStatus"))
  const imoRaw = str(field(ev, "imoNo"))
  return {
    booking_id: bookingId, container_no: containerNo,
    event_type_code: str(field(ev, "eventCode")) ?? "EVENT", event_datetime: dt,
    event_location: str(field(ev, "carrierLocationName")), partner_port_code: str(field(ev, "unlocode")),
    event_value: str(field(ev, "svEventDescription")), event_value2: str(field(ev, "locationType")),
    inbound_vessel_name: str(field(ev, "shipName")),
    inbound_vessel_imo: imoRaw && /^\d+$/.test(imoRaw) ? Number(imoRaw) : null,
    operator_scac: carrierCode, source: "seavantage",
    is_estimated: (status ?? "").toLowerCase() !== "actual",
    carrier_event_id: svEventId(containerNo, ev), raw: ev,
  }
}

export type VesselPositionRow = {
  imo: string | null; mmsi: string | null; ship_name: string | null; ship_type: string | null
  ship_type_size: string | null; nation_code: string | null; latitude: number; longitude: number
  speed_over_ground: number | null; course_over_ground: number | null; true_heading: number | null
  nvg_status: number | null; ais_destination: string | null; ais_eta: string | null
  position_timestamp: string; static_datetime: string | null; source: "seavantage"; raw: JsonRecord
}
/** Map one pastTrack[].positions[] item -> vessel_positions row. Null if no lat/lng/ts. */
export function mapSvPosition(track: JsonRecord, pos: JsonRecord): VesselPositionRow | null {
  const lat = num(field(pos, "latitude")), lng = num(field(pos, "longitude")), ts = toIso(field(pos, "timestamp"))
  if (lat === null || lng === null || !ts) return null
  return {
    imo: str(field(pos, "imoNo")) ?? str(field(track, "imoNo")),
    mmsi: str(field(pos, "mmsi")) ?? str(field(track, "mmsi")),
    ship_name: str(field(pos, "shipName")) ?? str(field(track, "shipName")),
    ship_type: str(field(track, "shipType")), ship_type_size: str(field(track, "shipTypeSize")),
    nation_code: str(field(track, "nationCode")), latitude: lat, longitude: lng,
    speed_over_ground: num(field(pos, "speedOverGround")), course_over_ground: num(field(pos, "courseOverGround")),
    true_heading: num(field(pos, "trueHeading")), nvg_status: num(field(pos, "nvgStatus")),
    ais_destination: str(field(pos, "aisDestination")), ais_eta: str(field(pos, "aisEta")),
    position_timestamp: ts, static_datetime: toIso(field(pos, "staticDateTime")),
    source: "seavantage", raw: pos,
  }
}

/** Walk a past-track response into flat event + position rows for one booking. */
export function extractSvRows(
  bookingId: string, containerNo: string, carrierCode: string | null, response: SvPastTrack | null,
): { events: TrackingEventRow[]; positions: VesselPositionRow[] } {
  const events: TrackingEventRow[] = []
  const positions: VesselPositionRow[] = []
  if (!response) return { events, positions }
  const hbls = (field(response, "hbls") as JsonRecord[] | null) ?? []
  for (const hbl of Array.isArray(hbls) ? hbls : []) {
    const containers = (field(hbl, "containers") as JsonRecord[] | null) ?? []
    for (const c of Array.isArray(containers) ? containers : []) {
      const cno = str(field(c, "containerNo")) ?? containerNo
      const trackings = (field(c, "trackings") as JsonRecord[] | null) ?? []
      for (const ev of Array.isArray(trackings) ? trackings : []) {
        const row = mapSvTracking(bookingId, cno, carrierCode, ev)
        if (row) events.push(row)
      }
    }
  }
  const pastTrack = (field(response, "pastTrack") as JsonRecord[] | null) ?? []
  for (const track of Array.isArray(pastTrack) ? pastTrack : []) {
    const posns = (field(track, "positions") as JsonRecord[] | null) ?? []
    for (const pos of Array.isArray(posns) ? posns : []) {
      const row = mapSvPosition(track, pos)
      if (row) positions.push(row)
    }
  }
  return { events, positions }
}
