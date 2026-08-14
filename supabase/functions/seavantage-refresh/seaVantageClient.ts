// SeaVantage Insight client + mappers (Basic Auth).
// Two-step model: POST /cargo registers a cargo (billable — do once) by MBL, booking, or container;
// GET /cargo/search/past-track returns container events + AIS pastTrack positions for the same ref.
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
function deepFind(obj: unknown, key: string): unknown {
  const target = key.toLowerCase()
  const stack: unknown[] = [obj]
  while (stack.length) {
    const cur = stack.pop()
    if (cur && typeof cur === "object") {
      for (const [k, v] of Object.entries(cur as Record<string, unknown>)) {
        if (k.toLowerCase() === target && v !== null && v !== undefined && v !== "") return v
        if (v && typeof v === "object") stack.push(v)
      }
    }
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
function toIso(v: unknown): string | null {
  const s = str(v)
  if (!s) return null
  const d = new Date(s.includes("T") ? s : s.replace(" ", "T") + "Z")
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export type SvResult<T> = { status: number; ok: boolean; data: T | null; message?: string }
export type SvRef = { containerNo?: string; mblNo?: string; bookingNo?: string }

export async function registerCargo(
  creds: SvCreds, carrierCode: string, ref: SvRef,
): Promise<SvResult<{ documentId: string | null }>> {
  const payload: JsonRecord = { carrierCode }
  if (ref.mblNo) payload.mblNo = ref.mblNo
  else if (ref.bookingNo) payload.bookingNo = ref.bookingNo
  else if (ref.containerNo) payload.containerNo = ref.containerNo
  const res = await fetch(`${baseUrl()}/cargo`, {
    method: "POST",
    headers: { Authorization: authHeader(creds), "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  })
  const body = (await res.json().catch(() => ({}))) as JsonRecord
  const documentId = str(deepFind(body, "documentId")) ?? str(deepFind(body, "documentID")) ?? str(deepFind(body, "id"))
  return { status: res.status, ok: res.ok, data: { documentId }, message: str(deepFind(body, "message")) ?? undefined }
}

export type SvPastTrack = JsonRecord
export async function fetchPastTrack(creds: SvCreds, ref: SvRef): Promise<SvResult<SvPastTrack>> {
  const url = new URL(`${baseUrl()}/cargo/search/past-track`)
  if (ref.mblNo) url.searchParams.set("mblNo", ref.mblNo)
  else if (ref.bookingNo) url.searchParams.set("bookingNo", ref.bookingNo)
  else if (ref.containerNo) url.searchParams.set("containerNo", ref.containerNo)
  const res = await fetch(url.toString(), { headers: { Authorization: authHeader(creds), Accept: "application/json" } })
  const body = (await res.json().catch(() => ({}))) as JsonRecord
  const candidates = [body.response, body.data, body.result, body]
  let payload: JsonRecord | null = null
  for (const cand of candidates) {
    if (cand && typeof cand === "object") {
      const cc = cand as JsonRecord
      if ("hbls" in cc || "pastTrack" in cc || "trackings" in cc || "cargo" in cc) { payload = cc; break }
    }
  }
  if (!payload && body && typeof body === "object") payload = body
  return { status: res.status, ok: res.ok, data: payload, message: str(deepFind(body, "message")) ?? undefined }
}

export type TrackingEventRow = {
  booking_id: string; container_no: string | null; event_type_code: string; event_datetime: string
  event_location: string | null; partner_port_code: string | null; event_value: string | null; event_value2: string | null
  inbound_vessel_name: string | null; inbound_vessel_imo: number | null; operator_scac: string | null
  source: "seavantage"; is_estimated: boolean; carrier_event_id: string | null; raw: JsonRecord
}
function svEventId(containerNo: string, ev: JsonRecord): string {
  return `SV:${containerNo}:${str(field(ev, "eventCode")) ?? "EVENT"}:${str(field(ev, "carrierEventTime")) ?? ""}:${str(field(ev, "trackingSeq")) ?? ""}`
}
export function mapSvTracking(
  bookingId: string, containerNo: string, carrierCode: string | null, ev: JsonRecord,
): TrackingEventRow | null {
  const dt = toIso(field(ev, "carrierEventTime", "eventTime", "eventDate", "actualTime", "estimatedTime"))
  if (!dt) return null
  const status = str(field(ev, "eventStatus", "status"))
  const imoRaw = str(field(ev, "imoNo", "imo"))
  return {
    booking_id: bookingId, container_no: containerNo,
    event_type_code: str(field(ev, "eventCode", "event", "statusCode")) ?? "EVENT", event_datetime: dt,
    event_location: str(field(ev, "carrierLocationName", "locationName", "location", "portName")),
    partner_port_code: str(field(ev, "unlocode", "unLocode", "portCode")),
    event_value: str(field(ev, "svEventDescription", "eventDescription", "description", "containerEvent")),
    event_value2: str(field(ev, "locationType", "eventType")),
    inbound_vessel_name: str(field(ev, "shipName", "vesselName", "vessel")),
    inbound_vessel_imo: imoRaw && /^\d+$/.test(imoRaw) ? Number(imoRaw) : null,
    operator_scac: carrierCode, source: "seavantage",
    is_estimated: (status ?? "").toLowerCase() !== "actual" && (status ?? "").toLowerCase() !== "a",
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
export function mapSvPosition(track: JsonRecord, pos: JsonRecord): VesselPositionRow | null {
  const lat = num(field(pos, "latitude", "lat")), lng = num(field(pos, "longitude", "lng", "lon")), ts = toIso(field(pos, "timestamp", "time", "positionTime"))
  if (lat === null || lng === null || !ts) return null
  return {
    imo: str(field(pos, "imoNo", "imo")) ?? str(field(track, "imoNo", "imo")),
    mmsi: str(field(pos, "mmsi")) ?? str(field(track, "mmsi")),
    ship_name: str(field(pos, "shipName", "vesselName")) ?? str(field(track, "shipName", "vesselName")),
    ship_type: str(field(track, "shipType")), ship_type_size: str(field(track, "shipTypeSize")),
    nation_code: str(field(track, "nationCode")), latitude: lat, longitude: lng,
    speed_over_ground: num(field(pos, "speedOverGround", "sog")), course_over_ground: num(field(pos, "courseOverGround", "cog")),
    true_heading: num(field(pos, "trueHeading", "heading")), nvg_status: num(field(pos, "nvgStatus")),
    ais_destination: str(field(pos, "aisDestination", "destination")), ais_eta: str(field(pos, "aisEta")),
    position_timestamp: ts, static_datetime: toIso(field(pos, "staticDateTime")),
    source: "seavantage", raw: pos,
  }
}

export function extractSvRows(
  bookingId: string, containerNo: string, carrierCode: string | null, response: SvPastTrack | null,
): { events: TrackingEventRow[]; positions: VesselPositionRow[] } {
  const events: TrackingEventRow[] = []
  const positions: VesselPositionRow[] = []
  if (!response) return { events, positions }
  const containerArrays: JsonRecord[][] = []
  const hbls = (field(response, "hbls") as JsonRecord[] | null) ?? []
  for (const hbl of Array.isArray(hbls) ? hbls : []) {
    const cs = (field(hbl, "containers") as JsonRecord[] | null) ?? []
    if (Array.isArray(cs)) containerArrays.push(cs)
  }
  const topContainers = (field(response, "containers") as JsonRecord[] | null) ?? []
  if (Array.isArray(topContainers) && topContainers.length) containerArrays.push(topContainers)
  for (const cs of containerArrays) {
    for (const c of cs) {
      const cno = str(field(c, "containerNo", "containerNumber")) ?? containerNo
      const trackings = (field(c, "trackings", "events") as JsonRecord[] | null) ?? []
      for (const ev of Array.isArray(trackings) ? trackings : []) {
        const row = mapSvTracking(bookingId, cno, carrierCode, ev)
        if (row) events.push(row)
      }
    }
  }
  const topTrackings = (field(response, "trackings") as JsonRecord[] | null) ?? []
  for (const ev of Array.isArray(topTrackings) ? topTrackings : []) {
    const row = mapSvTracking(bookingId, containerNo, carrierCode, ev)
    if (row) events.push(row)
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
