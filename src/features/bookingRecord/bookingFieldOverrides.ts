import type { BookingRecordPatch } from '../bookingRecordTypes'

export type OverrideField =
  | 'last_free_day'
  | 'discharge_date'
  | 'delivery_date'
  | 'container_return_date'
  | 'swb_released'
  | 'cleared'

export function withFieldOverride(
  patch: BookingRecordPatch,
  field: OverrideField,
  current: Record<string, boolean> | null | undefined,
): BookingRecordPatch {
  return {
    ...patch,
    field_overrides: { ...(current ?? {}), [field]: true },
  }
}
