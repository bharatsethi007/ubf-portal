// Turns raw carrier / SeaVantage / PortConnect data into 5 plain customer milestones.
import type { CtRow, Detail, EventRow, Milestone, TrackStatus } from "./types.ts"

type Key = "empty_out" | "gate_in" | "arrived" | "discharged" | "loaded" | "departed" | "gate_out" | "delivered" | "empty_returned"

const CODE: Record<string, Key> = {
  EE: "empty_out", I: "gate_in", GTIN: "gate_in", VA: "arrived", ARRI: "arrived",
  UV: "discharged", DISC: "discharged", AE: "loaded", LOAD: "loaded", VD: "departed", DEPA: "departed",
  OA: "gate_out", GTOT: "gate_out", D: "delivered", RD: "empty_returned",
}
const LABEL: Record<Key, string> = {
  empty_out: "Empty container collected", gate_in: "Received at terminal", arrived: "Vessel arrived",
  discharged: "Unloaded from vessel", loaded: "Loaded on vessel", departed: "Vessel departed",
  gate_out: "Collected from port", delivered: "Delivered", empty_returned: "Empty container returned",
}
const PORT_ORDER: Key[] = ["empty_out", "gate_in", "arrived", "discharged", "loaded", "departed"]

export type Pick = { at: string; estimated: boolean; imo: number | null; vessel: string | null }
export type Stop = {
  code: string | null
  name: string
  role: "origin" | "tranship" | "destination"
  first: number
  events: Map<Key, Pick>
  estimates: Map<Key, { at: string; received: number }[]>
}

const t = (s: string | null | undefined) => (s ? new Date(s).getTime() : NaN)

/** Group origin-side events into port stops, keeping the best (actual > newest estimate) per event type. */
export function buildStops(events: EventRow[], destCode: string | null, nameFor: (code: string | null, raw: string | null) => string): Stop[] {
  const stops = new Map<string, Stop>()
  const relevant = events.filter((e) => (e.source === "seavantage" || e.source === "carrier") && CODE[e.event_type_code?.toUpperCase()])
  for (const e of relevant) {
    const key = CODE[e.event_type_code.toUpperCase()]
    // Gate-out / delivery / empty return belong to the destination, wherever the depot is.
    const postDest = key === "gate_out" || key === "delivered" || key === "empty_returned"
    const code = postDest && destCode ? destCode.toUpperCase() : e.partner_port_code?.toUpperCase() ?? null
    const id = code ?? (e.event_location ?? "?").toUpperCase()
    let stop = stops.get(id)
    if (!stop) {
      const lt = postDest ? "POD" : (e.event_value2 ?? "").toUpperCase()
      const role = lt === "POL" ? "origin" : lt === "POD" ? "destination" : lt === "TS" ? "tranship" : "tranship"
      stop = { code, name: nameFor(code, e.event_location), role, first: t(e.event_datetime), events: new Map(), estimates: new Map() }
      stops.set(id, stop)
    }
    stop.first = Math.min(stop.first, t(e.event_datetime))
    const est = e.is_estimated !== false
    const cur = stop.events.get(key)
    const pick: Pick = { at: e.event_datetime, estimated: est, imo: e.inbound_vessel_imo, vessel: e.inbound_vessel_name }
    if (est) {
      const list = stop.estimates.get(key) ?? []
      list.push({ at: e.event_datetime, received: t(e.received_at) || 0 })
      stop.estimates.set(key, list)
    }
    if (!cur) { stop.events.set(key, pick); continue }
    if (cur.estimated && !est) { stop.events.set(key, pick); continue }
    if (cur.estimated && est) {
      const list = stop.estimates.get(key) ?? []
      const newest = list.reduce((a, b) => (b.received >= a.received ? b : a), list[0])
      if (newest) stop.events.set(key, { ...pick, at: newest.at })
    }
  }
  const out = [...stops.values()].sort((a, b) => a.first - b.first)
  // Carrier (DCSA) events carry no POL/POD tag: first port is origin, destination port is destination.
  if (out.length && !out.some((s) => s.role === "origin")) out[0].role = "origin"
  for (const s of out) {
    if (destCode && s.code === destCode.toUpperCase()) s.role = "destination"
    else if (s.role === "destination" && destCode && s.code && s.code !== destCode.toUpperCase()) s.role = "tranship"
  }
  return out
}

/** All containers done → latest time; otherwise null. */
function allDone(rows: CtRow[], f: keyof CtRow): string | null {
  if (!rows.length) return null
  let max: string | null = null
  for (const r of rows) {
    const v = r[f] as string | null
    if (!v) return null
    if (!max || t(v) > t(max)) max = v
  }
  return max
}
function firstOf(rows: CtRow[], f: keyof CtRow): string | null {
  let min: string | null = null
  for (const r of rows) {
    const v = r[f] as string | null
    if (v && (!min || t(v) < t(min))) min = v
  }
  return min
}

const d = (label: string, at: string | null, estimated = false): Detail => ({ label, at, estimated, done: Boolean(at) && !estimated })

