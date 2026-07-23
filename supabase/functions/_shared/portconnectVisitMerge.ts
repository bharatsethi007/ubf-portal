/** Null from PortConnect means "not known yet" — keep stored value on refresh. */
export const PRESERVE_ON_NULL = [
  "container_visit_id",
  "port_code",
  "iso_type",
  "iso_desc",
  "container_type",
  "container_status",
  "container_location",
  "booking_reference",
  "load_port_name",
  "discharge_port_name",
  "operator_code",
  "operator_name",
  "operator_voyage_id",
  "inbound_vessel_name",
  "inbound_vessel_ref",
  "inbound_eta",
  "inbound_ata",
  "discharged_at",
  "delivered_at",
  "line_release_at",
  "customs_release_at",
  "mpi_release_at",
  "gate_out_at",
  "vbs_slot_at",
  "last_free_at",
  "power_last_free_at",
  "empty_return_depot",
  "empty_return_depot_code",
  "empty_return_depot_name",
  "express_pin_status",
  "security_check",
  "previous_container_visit_id",
  "stops",
] as const

/** Always take the latest visit payload for these keys. */
export const ALWAYS_FROM_VISIT = [
  "booking_id",
  "container_no",
  "source",
  "updated_at",
  "raw",
  "hazard_count",
  "hazards",
  "portconnect_last_updated",
] as const

export function mergeContainerTrackingRow(
  mapped: Record<string, unknown>,
  existing: Record<string, unknown> | null,
): Record<string, unknown> {
  if (!existing) return mapped

  const out: Record<string, unknown> = { ...existing }
  for (const key of PRESERVE_ON_NULL) {
    const next = mapped[key]
    out[key] = next != null ? next : existing[key]
  }
  for (const key of ALWAYS_FROM_VISIT) {
    if (mapped[key] !== undefined) out[key] = mapped[key]
  }
  return out
}
