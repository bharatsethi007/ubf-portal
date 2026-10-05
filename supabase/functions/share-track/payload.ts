// Loads booking tracking data (service role) and assembles the customer-safe payload.
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2"
import { buildMilestones, buildStops } from "./milestones.ts"
import { seaPath, thin, unwrap } from "./route.ts"
import type { CtRow, EventRow, LngLat, PublicTrack } from "./types.ts"

type Port = { code: string; name: string | null; lat: number | null; lng: number | null }

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}

export async function buildPayload(db: SupabaseClient, link: { booking_id: string; expires_at: string; id: string; base_route: unknown }): Promise<PublicTrack> {
  const bid = link.booking_id
  const [bkQ, ctQ, bcQ, evQ, btQ] = await Promise.all([
    db.from("bookings").select("booking_ref,vessel,voyage,destination,eta,m_eta,delivery_date,container_return_date").eq("id", bid).maybeSingle(),
    db.from("container_tracking").select("container_no,container_type,iso_desc,port_code,discharge_port_name,inbound_vessel_name,operator_voyage_id,inbound_eta,inbound_ata,discharged_at,customs_release_at,mpi_release_at,line_release_at,gate_out_at,delivered_at,updated_at,load_port_name,load_port_code:raw->>loadPortCode,vessel_imo:raw->>inboundVesselIMONumber").eq("booking_id", bid),
    db.from("booking_containers").select("container_no,container_type").eq("booking_id", bid).order("sort_order"),
    db.from("tracking_events").select("source,event_type_code,event_datetime,event_location,partner_port_code,event_value2,is_estimated,inbound_vessel_name,inbound_vessel_imo,received_at").eq("booking_id", bid).in("source", ["seavantage", "carrier"]).order("event_datetime").limit(1000),
    db.from("booking_tracking").select("vessel_key,vessel_name,last_seavantage_sync,last_portconnect_sync,last_carrier_sync").eq("booking_id", bid).maybeSingle(),
  ])
  const bk = bkQ.data as Record<string, string | null> | null
  const ct = (ctQ.data ?? []) as (CtRow & { updated_at: string | null; load_port_name: string | null; load_port_code: string | null; vessel_imo: string | null })[]
  const events = (evQ.data ?? []) as EventRow[]
  const bt = btQ.data as Record<string, string | null> | null

  // Port names + coordinates.
  const destCode = (ct.find((c) => c.port_code)?.port_code ?? (bk?.destination && /^[A-Z]{5}$/.test(bk.destination) ? bk.destination : null))?.toUpperCase() ?? null
  const pcLoad = ct.find((c) => c.load_port_code)?.load_port_code?.toUpperCase() ?? null
  const codes = [...new Set([destCode, pcLoad, ...events.map((e) => e.partner_port_code?.toUpperCase())].filter(Boolean))] as string[]
  const { data: portRows } = codes.length ? await db.from("ports").select("code,name,lat,lng").in("code", codes) : { data: [] }
  const ports = new Map((portRows ?? []).map((p: Port) => [p.code.toUpperCase(), p]))
  const nameFor = (code: string | null, raw: string | null) => {
    const p = code ? ports.get(code) : null
    if (p?.name) return titleCase(p.name)
    return raw ? titleCase(raw.split(",")[0].trim()) : (code ?? "Unknown port")
  }
  const coordFor = (code: string | null): LngLat | null => {
    const p = code ? ports.get(code) : null
    return p && p.lat != null && p.lng != null ? [Number(p.lng), Number(p.lat)] : null
  }

  const stops = buildStops(events, destCode, nameFor)
  // No carrier / SeaVantage data yet: PortConnect's load port still gives an origin.
  if (!stops.some((s) => s.role === "origin") && pcLoad) {
    stops.unshift({ code: pcLoad, name: nameFor(pcLoad, ct.find((c) => c.load_port_name)?.load_port_name ?? null), role: "origin", first: -Infinity, events: new Map(), estimates: new Map() })
  }
  const destName = ct.find((c) => c.discharge_port_name)?.discharge_port_name
    ?? stops.find((s) => s.role === "destination")?.name ?? nameFor(destCode, bk?.destination ?? null)
  if (!stops.some((s) => s.role === "destination")) {
    stops.push({ code: destCode, name: destName, role: "destination", first: Infinity, events: new Map(), estimates: new Map() })
  }
  const { milestones, status, eta } = buildMilestones(stops, ct, {
    eta: bk?.eta ?? bk?.m_eta ?? null, delivery_date: bk?.delivery_date ?? null, container_return_date: bk?.container_return_date ?? null,
  }, destName)

  // Current vessel = latest vessel carrying the box.
  const lastImo = [...events].reverse().find((e) => e.inbound_vessel_imo)?.inbound_vessel_imo ?? null
  const vesselKey = bt?.vessel_key || (lastImo ? String(lastImo) : null) || ct.find((c) => c.vessel_imo)?.vessel_imo || null
  const sailing = status === "sailing" || status === "booked"

  let pos: Record<string, unknown> | null = null
  if (vesselKey) {
    const { data } = await db.from("vessel_positions_latest").select("ship_name,latitude,longitude,speed_over_ground,course_over_ground,true_heading,position_timestamp").eq("vessel_key", vesselKey).maybeSingle()
    pos = data
  }

  // Sailed track: each vessel's AIS points inside the window it carried the box.
  const windows = new Map<string, { from: string; to: string }>()
  for (const e of events) {
    if (!e.inbound_vessel_imo || e.is_estimated !== false) continue
    const k = String(e.inbound_vessel_imo), w = windows.get(k)
    if (!w) windows.set(k, { from: e.event_datetime, to: e.event_datetime })
    else { if (e.event_datetime < w.from) w.from = e.event_datetime; if (e.event_datetime > w.to) w.to = e.event_datetime }
  }
  const nowIso = new Date().toISOString()
  if (vesselKey && sailing) {
    const w = windows.get(vesselKey)
    const dep = milestones.find((m) => m.done && (m.key === "departed" || m.key.startsWith("ts-")))
    windows.set(vesselKey, { from: w?.from ?? dep?.at ?? new Date(Date.now() - 30 * 864e5).toISOString(), to: nowIso })
  } else if (vesselKey && !windows.size) {
    // No per-leg vessel data: show the final vessel's leg from last departure to arrival.
    const deps = milestones.filter((m) => m.done && m.at && (m.key === "departed" || m.key.startsWith("ts-")))
    const from = deps.at(-1)?.at
    if (from) windows.set(vesselKey, { from, to: eta.actual ?? nowIso })
  }
  if (vesselKey && !windows.size) {
    // No carrier/SeaVantage events (e.g. PortConnect-only): same voyage window as the staff map
    // (last AIS fix near POL -> arrival + 12h).
    const { data: rt } = await db.rpc("get_booking_vessel_route", { p_booking_id: bid })
    const w = (rt as { window?: { from?: string; to?: string } } | null)?.window
    if (w?.from && w?.to) windows.set(vesselKey, { from: w.from, to: w.to })
  }
  const trackPts: { t: string; c: LngLat }[] = []
  await Promise.all([...windows].map(async ([k, w]) => {
    const { data } = await db.from("vessel_positions").select("latitude,longitude,position_timestamp")
      .eq("vessel_key", k).gte("position_timestamp", w.from).lte("position_timestamp", w.to).order("position_timestamp").limit(5000)
    for (const p of data ?? []) trackPts.push({ t: p.position_timestamp as string, c: [Number(p.longitude), Number(p.latitude)] })
  }))
  trackPts.sort((a, b) => (a.t < b.t ? -1 : 1))
  const track = unwrap(thin(trackPts.map((p) => p.c)))

  // Remaining (dashed) route: vessel -> ports not yet departed -> destination.
  const stopCoords = stops.map((s) => ({ ...s, coord: coordFor(s.code) }))
  // Only show a live dot when the AIS fix is recent (72h).
  const fresh = pos?.position_timestamp && Date.now() - new Date(pos.position_timestamp as string).getTime() < 72 * 3600_000
  const here: LngLat | null = pos && fresh && sailing && pos.latitude != null ? [Number(pos.longitude), Number(pos.latitude)] : null
  let remaining: LngLat[] = [], nmToGo: number | null = null
  if (here && status === "sailing") {
    const departed = (s: typeof stopCoords[number]) => s.events.get("departed")?.estimated === false
    const ahead = stopCoords.filter((s) => s.role !== "origin" && s.coord && !departed(s)).map((s) => s.coord!) as LngLat[]
    const r = seaPath([here, ...ahead])
    remaining = r.coords; nmToGo = r.nm
  }
  let planned = (link.base_route as LngLat[] | null) ?? []
  const hasEnds = stopCoords.some((s) => s.role === "origin" && s.coord) && stopCoords.some((s) => s.role === "destination" && s.coord)
  if (!planned.length && hasEnds) {
    const pts = stopCoords.map((s) => s.coord).filter(Boolean) as LngLat[]
    if (pts.length >= 2) {
      planned = seaPath(pts).coords
      await db.from("booking_share_links").update({ base_route: planned }).eq("id", link.id)
    }
  }

  const originStop = stopCoords.find((s) => s.role === "origin") ?? null
  const destStop = stopCoords.find((s) => s.role === "destination") ?? null
  const containers = ((bcQ.data ?? []) as { container_no: string; container_type: string | null }[])
    .filter((c) => c.container_no)
    .map((c) => ({ no: c.container_no.toUpperCase(), type: ct.find((x) => x.container_no === c.container_no)?.iso_desc ?? c.container_type }))

  const stamps = [bt?.last_seavantage_sync, bt?.last_portconnect_sync, bt?.last_carrier_sync, ...ct.map((c) => c.updated_at)].filter(Boolean) as string[]
  const heading = pos ? Number((pos.true_heading as number) > 0 && (pos.true_heading as number) < 360 ? pos.true_heading : pos.course_over_ground) : null

  return {
    ref: bk?.booking_ref ?? null,
    status,
    origin: { code: originStop?.code ?? null, name: originStop?.name ?? null, coord: originStop?.coord ?? null },
    destination: { code: destStop?.code ?? destCode, name: destName, coord: destStop?.coord ?? coordFor(destCode) },
    eta,
    vessel: {
      name: (pos?.ship_name as string) ?? ct.find((c) => c.inbound_vessel_name)?.inbound_vessel_name ?? bt?.vessel_name ?? bk?.vessel ?? null,
      voyage: bk?.voyage ?? ct.find((c) => c.operator_voyage_id)?.operator_voyage_id ?? null,
      position: here,
      speed_kn: here && pos?.speed_over_ground != null ? Math.round(Number(pos.speed_over_ground) * 10) / 10 : null,
      heading: here && Number.isFinite(heading) ? heading : null,
      position_at: here ? (pos?.position_timestamp as string) ?? null : null,
      nm_to_go: nmToGo,
    },
    containers,
    milestones,
    stops: stopCoords.map((s) => ({ code: s.code, name: s.name, coord: s.coord, role: s.role })),
    track, remaining, planned,
    updated_at: stamps.sort().at(-1) ?? null,
    expires_at: link.expires_at,
  }
}
