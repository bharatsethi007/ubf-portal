import type { SupabaseClient } from "jsr:@supabase/supabase-js@2"
import type { JsonRecord } from "./portconnectClient.ts"
import { asIso, asText, isLytteltonPort, visitField } from "./portconnectFields.ts"
import { normalizeIso6346Pill } from "./iso6346Normalize.ts"
import type { VisitTimestamps } from "./portconnectVisitMap.ts"

export type VisitBookingFields = VisitTimestamps & {
  inbound_eta: string | null
  operator_name: string | null
  discharge_port_name: string | null
  sea_port_gate_out_at: string | null
  inland_port_gate_out_at: string | null
  inland_port_gate_in_at: string | null
}

export type PortConnectTaskTrigger = "MPIRELEASE" | "GATEOUT" | "GATEIN_DEPOT"

const TASK_BY_TRIGGER: Record<PortConnectTaskTrigger, string> = {
  MPIRELEASE: "MPI/biosecurity cleared",
  GATEOUT: "Delivered",
  GATEIN_DEPOT: "Container dehired",
}

export function visitBookingFieldsFromVisit(visit: JsonRecord): VisitBookingFields {
  const seaOut = asIso(visitField(visit, "seaPortGateOutDateTime"))
  const inlandOut = asIso(visitField(visit, "inlandPortGateOutDateTime"))
  const inlandIn = asIso(visitField(visit, "inlandPortGateInDateTime"))
  const ata = asIso(visitField(visit, "inboundVesselActualArrivalDatetime", "seaPortArrivalDatetime"))
  const eta = asIso(visitField(visit, "inboundVesselPublishedArrivalDatetime"))

  return {
    inbound_ata: ata,
    inbound_eta: eta,
    discharged_at: asIso(visitField(visit, "dischargedDatetime")),
    customs_release_at: asIso(visitField(visit, "customsReleaseDatetime")),
    mpi_release_at: asIso(visitField(visit, "mpiReleaseDatetime")),
    line_release_at: asIso(visitField(visit, "lineReleaseDatetime")),
    last_free_at: asIso(visitField(visit, "lastFreeDatetime")),
    vbs_slot_at: asIso(visitField(visit, "vbsSlotDatetime")),
    gate_out_at: seaOut ?? inlandOut,
    delivered_at: asIso(visitField(visit, "deliveredDatetime")),
    operator_name: asText(visitField(visit, "containerOperatorName")),
    discharge_port_name: asText(visitField(visit, "dischargePortName")),
    sea_port_gate_out_at: seaOut,
    inland_port_gate_out_at: inlandOut,
    inland_port_gate_in_at: inlandIn,
  }
}

function toDateOnly(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null
  return iso.trim().slice(0, 10)
}

function setIfAllowed(
  patch: Record<string, unknown>,
  overrides: Record<string, boolean>,
  key: string,
  value: string | null | undefined,
): void {
  if (!value || overrides[key]) return
  patch[key] = value
}

export function bookingPatchFromVisitFields(
  visit: JsonRecord,
  fields: VisitBookingFields,
  overrides: Record<string, boolean>,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {}
  const port = visitField(visit, "portCode", "partnerPortCode")
  const lyttelton = isLytteltonPort(String(port ?? ""))

  const arrival = fields.inbound_ata ?? fields.inbound_eta
  setIfAllowed(patch, overrides, "m_eta", toDateOnly(arrival))
  setIfAllowed(patch, overrides, "m_shipping_line", fields.operator_name)
  setIfAllowed(patch, overrides, "m_discharge_port", fields.discharge_port_name)
  setIfAllowed(patch, overrides, "discharge_date", toDateOnly(fields.discharged_at))
  setIfAllowed(patch, overrides, "delivery_date", toDateOnly(fields.sea_port_gate_out_at))
  const containerReturn = fields.inland_port_gate_out_at ?? fields.inland_port_gate_in_at
  setIfAllowed(patch, overrides, "container_return_date", toDateOnly(containerReturn))
  if (!lyttelton) {
    setIfAllowed(patch, overrides, "last_free_day", toDateOnly(fields.last_free_at))
  }

  return patch
}

