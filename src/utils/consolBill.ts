import type { ModuleTab } from '../types/shipmentFilters'

const TRACKING_TOOLTIP =
  'When on, the tracking bot polls live carrier APIs for this consol. When off, only TradeWindow timestamps are shown.'

export { TRACKING_TOOLTIP }

/** AWB for air modules (EA/IA), BL for sea (ES/IS). */
export function consolMasterBillLabel(module: string, mode: string): 'AWB' | 'BL' {
  const code = module.length === 3 && module.startsWith('F') ? module.slice(1) : module.toUpperCase()
  if (code === 'EA' || code === 'IA') return 'AWB'
  if (code === 'ES' || code === 'IS') return 'BL'
  return mode === 'air' ? 'AWB' : 'BL'
}

export function tabMasterBillLabel(tab: ModuleTab): 'AWB' | 'BL' {
  return tab === 'EA' || tab === 'IA' ? 'AWB' : 'BL'
}
