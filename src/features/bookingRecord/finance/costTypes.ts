export type CostType = 'shipping_line' | 'co_loader' | 'psc' | 'cartage' | 'customs' | 'agent' | 'other'
export type ChargeGroup = 'origin' | 'freight' | 'destination'

export const COST_TYPES: { value: CostType; label: string }[] = [
  { value: 'shipping_line', label: 'Shipping line' },
  { value: 'co_loader', label: 'Co-loader' },
  { value: 'psc', label: 'PSC' },
  { value: 'cartage', label: 'Cartage' },
  { value: 'customs', label: 'Customs / MPI' },
  { value: 'agent', label: 'Origin agent' },
  { value: 'other', label: 'Other' },
]

export const COST_TYPE_LABEL: Record<string, string> = Object.fromEntries(COST_TYPES.map((t) => [t.value, t.label]))

export const GROUP_LABEL: Record<string, string> = { origin: 'Origin', freight: 'Freight', destination: 'Destination' }

const CO_LOADER_HINT = /carotrans|oceanbridge|custom logistic|mgf|co-?loader|consol/i

// Deterministic classifier. Label wins for PSC/cartage/customs; vendor decides line vs co-loader.
export function classifyCost(description: string, vendor: string | null, fallback: CostType = 'other'): CostType {
  const d = description || ''
  if (/\bpsc\b|port service/i.test(d)) return 'psc'
  if (/cartage|trucking|delivery|transport/i.test(d)) return 'cartage'
  if (/customs|entry|biosecurity|\bmpi\b|duty|cit\b/i.test(d)) return 'customs'
  if (vendor && CO_LOADER_HINT.test(vendor)) return 'co_loader'
  return fallback
}

export function normGroup(g: string | null | undefined): ChargeGroup | null {
  const v = (g || '').toLowerCase()
  if (v.startsWith('orig')) return 'origin'
  if (v.startsWith('dest')) return 'destination'
  if (v === 'freight') return 'freight'
  return null
}
