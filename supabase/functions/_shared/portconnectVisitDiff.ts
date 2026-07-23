import type { JsonRecord } from "./portconnectClient.ts"
import { pcField } from "./portconnectClient.ts"
import { isLytteltonPort, nzlytEstimatedClearances, partnerPortCode } from "./portconnectFields.ts"
import type { VisitTimestamps } from "./portconnectVisitMap.ts"

export type DerivedRefreshEvent = {
  event_type_code: string
  event_datetime: string
  event_value: string | null
  event_value2: string | null
  is_estimated: boolean
  partner_port_code: string | null
  container_visit_id: number | null
}

type FieldSpec = {
  key: keyof VisitTimestamps
  setType: string
  valueAsEventValue?: boolean
}

const FIELD_SPECS: FieldSpec[] = [
  { key: "inbound_ata", setType: "VESSELARRIVAL" },
  { key: "discharged_at", setType: "DISCHARGE" },
  { key: "customs_release_at", setType: "CUSTOMSRELEASE" },
  { key: "mpi_release_at", setType: "MPIRELEASE" },
  { key: "line_release_at", setType: "LOPRELEASE" },
  { key: "last_free_at", setType: "LFTCHANGED", valueAsEventValue: true },
  { key: "vbs_slot_at", setType: "VBSCHANGED", valueAsEventValue: true },
  { key: "gate_out_at", setType: "GATEOUT" },
  { key: "delivered_at", setType: "DELIVERED" },
]

const ESTIMATED_RELEASE_TYPES = new Set(["CUSTOMSRELEASE", "MPIRELEASE", "LOPRELEASE"])

function isoEqual(a: string | null, b: string | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return new Date(a).getTime() === new Date(b).getTime()
}

function fieldChanged(prev: string | null, next: string | null): boolean {
  if (next == null && prev != null) return false
  return !isoEqual(prev, next)
}

function releaseIsEstimated(
  visit: JsonRecord,
  after: VisitTimestamps,
  setType: string,
): boolean {
  if (!ESTIMATED_RELEASE_TYPES.has(setType)) return false
  return nzlytEstimatedClearances(
    after.line_release_at,
    after.customs_release_at,
    after.mpi_release_at,
    partnerPortCode(visit),
  )
}

export function deriveRefreshEvents(
  visit: JsonRecord,
  before: VisitTimestamps,
  after: VisitTimestamps,
): DerivedRefreshEvent[] {
  const port = partnerPortCode(visit)
  const lyttelton = isLytteltonPort(port)
  const visitIdRaw = pcField(visit, "containerVisitId")
  const visitId = visitIdRaw != null ? Number(visitIdRaw) : null
  const out: DerivedRefreshEvent[] = []

  for (const spec of FIELD_SPECS) {
    const prev = before[spec.key]
    const next = after[spec.key]

    if (lyttelton && spec.key === "last_free_at" && !next) continue
    if (!fieldChanged(prev, next)) continue
    if (!next) continue

    out.push({
      event_type_code: spec.setType,
      event_datetime: next,
      event_value: spec.valueAsEventValue ? next : null,
      event_value2: null,
      is_estimated: releaseIsEstimated(visit, after, spec.setType),
      partner_port_code: port,
      container_visit_id: Number.isFinite(visitId) ? visitId : null,
    })
  }

  return out
}

export function countChangedFields(before: VisitTimestamps, after: VisitTimestamps): number {
  return FIELD_SPECS.filter((s) => fieldChanged(before[s.key], after[s.key])).length
}
