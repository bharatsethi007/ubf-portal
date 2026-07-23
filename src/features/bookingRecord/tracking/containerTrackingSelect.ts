const CONTAINER_SELECT = `
  id, booking_id, container_no, container_type, iso_type, iso_desc, port_code,
  container_status, container_location, load_port_name, discharge_port_name,
  operator_name, operator_voyage_id, inbound_vessel_name, inbound_vessel_ref,
  inbound_eta, inbound_ata, discharged_at, line_release_at, customs_release_at,
  mpi_release_at, gate_out_at, vbs_slot_at, last_free_at,
  empty_return_depot_code, empty_return_depot_name, security_check,
  hazard_count, hazards, stops, source, updated_at, portconnect_last_updated, raw
`

export { CONTAINER_SELECT }
