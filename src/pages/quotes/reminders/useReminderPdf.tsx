import { useCallback, useMemo } from 'react'
import { pdf } from '@react-pdf/renderer'
import { supabase } from '../../../supabase'
import { useChargeGroups, useChargeUnits, useTaxRates } from '../../../hooks/useQuoteRefData'
import { usePorts } from '../../../hooks/usePorts'
import { registerQuoteFonts } from '../pdf/quotePdfFonts'
import QuotePdfDocument from '../pdf/QuotePdfDocument'
import { buildQuotePdfData } from '../pdf/buildQuotePdfData'
import { loadQuotePdfInputs, makePdfRefs } from '../pdf/useQuotePdfData'
import { blobToBase64 } from '../email/quoteEmailApi'

registerQuoteFonts()

export type ReminderPdf = { base64: string; name: string }

/** Builds the same quote PDF staff send by hand, for one quote at a time (bulk reminders). */
export function useReminderPdf() {
  const { items: units } = useChargeUnits()
  const { items: taxes } = useTaxRates()
  const { items: chargeGroups } = useChargeGroups()
  const { ports } = usePorts()
  const refs = useMemo(() => makePdfRefs(units, taxes, ports, chargeGroups), [units, taxes, ports, chargeGroups])
  const ready = units.length > 0 && ports.size > 0

  const build = useCallback(async (quoteId: string): Promise<ReminderPdf | null> => {
    // Same options the reminder lists: priced and still live.
    const { data: rs, error } = await supabase.from('quote_responses').select('id, response_no')
      .eq('quote_id', quoteId).gt('total_sell', 0).not('status', 'in', '(rejected,withdrawn)').order('total_sell')
    if (error || !rs?.length) return null
    const inp = await loadQuotePdfInputs(quoteId, rs as { id: string; response_no: string | null }[])
    if (!inp.quote || !inp.responseInputs.length) return null
    const data = { ...buildQuotePdfData(inp.quote, inp.responseInputs, inp.cargo, inp.containers, inp.customer, refs), preparedBy: inp.preparedBy }
    const blob = await pdf(<QuotePdfDocument data={data} />).toBlob()
    return { base64: await blobToBase64(blob), name: `${inp.quote.quote_no || 'quotation'}.pdf` }
  }, [refs])

  return { build, ready }
}
