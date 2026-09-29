// Customer-safe tracker payload for an ERP consol. Same shape as share-track's booking payload.
// Sources merged: SeaVantage events on the consol, plus carrier / SeaVantage events and PortConnect rows
// from console bookings linked to any house in the consol. Vessel falls back to an AIS match on the ERP vessel name.
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2"
import { buildMilestones, buildStops } from "../share-track/milestones.ts"
import { seaPath, thin, unwrap } from "../share-track/route.ts"
import type { CtRow, EventRow, LngLat, PublicTrack } from "../share-track/types.ts"

type Port = { code: string; name: string | null; lat: number | null; lng: number | null }
export type ConsolLink = { id: string; consol_key: string; expires_at: string; base_route: unknown }
export type ConsolTrack = PublicTrack & { live: boolean }

const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
const mode = <T,>(xs: (T | null | undefined)[]): T | null => {
  const n = new Map<T, number>()
  for (const x of xs) if (x != null) n.set(x, (n.get(x) ?? 0) + 1)
  return [...n].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}
/** "KOTA SATRIA 0123S" -> "KOTA SATRIA" */
export const vesselBaseName = (v: string | null) =>
  (v ?? "").toUpperCase().split(/\s+/).filter((w) => w && !/\d/.test(w) && w !== "V" && w !== "VOY").join(" ") || null

