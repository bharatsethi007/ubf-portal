import { useEffect, useMemo, useState } from 'react'
import { getBranding, NZ_BRAND, type Brand } from '../../../features/company/branding'
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

async function fetchStaffName(userId: string | null | undefined): Promise<string> {
  if (!userId) return ''
  const { data } = await supabase.from('staff_users').select('full_name, email').eq('user_id', userId).maybeSingle()
  return (data?.full_name || data?.email || '').trim()
}

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

export type QuotePdfInputs = {
  quote: QuoteRecord | null; responseInputs: PdfResponseInput[]; cargo: QuoteCargoLine[]
  containers: QuoteContainer[]; customer: PdfCustomer; preparedBy: string; brand: Brand
}

/** Fetches the rows a quote PDF needs. Used by the hook below and by bulk reminders. */
export async function loadQuotePdfInputs(quoteId: string, responses: PdfResp[]): Promise<QuotePdfInputs> {
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
  const ok = loaded.filter(Boolean) as PdfResponseInput[]
  // Quoting user = whoever priced the first option, else quote creator.
  const firstBy = (ok[0]?.record as { created_by?: string | null } | undefined)?.created_by
  const preparedBy = await fetchStaffName(firstBy || (q as { created_by?: string | null } | null)?.created_by)
  // Contact details printed on the quote come from the quote's company + branch.
  const qc = q as { company_id?: string | null; branch_id?: string | null } | null
  const brand = await getBranding(qc?.company_id, qc?.branch_id)
  return { quote: q, responseInputs: ok, cargo: cg, containers: ct, customer: cust as PdfCustomer, preparedBy, brand }
}

/** Lookup helpers the PDF builder needs (units, taxes, ports, charge groups). */
export function makePdfRefs(
  units: { code: string; label: string }[], taxes: { code: string; label: string; rate_pct: number }[],
  ports: Parameters<typeof resolvePortLabel>[2], chargeGroups: PdfRefs['chargeGroups'],
): PdfRefs {
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
}

/** Loads everything the quote PDF needs. Shared by the preview tab and the email composer. */
export function useQuotePdfData(quoteId: string, responses: PdfResp[] | null) {
  const [quote, setQuote] = useState<QuoteRecord | null>(null)
  const [responseInputs, setResponseInputs] = useState<PdfResponseInput[]>([])
  const [cargo, setCargo] = useState<QuoteCargoLine[]>([])
  const [containers, setContainers] = useState<QuoteContainer[]>([])
  const [customer, setCustomer] = useState<PdfCustomer>(null)
  const [preparedBy, setPreparedBy] = useState('')
  const [brand, setBrand] = useState<Brand>(NZ_BRAND)
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
        const r = await loadQuotePdfInputs(quoteId, responses)
        if (cancelled) return
        setQuote(r.quote)
        setPreparedBy(r.preparedBy)
        setBrand(r.brand)
        setResponseInputs(r.responseInputs)
        setCargo(r.cargo); setContainers(r.containers); setCustomer(r.customer)
      } catch {
        if (!cancelled) setError('Failed to load quote for PDF')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [quoteId, responses])

  const refs = useMemo<PdfRefs>(() => makePdfRefs(units, taxes, ports, chargeGroups), [units, taxes, ports, chargeGroups])

  const data = useMemo<QuotePdfData | null>(() => {
    if (!quote || !responseInputs.length) return null
    return { ...buildQuotePdfData(quote, responseInputs, cargo, containers, customer, refs, brand), preparedBy }
  }, [quote, responseInputs, cargo, containers, customer, refs, preparedBy, brand])

  return { data, loading, error }
}
