import type { JsonRecord } from "./portconnectClient.ts"
import { asIso, asText, visitField } from "./portconnectFields.ts"
import { normalizeIso6346Pill } from "./iso6346Normalize.ts"

export function hazardCountFromVisit(visit: JsonRecord): number {
  const raw = visitField(visit, "hazardCount", "hazard_count")
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0
}

export function hazardsFromVisit(visit: JsonRecord): unknown {
  const hazards = visitField(visit, "hazards")
  return Array.isArray(hazards) ? hazards : []
}

function previousVisitId(visit: JsonRecord): number | null {
  const raw = visitField(visit, "previousContainerVisitId")
  if (raw == null) return null
  const n = Number(raw)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

export function mapVisitToContainerRow(
  visit: JsonRecord,
  bookingId: string,
  containerNo: string,
): Record<string, unknown> {
  const visitId = visitField(visit, "containerVisitId")
  const isoType = asText(visitField(visit, "containerIsoTypeCode"))
  const isoDesc = asText(visitField(visit, "containerIsoTypeDescription"))
  const depotCode = asText(visitField(visit, "emptyReturnDepotCode"))
  const depotName = asText(visitField(visit, "emptyReturnDepotName"))

  return {
    booking_id: bookingId,
    container_no: containerNo,
    container_visit_id: visitId != null ? Number(visitId) : null,
    previous_container_visit_id: previousVisitId(visit),
    port_code: asText(visitField(visit, "portCode", "partnerPortCode")),
    iso_type: isoType,
    iso_desc: isoDesc,
    container_type: normalizeIso6346Pill(isoType, isoDesc),
    container_status: asText(visitField(visit, "containerStatus")),
    container_location: asText(visitField(visit, "containerLocation")),
    booking_reference: asText(visitField(visit, "bookingReference")),
    load_port_name: asText(visitField(visit, "loadPortName")),
    discharge_port_name: asText(visitField(visit, "dischargePortName")),
    operator_code: asText(visitField(visit, "containerOperatorCode")),
    operator_name: asText(visitField(visit, "containerOperatorName")),
    operator_voyage_id: asText(visitField(visit, "containerOperatorVoyageId")),
    inbound_vessel_name: asText(visitField(visit, "inboundVesselName")),
    inbound_vessel_ref: asText(visitField(visit, "inboundVesselRef")),
    inbound_eta: asIso(visitField(visit, "inboundVesselPublishedArrivalDatetime")),
    inbound_ata: asIso(visitField(visit, "inboundVesselActualArrivalDatetime", "seaPortArrivalDatetime")),
    discharged_at: asIso(visitField(visit, "dischargedDatetime")),
    delivered_at: asIso(visitField(visit, "deliveredDatetime")),
    line_release_at: asIso(visitField(visit, "lineReleaseDatetime")),
    customs_release_at: asIso(visitField(visit, "customsReleaseDatetime")),
    mpi_release_at: asIso(visitField(visit, "mpiReleaseDatetime")),
    gate_out_at: asIso(visitField(visit, "seaPortGateOutDateTime")),
    vbs_slot_at: asIso(visitField(visit, "vbsSlotDatetime")),
    last_free_at: asIso(visitField(visit, "lastFreeDatetime")),
    power_last_free_at: asIso(visitField(visit, "packedOffPowerDatetime")),
    empty_return_depot_code: depotCode,
    empty_return_depot_name: depotName,
    empty_return_depot: depotName ?? depotCode,
    security_check: asText(visitField(visit, "securityCheck")),
    stops: visitField(visit, "stops") ?? null,
    hazards: hazardsFromVisit(visit),
    hazard_count: hazardCountFromVisit(visit),
    express_pin_status: asText(visitField(visit, "expressPinStatus")),
    portconnect_last_updated: asIso(visitField(visit, "lastUpdated")),
    source: "portconnect",
    updated_at: new Date().toISOString(),
    raw: visit,
  }
}

export type VisitTimestamps = {
  inbound_ata: string | null
  discharged_at: string | null
  customs_release_at: string | null
  mpi_release_at: string | null
  line_release_at: string | null
  last_free_at: string | null
  vbs_slot_at: string | null
  gate_out_at: string | null
  delivered_at: string | null
}

export function timestampsFromVisit(visit: JsonRecord): VisitTimestamps {
  const row = mapVisitToContainerRow(visit, "", "")
  return {
    inbound_ata: row.inbound_ata as string | null,
    discharged_at: row.discharged_at as string | null,
    customs_release_at: row.customs_release_at as string | null,
    mpi_release_at: row.mpi_release_at as string | null,
    line_release_at: row.line_release_at as string | null,
    last_free_at: row.last_free_at as string | null,
    vbs_slot_at: row.vbs_slot_at as string | null,
    gate_out_at: row.gate_out_at as string | null,
    delivered_at: row.delivered_at as string | null,
  }
}

export function timestampsFromStored(row: Record<string, unknown> | null): VisitTimestamps {
  if (!row) {
    return {
      inbound_ata: null, discharged_at: null, customs_release_at: null,
      mpi_release_at: null, line_release_at: null, last_free_at: null,
      vbs_slot_at: null, gate_out_at: null, delivered_at: null,
    }
  }
  return {
    inbound_ata: asIso(row.inbound_ata),
    discharged_at: asIso(row.discharged_at),
    customs_release_at: asIso(row.customs_release_at),
    mpi_release_at: asIso(row.mpi_release_at),
    line_release_at: asIso(row.line_release_at),
    last_free_at: asIso(row.last_free_at),
    vbs_slot_at: asIso(row.vbs_slot_at),
    gate_out_at: asIso(row.gate_out_at),
    delivered_at: asIso(row.delivered_at),
  }
}
