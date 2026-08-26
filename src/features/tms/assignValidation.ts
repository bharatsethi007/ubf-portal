import { cardTotals, type CardRow, type DriverRow } from './dispatchApi'

export type Validation = { errors: string[]; warnings: string[] }

export function validateAssignment(card: CardRow, driver: DriverRow): Validation {
  const errors: string[] = []
  const warnings: string[] = []
  const v = driver.vehicle
  if (!v) { errors.push('Driver has no truck logged on.'); return { errors, warnings } }
  const t = cardTotals(card)
  if (v.payload_kg != null && t.kg > v.payload_kg) errors.push(`Load ${t.kg}kg exceeds ${v.registration_number} payload ${v.payload_kg}kg.`)
  if (v.cube_capacity_m3 != null && t.cbm > v.cube_capacity_m3) errors.push(`Volume ${t.cbm}m³ exceeds ${v.registration_number} capacity ${v.cube_capacity_m3}m³.`)
  if (card.tail_lift_required && !v.has_tail_lift) errors.push(`Tail lift required — ${v.registration_number} has none.`)
  if (card.temperature_control && !v.is_reefer) errors.push(`Temperature control required — ${v.registration_number} is not a reefer.`)
  if (card.goods_type === 'dangerous') warnings.push('Dangerous goods — confirm driver DG endorsement.')
  if (card.preferred_pickup_at && new Date(card.preferred_pickup_at) < new Date()) warnings.push('Preferred pickup time has already passed.')
  return { errors, warnings }
}