export function firstSealFromVisit(visit: JsonRecord): string | null {
  const seals = visitField(visit, "seals")
  if (!Array.isArray(seals) || !seals.length) return null
  const text = String(seals[0] ?? "").trim()
  return text || null
}

export function containerOverrideKey(containerNo: string): string {
  return `container:${containerNo.trim().toUpperCase()}`
}

export function containerPatchFromVisit(
  visit: JsonRecord,
  containerNo: string,
  overrides: Record<string, boolean>,
  existingSource: string | null | undefined,
): Record<string, unknown> | null {
  if (existingSource === "manual") return null
  if (overrides[containerOverrideKey(containerNo)]) return null

  const isoType = asText(visitField(visit, "containerIsoTypeCode"))
  const isoDesc = asText(visitField(visit, "containerIsoTypeDescription"))
  const containerType = normalizeIso6346Pill(isoType, isoDesc) ?? isoType
  const seal = firstSealFromVisit(visit)
  if (!containerType && !seal && !isoType) return null

  const patch: Record<string, unknown> = { source: "portconnect" }
  if (containerType) patch.container_type = containerType
  if (isoType) patch.iso_type_code = isoType
  if (seal) patch.seal_no = seal
  return patch
}

export async function completePortConnectTask(
  db: SupabaseClient,
  bookingId: string,
  trigger: PortConnectTaskTrigger,
): Promise<boolean> {
  const title = TASK_BY_TRIGGER[trigger]
  const { data: tasks, error } = await db
    .from("booking_tasks")
    .select("id, title, status")
    .eq("booking_id", bookingId)
    .eq("is_default", true)
  if (error) throw new Error(error.message)

  const task = (tasks ?? []).find(
    (t) => String(t.title).trim().toLowerCase() === title.toLowerCase(),
  )
  if (!task || task.status === "done") return false

  const now = new Date().toISOString()
  const { error: updateErr } = await db
    .from("booking_tasks")
    .update({ status: "done", completed_at: now, completed_by: null })
    .eq("id", task.id)
    .eq("status", "open")
  if (updateErr) throw new Error(updateErr.message)

  await db.from("booking_history").insert({
    booking_id: bookingId,
    field: "task",
    old_value: "open",
    new_value: task.title,
    action: "task_completed",
    actor_id: null,
    actor_name: "PortConnect",
  })

  return true
}

export function taskTriggersFromEvents(eventTypes: string[]): PortConnectTaskTrigger[] {
  const out = new Set<PortConnectTaskTrigger>()
  for (const raw of eventTypes) {
    const type = raw.trim().toUpperCase()
    if (type === "MPIRELEASE") out.add("MPIRELEASE")
    if (type === "GATEOUT") out.add("GATEOUT")
    if (type === "GATEIN") out.add("GATEIN_DEPOT")
  }
  return [...out]
}

export function emptyVisitBookingFields(): VisitBookingFields {
  return {
    inbound_ata: null,
    inbound_eta: null,
    discharged_at: null,
    customs_release_at: null,
    mpi_release_at: null,
    line_release_at: null,
    last_free_at: null,
    vbs_slot_at: null,
    gate_out_at: null,
    delivered_at: null,
    operator_name: null,
    discharge_port_name: null,
    sea_port_gate_out_at: null,
    inland_port_gate_out_at: null,
    inland_port_gate_in_at: null,
  }
}

export function taskTriggersFromVisitTransition(
  before: VisitBookingFields,
  after: VisitBookingFields,
): PortConnectTaskTrigger[] {
  const out: PortConnectTaskTrigger[] = []
  if (!before.mpi_release_at && after.mpi_release_at) out.push("MPIRELEASE")
  if (!before.sea_port_gate_out_at && after.sea_port_gate_out_at) out.push("GATEOUT")
  if (!before.inland_port_gate_in_at && after.inland_port_gate_in_at) out.push("GATEIN_DEPOT")
  return out
}