export async function buildConsolPayload(db: SupabaseClient, link: ConsolLink): Promise<ConsolTrack> {
  const key = link.consol_key
  const { data: shipRows } = await db.from("shipments")
    .select("job_unique,module,origin,destination,etd,eta,departed,arrived,vessel_flight").eq("consol_key", key)
  const ships = (shipRows ?? []) as Record<string, string | null>[]
  const jobIds = ships.map((s) => Number(s.job_unique))

  const [bkQ, boxQ, cevQ, ctlQ] = await Promise.all([
    jobIds.length ? db.from("bookings").select("id,delivery_date,container_return_date,voyage").in("shipment_id", jobIds) : Promise.resolve({ data: [] }),
    db.from("containers").select("c_number,container_size").eq("consol_key", key),
    db.from("consol_tracking_events").select("source,event_type_code,event_datetime,event_location,partner_port_code,event_value2,is_estimated,inbound_vessel_name,inbound_vessel_imo,received_at").eq("consol_key", key).order("event_datetime").limit(1000),
    db.from("consol_tracking").select("vessel_key,vessel_name,last_sv_sync").eq("consol_key", key).maybeSingle(),
  ])
  const bookings = (bkQ.data ?? []) as { id: string; delivery_date: string | null; container_return_date: string | null; voyage: string | null }[]
  const bids = bookings.map((b) => b.id)
  const boxes = [...new Map(((boxQ.data ?? []) as { c_number: string; container_size: string | null }[])
    .filter((b) => b.c_number).map((b) => [b.c_number.replace(/\s/g, "").toUpperCase(), b.container_size])).entries()]

  const [bevQ, ctQ] = bids.length ? await Promise.all([
    db.from("tracking_events").select("source,event_type_code,event_datetime,event_location,partner_port_code,event_value2,is_estimated,inbound_vessel_name,inbound_vessel_imo,received_at").in("booking_id", bids).in("source", ["seavantage", "carrier"]).order("event_datetime").limit(1000),
    db.from("container_tracking").select("container_no,container_type,iso_desc,port_code,discharge_port_name,inbound_vessel_name,operator_voyage_id,inbound_eta,inbound_ata,discharged_at,customs_release_at,mpi_release_at,line_release_at,gate_out_at,delivered_at,updated_at,load_port_name,load_port_code:raw->>loadPortCode,vessel_imo:raw->>inboundVesselIMONumber").in("booking_id", bids),
  ]) : [{ data: [] }, { data: [] }]

  const events = [...(cevQ.data ?? []), ...(bevQ.data ?? [])].sort((a, b) => (a.event_datetime < b.event_datetime ? -1 : 1)) as EventRow[]
  const boxSet = new Set(boxes.map(([no]) => no))
  const ctAll = (ctQ.data ?? []) as (CtRow & { updated_at: string | null; load_port_name: string | null; load_port_code: string | null; vessel_imo: string | null })[]
  // One row per container (a box can sit on several linked house bookings).
  const ct = [...new Map(ctAll.filter((c) => !boxSet.size || boxSet.has(c.container_no.toUpperCase())).map((c) => [c.container_no.toUpperCase(), c])).values()]
  const ctl = ctlQ.data as { vessel_key: string | null; vessel_name: string | null; last_sv_sync: string | null } | null

  const originCode = mode(ships.map((s) => s.origin?.toUpperCase()))
  const erpDest = mode(ships.map((s) => s.destination?.toUpperCase()))
  const eta = ships.map((s) => s.eta).filter(Boolean).sort().at(-1) ?? null
  const erpVessel = mode(ships.map((s) => s.vessel_flight))

  const destCode = (ct.find((c) => c.port_code)?.port_code ?? (erpDest && /^[A-Z]{5}$/.test(erpDest) ? erpDest : null))?.toUpperCase() ?? null
  const pcLoad = ct.find((c) => c.load_port_code)?.load_port_code?.toUpperCase() ?? null
  const loadCode = pcLoad ?? (originCode && /^[A-Z]{5}$/.test(originCode) ? originCode : null)
  const codes = [...new Set([destCode, loadCode, ...events.map((e) => e.partner_port_code?.toUpperCase())].filter(Boolean))] as string[]
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
  if (!stops.some((s) => s.role === "origin") && loadCode) {
    stops.unshift({ code: loadCode, name: nameFor(loadCode, ct.find((c) => c.load_port_name)?.load_port_name ?? null), role: "origin", first: -Infinity, events: new Map(), estimates: new Map() })
  }
  const destName = ct.find((c) => c.discharge_port_name)?.discharge_port_name
    ?? stops.find((s) => s.role === "destination")?.name ?? nameFor(destCode, erpDest)
  if (!stops.some((s) => s.role === "destination")) {
    stops.push({ code: destCode, name: destName, role: "destination", first: Infinity, events: new Map(), estimates: new Map() })
  }
  const lastDate = (k: "delivery_date" | "container_return_date") => bookings.map((b) => b[k]).filter(Boolean).sort().at(-1) ?? null
  const { milestones, status, eta: etaOut } = buildMilestones(stops, ct, {
    eta, delivery_date: lastDate("delivery_date"), container_return_date: lastDate("container_return_date"),
  }, destName)

  // Vessel: latest carrying IMO, else the worker's vessel key, else an AIS name match on the ERP vessel.
  const lastImo = [...events].reverse().find((e) => e.inbound_vessel_imo)?.inbound_vessel_imo ?? null
  let vesselKey = (lastImo ? String(lastImo) : null) || ctl?.vessel_key || ct.find((c) => c.vessel_imo)?.vessel_imo || null
  const sailing = status === "sailing" || status === "booked"
  let pos: Record<string, unknown> | null = null
  const posCols = "vessel_key,ship_name,latitude,longitude,speed_over_ground,course_over_ground,true_heading,position_timestamp"
  if (vesselKey) {
    const { data } = await db.from("vessel_positions_latest").select(posCols).eq("vessel_key", vesselKey).maybeSingle()
    pos = data
  } else if (vesselBaseName(erpVessel) && sailing && (!eta || eta >= new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10))) {
    // Name match only while the ERP says the vessel is still due; afterwards the ship is on other voyages.
    const { data } = await db.from("vessel_positions_latest").select(posCols).ilike("ship_name", vesselBaseName(erpVessel)!).order("position_timestamp", { ascending: false }).limit(1)
    pos = data?.[0] ?? null
    vesselKey = (pos?.vessel_key as string) ?? null
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
  const erpDep = ships.map((s) => s.departed ?? s.etd).filter(Boolean).sort()[0] ?? null
  if (vesselKey && sailing) {
    const w = windows.get(vesselKey)
    const dep = milestones.find((m) => m.done && (m.key === "departed" || m.key.startsWith("ts-")))
    // Without carrier events, stop the track shortly after the ERP ETA so later voyages don't show.
    const cap = !events.length && eta ? new Date(Date.parse(`${eta}T00:00:00Z`) + 3 * 864e5).toISOString() : nowIso
    windows.set(vesselKey, { from: w?.from ?? dep?.at ?? (erpDep ? `${erpDep}T00:00:00Z` : new Date(Date.now() - 30 * 864e5).toISOString()), to: cap < nowIso ? cap : nowIso })
  }
  const trackPts: { t: string; c: LngLat }[] = []
  await Promise.all([...windows].map(async ([k, w]) => {
    const { data } = await db.from("vessel_positions").select("latitude,longitude,position_timestamp")
      .eq("vessel_key", k).gte("position_timestamp", w.from).lte("position_timestamp", w.to).order("position_timestamp").limit(5000)
    for (const p of data ?? []) trackPts.push({ t: p.position_timestamp as string, c: [Number(p.longitude), Number(p.latitude)] })
  }))
  trackPts.sort((a, b) => (a.t < b.t ? -1 : 1))
  const track = unwrap(thin(trackPts.map((p) => p.c)))

  const stopCoords = stops.map((s) => ({ ...s, coord: coordFor(s.code) }))
  const fresh = pos?.position_timestamp && Date.now() - new Date(pos.position_timestamp as string).getTime() < 72 * 3600_000
  const here: LngLat | null = pos && fresh && sailing && pos.latitude != null ? [Number(pos.longitude), Number(pos.latitude)] : null
  let remaining: LngLat[] = [], nmToGo: number | null = null
  if (here) {
    const departed = (s: typeof stopCoords[number]) => s.events.get("departed")?.estimated === false
    const ahead = stopCoords.filter((s) => s.role !== "origin" && s.coord && !departed(s)).map((s) => s.coord!) as LngLat[]
    const r = seaPath([here, ...ahead])
    remaining = r.coords; nmToGo = r.nm
  }
  // Live AIS on the carrying vessel means it has sailed, even before the carrier posts a departure.
  let finalStatus = status
  if (here && status === "booked" && erpDep && erpDep <= nowIso.slice(0, 10)) {
    finalStatus = "sailing"
    const dep = milestones.find((m) => m.key === "departed")
    if (dep) { dep.done = true; dep.current = false; dep.at = dep.at ?? `${erpDep}T00:00:00Z`; dep.estimated = false }
    const next = milestones.find((m) => !m.done)
    if (next) next.current = true
  }

  let planned = (link.base_route as LngLat[] | null) ?? []
  const pts = stopCoords.map((s) => s.coord).filter(Boolean) as LngLat[]
  if (!planned.length && pts.length >= 2) {
    planned = seaPath(pts).coords
    await db.from("consol_share_links").update({ base_route: planned }).eq("id", link.id)
  }

  const originStop = stopCoords.find((s) => s.role === "origin") ?? null
  const destStop = stopCoords.find((s) => s.role === "destination") ?? null
  const stamps = [ctl?.last_sv_sync, ...ct.map((c) => c.updated_at), events.at(-1)?.received_at].filter(Boolean) as string[]
  const heading = pos ? Number((pos.true_heading as number) > 0 && (pos.true_heading as number) < 360 ? pos.true_heading : pos.course_over_ground) : null

  return {
    ref: key,
    status: finalStatus,
    live: events.length > 0 || ct.length > 0 || Boolean(here),
    origin: { code: originStop?.code ?? null, name: originStop?.name ?? null, coord: originStop?.coord ?? null },
    destination: { code: destStop?.code ?? destCode, name: destName, coord: destStop?.coord ?? coordFor(destCode) },
    eta: etaOut,
    vessel: {
      name: (pos?.ship_name as string) ?? ct.find((c) => c.inbound_vessel_name)?.inbound_vessel_name ?? ctl?.vessel_name ?? erpVessel ?? null,
      voyage: bookings.find((b) => b.voyage)?.voyage ?? ct.find((c) => c.operator_voyage_id)?.operator_voyage_id ?? null,
      position: here,
      speed_kn: here && pos?.speed_over_ground != null ? Math.round(Number(pos.speed_over_ground) * 10) / 10 : null,
      heading: here && Number.isFinite(heading) ? heading : null,
      position_at: here ? (pos?.position_timestamp as string) ?? null : null,
      nm_to_go: nmToGo,
    },
    containers: boxes.map(([no, size]) => ({ no, type: ct.find((x) => x.container_no.toUpperCase() === no)?.iso_desc ?? size })),
    milestones,
    stops: stopCoords.map((s) => ({ code: s.code, name: s.name, coord: s.coord, role: s.role })),
    track, remaining, planned,
    updated_at: stamps.sort().at(-1) ?? null,
    expires_at: link.expires_at,
  }
}
