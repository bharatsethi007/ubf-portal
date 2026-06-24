export type ModuleTab = 'IA' | 'IS' | 'EA' | 'ES'
export type ModuleCode = 'FIA' | 'FIS' | 'FEA' | 'FES'
export type ShipmentView = 'consols' | 'jobs'
export type DateBasis = 'etd' | 'booked'

export const MODULE_TABS: { tab: ModuleTab; code: ModuleCode; label: string }[] = [
  { tab: 'IA', code: 'FIA', label: 'IA' },
  { tab: 'IS', code: 'FIS', label: 'IS' },
  { tab: 'EA', code: 'FEA', label: 'EA' },
  { tab: 'ES', code: 'FES', label: 'ES' },
]

export function tabToModule(tab: ModuleTab): ModuleCode {
  return MODULE_TABS.find((m) => m.tab === tab)?.code ?? 'FIS'
}

export type ShipmentFilterFields = {
  search: string
  origin: string
  destination: string
  vesselFlight: string
  status: string
  mode: string
  customer: string
}

export const EMPTY_FILTER_FIELDS: ShipmentFilterFields = {
  search: '',
  origin: '',
  destination: '',
  vesselFlight: '',
  status: '',
  mode: '',
  customer: '',
}
