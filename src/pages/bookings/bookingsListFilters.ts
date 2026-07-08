import type { BookingSource } from '../../types/booking'

export type BookingSourceFilter = 'all' | BookingSource

export const BOOKING_SOURCE_FILTERS: { value: BookingSourceFilter; label: string }[] = [
  { value: 'all', label: 'All sources' },
  { value: 'email_import', label: 'Email' },
  { value: 'customer_portal', label: 'Portal' },
  { value: 'email_parsed', label: 'Parsed' },
  { value: 'manual', label: 'Manual' },
]

export function filterBookingsBySource<T extends { source: BookingSource }>(
  rows: T[],
  filter: BookingSourceFilter,
): T[] {
  if (filter === 'all') return rows
  return rows.filter((row) => row.source === filter)
}
