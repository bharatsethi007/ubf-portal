export const AUTO_EXPIRED = 'Auto expired'

export const LOST_REASONS = [
  'Price too high',
  'Lost to competitor',
  'Customer booked direct with carrier',
  'Transit time too long',
  'Schedule or space not suitable',
  'No response from customer',
  'Shipment cancelled or on hold',
  'Service not offered',
  'Other',
] as const

export type LostInfo = { reason: string; note?: string | null }
