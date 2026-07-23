import type { BookingRecordPatch } from './bookingRecordTypes'

export type OverrideField =
  | 'm_eta'
  | 'm_shipping_line'
  | 'm_discharge_port'
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

export function containerOverrideKey(containerNo: string): string {
  return `container:${containerNo.trim().toUpperCase()}`
}

export function isContainerOverridden(
  containerNo: string,
  overrides: Record<string, boolean> | null | undefined,
): boolean {
  return Boolean(overrides?.[containerOverrideKey(containerNo)])
}

export function withContainerOverride(
  containerNo: string,
  current: Record<string, boolean> | null | undefined,
): Record<string, boolean> {
  return { ...(current ?? {}), [containerOverrideKey(containerNo)]: true }
}

export function withoutFieldOverride(
  field: OverrideField,
  current: Record<string, boolean> | null | undefined,
): Record<string, boolean> {
  const next = { ...(current ?? {}) }
  delete next[field]
  return next
}

export function withoutContainerOverride(
  containerNo: string,
  current: Record<string, boolean> | null | undefined,
): Record<string, boolean> {
  const next = { ...(current ?? {}) }
  delete next[containerOverrideKey(containerNo)]
  return next
}
