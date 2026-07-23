export type BookingContainerSource = 'manual' | 'erp' | 'portconnect'

export type ContainerConflictStatus = 'none' | 'erp_only' | 'manual_only' | 'type_mismatch'

export type ContainerConflictResolution = 'kept_manual' | 'kept_erp' | 'both_valid'

export type BookingContainerRow = {
  id: string
  booking_id: string
  container_no: string
  container_type: string | null
  iso_type_code: string | null
  seal_no: string | null
  source: BookingContainerSource
  sort_order: number
  created_at: string
  created_by: string | null
  conflict_status: ContainerConflictStatus
  erp_container_no: string | null
  erp_container_type: string | null
  conflict_detected_at: string | null
  resolved_at: string | null
  resolved_by: string | null
  resolution: ContainerConflictResolution | null
  /** From container_tracking after PortConnect refresh */
  hazard_count?: number | null
  hazards?: unknown
  iso_type?: string | null
  iso_desc?: string | null
  tracking_container_type?: string | null
}

export type BookingContainerUpsert = {
  container_no: string
  container_type?: string | null
  seal_no?: string | null
  sort_order?: number
}

export const CONTAINER_TYPE_OPTIONS = [
  { value: '20GP', label: "20' GP" },
  { value: '20HC', label: "20' HC" },
  { value: '40GP', label: "40' GP" },
  { value: '40HC', label: "40' HC" },
  { value: '20RF', label: "20' RF" },
  { value: '40RF', label: "40' RF" },
  { value: '40HR', label: "40' HR" },
  { value: 'other', label: 'Other' },
] as const
