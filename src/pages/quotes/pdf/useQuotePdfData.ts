import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../supabase'
import { useChargeUnits, useTaxRates, useChargeGroups } from '../../../hooks/useQuoteRefData'
import { usePorts } from '../../../hooks/usePorts'
import { resolvePortLabel, resolvePortCountryCode } from '../../../features/portal/dashboard/portalPortDisplay'
import { fetchQuote, type QuoteRecord } from '../quotesApi'
import { fetchQuoteResponse } from '../quoteResponsesApi'
import { fetchQuoteResponseLines } from '../quoteResponseLinesApi'
import { fetchQuoteCargo, type QuoteCargoLine } from '../quoteCargoApi'
import { fetchQuoteContainers, type QuoteContainer } from '../quoteContainersApi'
import { buildQuotePdfData, type PdfRefs, type PdfCustomer, type PdfResponseInput, type QuotePdfData } from './buildQuotePdfData'

export type PdfResp = { id: string; response_no: string | null }

async function fetchCustomerLite(accountId: string): Promise<PdfCustomer> {
  const { data } = await supabase
    .from('customers')
    .select('name, contact, phone, email, address1, address2, address3')
    .eq('account_id', accountId)
    .maybeSingle()
  if (!data) return null
  const address = [data.address1, data.address2, data.address3].filter(Boolean).join(', ')
  return { name: data.name ?? '', contact: data.contact ?? '', phone: data.phone ?? '', email: data.email ?? '', address }
}

/** Loads everything the quote PDF needs. Shared by the preview tab and the email composer. */
export function useQuotePdfData(quoteId: string, responses: PdfResp[] | null) {
  const [quote, setQuote] = useState<QuoteRecord | null>(null)
  const [responseInputs, setResponseInputs] = useState<PdfResponseInput[]>([])
  const [cargo, setCargo] = useState<QuoteCargoLine[]>([])
  const [containers, setContainers] = useState<QuoteContainer[]>([])
  const [customer, setCustomer] = useState<PdfCustomer>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { items: units } = useChargeUnits()
  const { items: taxes } = useTaxRates()
  const { items: chargeGroups } = useChargeGroups()
  const { ports } = usePorts()

  useEffect(() => {
    if (!responses?.length) { setQuote(null); setResponseInputs([]); return }
    let cancelled = false
    setLoading(true); setError('')
    ;(async () => {
      try {
        const q = await fetchQuote(quoteId)
        const [cg, ct, cust, ...loaded] = await Promise.all([
          fetchQuoteCargo(quoteId),
          fetchQuoteContainers(quoteId),
          q?.customer_account_id ? fetchCustomerLite(q.customer_account_id) : Promise.resolve(null),
          ...responses.map(async (r) => {
            const [record, lines] = await Promise.all([fetchQuoteResponse(r.id), fetchQuoteResponseLines(r.id)])
            return { record, lines } as PdfResponseInput
          }),
        ])
        if (cancelled) return
        setQuote(q)
        setResponseInputs(loaded.filter(Boolean) as PdfResponseInput[])
        setCargo(cg); setContainers(ct); setCustomer(cust)
      } catch {
        if (!cancelled) setError('Failed to load quote for PDF')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [quoteId, responses])

  const refs = useMemo<PdfRefs>(() => {
    const unitMap = new Map(units.map((u) => [u.code, u.label]))
    const taxMap = new Map(taxes.map((t) => [t.code, t.label]))
    const taxRateByCode: Record<string, number> = {}
    for (const t of taxes) taxRateByCode[t.code] = t.rate_pct
    return {
      unitLabel: (c) => unitMap.get(c) ?? c,
      taxLabel: (c) => taxMap.get(c) ?? c,
      taxRateByCode,
      port: (code) => {
        if (!code) return null
        const cc = resolvePortCountryCode(code, null, ports)
        return { code: code.toUpperCase(), name: resolvePortLabel(code, null, ports), cc: cc && cc !== 'un' ? cc : null }
      },
      chargeGroups,
    }
  }, [units, taxes, ports, chargeGroups])

  const data = useMemo<QuotePdfData | null>(() => {
    if (!quote || !responseInputs.length) return null
    return buildQuotePdfData(quote, responseInputs, cargo, containers, customer, refs)
  }, [quote, responseInputs, cargo, containers, customer, refs])

  return { data, loading, error }
}