export type BookingDates = { eta: string | null; delivery_date: string | null; container_return_date: string | null }

export function buildMilestones(stops: Stop[], ct: CtRow[], bk: BookingDates, destName: string) {
  const origin = stops.find((s) => s.role === "origin") ?? null
  const trans = stops.filter((s) => s.role === "tranship")
  const dest = stops.find((s) => s.role === "destination") ?? null
  const ms: Milestone[] = []

  const portDetails = (s: Stop): Detail[] => PORT_ORDER.filter((k) => s.events.has(k))
    .map((k) => { const p = s.events.get(k)!; return d(LABEL[k], p.at, p.estimated) })

  if (origin) {
    const dep = origin.events.get("departed")
    const shown = dep ?? origin.events.get("loaded")
    // Origin inferred from PortConnect only: the box is on an inbound manifest, so it has sailed.
    const inferred = origin.events.size === 0 && ct.length > 0
    ms.push({ key: "departed", title: "Departed", place: origin.name, at: shown?.at ?? null, estimated: inferred ? false : shown?.estimated ?? true,
      done: inferred || Boolean(dep && !dep.estimated), current: false, details: portDetails(origin) })
  }
  for (const s of trans) {
    const dep = s.events.get("departed") ?? s.events.get("arrived")
    ms.push({ key: `ts-${s.code ?? s.name}`, title: "Transhipment", place: s.name, at: dep?.at ?? null,
      estimated: dep?.estimated ?? true, done: Boolean(s.events.get("departed") && !s.events.get("departed")!.estimated),
      current: false, details: portDetails(s) })
  }

  // Destination arrival: PortConnect is the truth once in range, SeaVantage / carrier before that.
  const svArr = dest?.events.get("arrived")
  const ata = firstOf(ct, "inbound_ata") ?? (svArr && !svArr.estimated ? svArr.at : null)
  const pcEta = firstOf(ct, "inbound_eta")
  const predicted = ata ?? pcEta ?? svArr?.at ?? bk.eta
  const est = dest?.estimates.get("arrived") ?? []
  const scheduled = est.length ? est.reduce((a, b) => (b.received < a.received ? b : a), est[0]).at : (bk.eta ?? null)
  const discharged = allDone(ct, "discharged_at") ?? (dest?.events.get("discharged")?.estimated === false ? dest!.events.get("discharged")!.at : null)
  ms.push({ key: "arrived", title: "Arrived", place: destName, at: ata ?? predicted, estimated: !ata, done: Boolean(ata || discharged),
    current: false, details: [d("Vessel arrived", ata ?? predicted, !ata), d("Unloaded from vessel", discharged)] })

  // NZ often pre-clears before arrival: ready for pickup needs the box off the ship too.
  const customs = allDone(ct, "customs_release_at"), mpi = allDone(ct, "mpi_release_at"), line = allDone(ct, "line_release_at")
  const released = customs && mpi && line && discharged ? [customs, mpi, line, discharged].sort((a, b) => t(b) - t(a))[0] : null
  ms.push({ key: "released", title: "Ready for pickup", place: destName, at: released, estimated: false, done: Boolean(released),
    current: false, details: [d("Customs cleared", customs), d("Biosecurity cleared", mpi), d("Shipping line released", line)] })

  const svDel = dest?.events.get("delivered")
  const gateOut = allDone(ct, "gate_out_at") ?? (dest?.events.get("gate_out")?.estimated === false ? dest!.events.get("gate_out")!.at : null)
  const delivered = allDone(ct, "delivered_at") ?? (bk.delivery_date ? `${bk.delivery_date}T00:00:00Z` : null) ?? (svDel && !svDel.estimated ? svDel.at : null)
  const svRet = dest?.events.get("empty_returned")
  const returned = bk.container_return_date ? `${bk.container_return_date}T00:00:00Z` : (svRet && !svRet.estimated ? svRet.at : null)
  const doneAt = delivered ?? gateOut
  ms.push({ key: "delivered", title: "Delivered", place: null, at: doneAt, estimated: false, done: Boolean(doneAt), current: false,
    details: [d("Collected from port", gateOut), d("Delivered", delivered), d("Empty container returned", returned)] })

  // Backfill: a later milestone done means earlier ones are done too.
  for (let i = ms.length - 2; i >= 0; i--) if (ms[i + 1].done) ms[i].done = true
  const cur = ms.find((m) => !m.done)
  if (cur) cur.current = true

  const byKey = (k: string) => ms.find((m) => m.key === k)?.done
  const status: TrackStatus = byKey("delivered") ? "delivered" : byKey("released") ? "released"
    : byKey("arrived") ? "arrived" : ms[0]?.done ? "sailing" : "booked"

  const shownEta = ata ?? predicted
  const delay = shownEta && scheduled ? Math.round((t(shownEta) - t(scheduled)) / 3600000) : null
  return { milestones: ms, status, eta: { predicted, actual: ata, scheduled, delay_hours: delay } }
}
