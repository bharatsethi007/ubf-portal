import type { BookingCost, FinanceLane } from './bookingCostsApi'
import type { CostType } from './costTypes'

// Deterministic expectation per Import Sea job. No AI.
export function expectedTypes(lane: FinanceLane): CostType[] {
  const out: CostType[] = []
  if (lane.loadType === 'FCL') out.push('shipping_line')
  if (lane.loadType === 'LCL') out.push('co_loader')
  if (lane.toDoor) out.push('cartage')
  return out
}

export function missingTypes(lane: FinanceLane, costs: BookingCost[]): CostType[] {
  const have = new Set(costs.map((c) => c.cost_type))
  return expectedTypes(lane).filter((t) => !have.has(t))
}
