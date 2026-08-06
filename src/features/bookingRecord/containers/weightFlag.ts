export type WeightFlag = { label: string; className: string } | null

/** Tiers by gross weight in kg. Under 25t = no flag. */
export function weightFlag(kg: number | null | undefined): WeightFlag {
  if (kg == null) return null
  const t = kg / 1000
  if (t < 25) return null
  if (t < 28) return { label: 'Heavy', className: 'wflag--heavy' }
  if (t < 29) return { label: 'Very Heavy', className: 'wflag--very' }
  return { label: 'Super Heavy', className: 'wflag--super' }
}
