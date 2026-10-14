/** Price-source labels and colours, shared by the response card, the lines grid and Brainbox. */
export type SourceGroup = 'card' | 'cartage' | 'rule' | 'history' | 'manual' | 'legacy'

export const SOURCE_GROUP: Record<string, SourceGroup> = {
  rate_card: 'card',
  local_charges: 'card',
  margin_rule: 'card',
  cartage: 'cartage',
  brainbox_rule: 'rule',
  template: 'history',
  lane_history: 'history',
  manual: 'manual',
  legacy: 'legacy',
}

// Colours differ in lightness as well as hue so the bar reads in greyscale too.
export const GROUP_META: Record<SourceGroup, { label: string; bar: string; chipBg: string; chipFg: string }> = {
  card: { label: 'Rate card', bar: '#0A2472', chipBg: '#E7EBF7', chipFg: '#0A2472' },
  cartage: { label: 'Cartage', bar: '#7C93E6', chipBg: '#EEF1FC', chipFg: '#3A4FA3' },
  rule: { label: 'Brainbox rule', bar: '#0F7A4F', chipBg: '#E3F3EA', chipFg: '#0F5E3D' },
  history: { label: 'Template / history', bar: '#9AA6B8', chipBg: '#EEF1F5', chipFg: '#3D4757' },
  manual: { label: 'Manual, no card', bar: '#E07B2E', chipBg: '#FDEFE4', chipFg: '#8A4A17' },
  legacy: { label: 'Not tracked', bar: '#D5DAE4', chipBg: '#F3F4F7', chipFg: '#5B6577' },
}

export const SOURCE_CHIP: Record<string, string> = {
  rate_card: 'Card',
  local_charges: 'Local',
  margin_rule: 'Margin',
  cartage: 'Cartage',
  brainbox_rule: 'Rule',
  template: 'Template',
  lane_history: 'History',
  manual: 'Manual',
  legacy: '',
}

export const GROUP_ORDER: SourceGroup[] = ['card', 'cartage', 'rule', 'history', 'manual', 'legacy']

export function money(n: number, dp = 2): string {
  return n.toLocaleString('en-NZ', { minimumFractionDigits: dp, maximumFractionDigits: dp })
}
