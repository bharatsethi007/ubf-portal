import { MODULE_CONFIG, type Booking, type BookingModule } from '../types/booking'

function shipperAccountId(booking: Booking): string | null {
  return booking.shipper_account_id ?? booking.account_id ?? null
}

function consigneeAccountId(booking: Booking): string | null {
  return booking.consignee_account_id ?? booking.importer_account_id ?? null
}

/** Account IDs to include in the batch overdue RPC for one booking. */
export function bookingOverdueAccountIds(booking: Booking, module: BookingModule): string[] {
  const shipper = shipperAccountId(booking)
  const consignee = consigneeAccountId(booking)
  const ids = new Set<string>()
  const { direction } = MODULE_CONFIG[module]

  if (direction === 'export' && shipper) ids.add(shipper)
  if (direction === 'import' && consignee) ids.add(consignee)
  if (shipper) ids.add(shipper)
  if (consignee) ids.add(consignee)

  return [...ids]
}

/** Primary party account for the overdue pill on a bookings list row. */
export function bookingRowOverdueAccountId(
  booking: Booking,
  module: BookingModule,
): string | null {
  return MODULE_CONFIG[module].direction === 'export'
    ? shipperAccountId(booking)
    : consigneeAccountId(booking)
}
