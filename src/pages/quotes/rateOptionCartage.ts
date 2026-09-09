/** Cartage line shown on rate option cards (built in NewQuoteSearch, rendered in rate cards). */
export type RateOptionCartage = {
  leg: 'origin' | 'dest'
  label: string
  amount: number
  confidence?: string
  status: string
  source?: 'ubf' | 'gss' | 'bascik'
  carrier?: string
  carrierShort?: string
  carrierLogo?: string
  canChange?: boolean
  onChange?: () => void
}
