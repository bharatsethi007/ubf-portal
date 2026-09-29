// Background SeaVantage refresh for ERP consols (cron, service role).
// Registration is billable: one ref per consol (the carrier MBL, else the first container), capped per run.
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2"
import { extractSvRows, fetchPastTrack, registerCargo, type SvCreds, type SvRef } from "../seavantage-refresh/seaVantageClient.ts"
import { insertPositions } from "../seavantage-refresh/seavantageRefreshRun.ts"

type Candidate = {
  consol_key: string; module: string; line_code: string; sv_carrier_code: string
  ref_kind: "mbl" | "container"; refs: string[]; registered: string[]; vessel: string | null
}

export type RunSummary = {
  candidates: number; refreshed: number; registered: number; events: number; positions: number
  no_data: string[]; errors: string[]; stopped?: string
}

const refOf = (kind: string, value: string): SvRef => (kind === "mbl" ? { mblNo: value } : { containerNo: value })

async function saveEvents(db: SupabaseClient, consolKey: string, rows: ReturnType<typeof extractSvRows>["events"]): Promise<number> {
  if (!rows.length) return 0
  const mapped = rows.map(({ booking_id: _b, ...r }) => ({ ...r, consol_key: consolKey }))
  const { data, error } = await db.from("consol_tracking_events")
    .upsert(mapped, { onConflict: "consol_key,carrier_event_id", ignoreDuplicates: true }).select("id")
  if (error) throw new Error(error.message)
  return data?.length ?? 0
}

export async function runConsolRefresh(
  db: SupabaseClient, creds: SvCreds, opts: { limit: number; maxNew: number; consol?: string | null },
): Promise<RunSummary> {
  const out: RunSummary = { candidates: 0, refreshed: 0, registered: 0, events: 0, positions: 0, no_data: [], errors: [] }
  const { data, error } = await db.rpc("consol_track_candidates", {
    p_limit: opts.consol ? 5000 : opts.limit, p_min_age: opts.consol ? "0 seconds" : "3 hours",
  })
  if (error) throw new Error(error.message)
  let list = (data ?? []) as Candidate[]
  if (opts.consol) list = list.filter((c) => c.consol_key === opts.consol)
  out.candidates = list.length

  for (const c of list) {
    const ranAt = new Date().toISOString()
    const done = new Set(c.registered ?? [])
    // One ref per consol keeps cost to one registration; keep any already registered.
    const refs = c.ref_kind === "mbl" ? c.refs.slice(0, 1) : (done.size ? c.refs.filter((r) => done.has(r)) : c.refs.slice(0, 1))
    let found = 0, svError: string | null = null, vesselKey: string | null = null, vesselName: string | null = null

    for (const ref of refs) {
      if (!done.has(ref)) {
        if (out.registered >= opts.maxNew) { out.stopped = `registration cap ${opts.maxNew} reached`; break }
        const reg = await registerCargo(creds, c.sv_carrier_code, refOf(c.ref_kind, ref))
        if (reg.status === 401 || reg.status === 403 || reg.status === 429) {
          out.stopped = `SeaVantage ${reg.status}`
          out.errors.push(`${c.consol_key}: SeaVantage ${reg.status}`)
          return out
        }
        // A 4xx other than auth means SeaVantage rejected this ref; don't retry it every run.
        if (reg.ok || (reg.status >= 400 && reg.status < 500)) {
          await db.from("consol_sv_registrations").upsert({
            consol_key: c.consol_key, ref, ref_kind: c.ref_kind, sv_carrier_code: c.sv_carrier_code, document_id: reg.data?.documentId ?? null,
          }, { onConflict: "consol_key,ref", ignoreDuplicates: true })
          done.add(ref)
          if (reg.ok) out.registered += 1
          else svError = `SeaVantage refused ${ref} (${reg.status}${reg.message ? `: ${reg.message}` : ""})`
        }
      }
      const pt = await fetchPastTrack(creds, refOf(c.ref_kind, ref))
      if (!pt.ok || !pt.data) { out.no_data.push(`${c.consol_key}:${ref}`); continue }
      const { events, positions } = extractSvRows("", ref, c.sv_carrier_code, pt.data)
      if (!events.length && !positions.length) { out.no_data.push(`${c.consol_key}:${ref}`); continue }
      found += 1
      try {
        out.events += await saveEvents(db, c.consol_key, events)
        out.positions += await insertPositions(db, positions)
      } catch (e) {
        out.errors.push(`${c.consol_key}: ${e instanceof Error ? e.message : String(e)}`)
      }
      const lastVessel = [...events].reverse().find((e) => e.inbound_vessel_imo)
      if (lastVessel) { vesselKey = String(lastVessel.inbound_vessel_imo); vesselName = lastVessel.inbound_vessel_name }
      const lastPos = positions.at(-1)
      if (!vesselKey && lastPos) { vesselKey = lastPos.imo ?? lastPos.mmsi; vesselName = lastPos.ship_name }
    }

    await db.from("consol_tracking").upsert({
      consol_key: c.consol_key, module: c.module, enabled: true, line_code: c.line_code, sv_carrier_code: c.sv_carrier_code,
      sv_ref_kind: c.ref_kind, sv_refs: [...done], last_sv_sync: ranAt,
      sv_error: svError ?? (found ? null : "No SeaVantage data yet"),
      ...(vesselKey ? { vessel_key: vesselKey, vessel_name: vesselName } : {}),
    }, { onConflict: "consol_key" })
    out.refreshed += 1
    if (out.stopped) break
  }
  return out
}
