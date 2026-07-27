import type { ImportSeaRow } from './types'

export const DELIVERY_MODE_OPTIONS = [
  { value: 'devan_yard', label: 'Devan at UBF yard' },
  { value: 'direct_importer', label: 'Direct to importer' },
] as const

export type DeliveryMode = (typeof DELIVERY_MODE_OPTIONS)[number]['value']

export function deliveryModeLabel(mode: string | null | undefined): string {
  return DELIVERY_MODE_OPTIONS.find((o) => o.value === mode)?.label ?? mode ?? '—'
}

export function portConnectRefreshIneligibleReason(row: ImportSeaRow): string | null {
  const hasContainer = row.containers?.some((c) => c.container_no?.trim())
  if (!hasContainer) return 'No containers'
  if (!row.portconnect_enabled) return 'PortConnect tracking disabled'
  return null
}

export function rowHasContainers(row: ImportSeaRow): boolean {
  return Boolean(row.containers?.some((c) => c.container_no?.trim()))
}
