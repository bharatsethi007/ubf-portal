import { useEffect, useMemo, useState } from 'react'
import { PDFViewer, PDFDownloadLink } from '@react-pdf/renderer'
import { toast } from 'sonner'
import { supabase } from '../../supabase'
import { useChargeUnits, useTaxRates, useChargeGroups } from '../../hooks/useQuoteRefData'
import { useSeaPorts } from '../../hooks/useSeaPorts'
import { fetchQuote, type QuoteRecord } from './quotesApi'
import { fetchQuoteResponse } from './quoteResponsesApi'
import { fetchQuoteResponseLines } from './quoteResponseLinesApi'
import { fetchQuoteCargo, type QuoteCargoLine } from './quoteCargoApi'
import { fetchQuoteContainers, type QuoteContainer } from './quoteContainersApi'
import { registerQuoteFonts } from './pdf/quotePdfFonts'
import QuotePdfDocument from './pdf/QuotePdfDocument'
import { buildQuotePdfData, type PdfRefs, type PdfCustomer, type PdfResponseInput } from './pdf/buildQuotePdfData'

registerQuoteFonts()

type Resp = { id: string; response_no: string | null }
type Props = { quoteId: string; responses: Resp[] }

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

export default function QuotePreviewTab({ quoteId, responses }: Props) {
  const [quote, setQuote] = useState<QuoteRecord | null>(null)
  const [responseInputs, setResponseInputs] = useState<PdfResponseInput[]>([])
  const [cargo, setCargo] = useState<QuoteCargoLine[]>([])
  const [containers, setContainers] = useState<QuoteContainer[]>([])
  const [customer, setCustomer] = useState<PdfCustomer>(null)
  const [loading, setLoading] = useState(false)

  const { items: units } = useChargeUnits()
  const { items: taxes } = useTaxRates()
  const { items: chargeGroups } = useChargeGroups()
  const { ports } = useSeaPorts()

  useEffect(() => {
    if (!responses.length) { setQuote(null); setResponseInputs([]); return }
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const q = await fetchQuote(quoteId)
        const [cg, ct, cust, ...loaded] = await Promise.all([
          fetchQuoteCargo(quoteId),
          fetchQuoteContainers(quoteId),
          q?.customer_account_id ? fetchCustomerLite(q.customer_account_id) : Promise.resolve(null),
          ...responses.map(async (r) => {
            const [record, lines] = await Promise.all([
              fetchQuoteResponse(r.id),
              fetchQuoteResponseLines(r.id),
            ])
            return { record, lines } as PdfResponseInput
          }),
        ])
        if (cancelled) return
        setQuote(q)
        setResponseInputs(loaded.filter(Boolean) as PdfResponseInput[])
        setCargo(cg)
        setContainers(ct)
        setCustomer(cust)
      } catch {
        if (!cancelled) toast.error('Failed to load quote for preview')
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
    const portMap = new Map(ports.map((p) => [p.code, p]))
    return {
      unitLabel: (c) => unitMap.get(c) ?? c,
      taxLabel: (c) => taxMap.get(c) ?? c,
      taxRateByCode,
      port: (code) => {
        if (!code) return null
        const p = portMap.get(code)
        return p ? { code: p.code, name: p.name, cc: p.country_code } : { code, name: code, cc: null }
      },
      chargeGroups,
    }
  }, [units, taxes, ports, chargeGroups])

  const data = useMemo(() => {
    if (!quote || !responseInputs.length) return null
    return buildQuotePdfData(quote, responseInputs, cargo, containers, customer, refs)
  }, [quote, responseInputs, cargo, containers, customer, refs])

  if (!responses.length) return <p className="qr-placeholder">Add a response first to preview the quote PDF.</p>

  return (
    <div className="qr-preview">
      <div className="qr-preview__bar">
        {data && (
          <PDFDownloadLink document={<QuotePdfDocument data={data} />} fileName={`${data.quoteNo || 'quotation'}.pdf`} className="nqd-btn nqd-btn--accent">
            {({ loading: dl }) => (dl ? 'Preparing…' : 'Download PDF')}
          </PDFDownloadLink>
        )}
      </div>
      {loading || !data ? (
        <p className="qr-placeholder">Loading preview…</p>
      ) : (
        <PDFViewer showToolbar={false} style={{ width: '100%', height: 820, border: '1px solid #e2e8f0', borderRadius: 10 }}>
          <QuotePdfDocument data={data} />
        </PDFViewer>
      )}
    </div>
  )
}
