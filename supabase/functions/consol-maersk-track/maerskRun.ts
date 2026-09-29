// Maersk consol refresh (cron, service role). Companion to consol-track (SeaVantage) for Maersk-carried consols. Free Maersk Track & Trace (DCSA): no registration, no cost.
// One call per consol by MBL (transportDocumentReference); falls back to the first container if the MBL returns nothing.
// Events land on consol_tracking_events with source 'carrier', which the tracker, portal and notifications already read.
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2"
import { fetchMaerskEvents, fetchMaerskToken, mapMaerskEvent, type MaerskCreds } from "../carrier-refresh/maerskClient.ts"

type Candidate = { consol_key: string; module: string; mbl: string | null; containers: string[] }
export type MaerskSummary = { candidates: number; refreshed: number; with_data: number; events: number; no_data: string[]; errors: string[]; stopped?: string }

export async function runMaerskConsolRefresh(
  db: SupabaseClient, creds: MaerskCreds, opts: { limit: number; consol?: string | null },
): Promise<MaerskSummary> {
  const out: MaerskSummary = { candidates: 0, refreshed: 0, with_data: 0, events: 0, no_data: [], errors: [] }
  const { data, error } = await db.rpc("consol_maersk_candidates", {
    p_limit: opts.consol ? 200 : opts.limit, p_min_age: opts.consol ? "0 seconds" : "3 hours",
  })
  if (error) throw new Error(error.message)
  let list = (data ?? []) as Candidate[]
  if (opts.consol) list = list.filter((c) => c.consol_key === opts.consol)
  out.candidates = list.length
  if (!list.length) return out

  let token: string
  try { token = await fetchMaerskToken(creds) } catch (e) {
    out.stopped = e instanceof Error ? e.message : String(e)
    return out
  }

  for (const c of list) {
    const ranAt = new Date().toISOString()
    let res = c.mbl ? await fetchMaerskEvents(creds, token, { transportDocumentReference: c.mbl }) : null
    let ref = c.mbl
    if ((!res || !res.events.length) && c.containers[0]) {
      ref = c.containers[0]
      res = await fetchMaerskEvents(creds, token, { equipmentReference: ref })
    }
    if (res && (res.status === 401 || res.status === 403 || res.status === 429)) {
      out.stopped = `Maersk ${res.status}`
      out.errors.push(`${c.consol_key}: Maersk ${res.status} ${res.message ?? ""}`.trim())
      break
    }
    const rows = (res?.events ?? []).map((ev) => mapMaerskEvent("", ref ?? "", "MAEU", ev)).filter((r) => r !== null)
      .map((r) => ({
        consol_key: c.consol_key, container_no: r!.container_no, event_type_code: r!.event_type_code, event_datetime: r!.event_datetime,
        event_location: r!.event_location, partner_port_code: r!.partner_port_code, event_value: r!.event_value, event_value2: r!.event_value2,
        inbound_vessel_name: r!.inbound_vessel_name, inbound_vessel_imo: r!.inbound_vessel_imo, operator_scac: r!.operator_scac,
        source: "carrier", is_estimated: r!.is_estimated, raw: r!.raw,
        // Upserts dedupe on (consol_key, carrier_event_id); build a stable id when Maersk sends none.
        carrier_event_id: r!.carrier_event_id ?? `MK:${r!.container_no ?? ""}:${r!.event_type_code}:${r!.event_datetime}:${r!.event_value2 ?? ""}`,
      }))

    if (rows.length) {
      const { data: ins, error: insErr } = await db.from("consol_tracking_events")
        .upsert(rows, { onConflict: "consol_key,carrier_event_id", ignoreDuplicates: true }).select("id")
      if (insErr) out.errors.push(`${c.consol_key}: ${insErr.message}`)
      else out.events += ins?.length ?? 0
      out.with_data += 1
    } else out.no_data.push(`${c.consol_key}:${ref ?? "-"}`)

    const lastVessel = [...rows].reverse().find((r) => r.inbound_vessel_imo)
    await db.from("consol_tracking").upsert({
      consol_key: c.consol_key, module: c.module, enabled: true, line_code: "MAERSK", sv_carrier_code: "MAEU",
      sv_ref_kind: ref === c.mbl ? "mbl" : "container", sv_refs: ref ? [ref] : [], last_sv_sync: ranAt,
      sv_error: rows.length ? null : res && res.status >= 400 && res.status !== 404 ? `Maersk ${res.status}` : "No Maersk data yet",
      ...(lastVessel ? { vessel_key: String(lastVessel.inbound_vessel_imo), vessel_name: lastVessel.inbound_vessel_name } : {}),
    }, { onConflict: "consol_key" })
    out.refreshed += 1
  }
  return out
}
