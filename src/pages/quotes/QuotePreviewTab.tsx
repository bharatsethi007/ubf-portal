import { useEffect } from 'react'
import { PDFViewer, PDFDownloadLink } from '@react-pdf/renderer'
import { toast } from 'sonner'
import { registerQuoteFonts } from './pdf/quotePdfFonts'
import QuotePdfDocument from './pdf/QuotePdfDocument'
import { useQuotePdfData, type PdfResp } from './pdf/useQuotePdfData'

registerQuoteFonts()

type Props = { quoteId: string; responses: PdfResp[] }

export default function QuotePreviewTab({ quoteId, responses }: Props) {
  const { data, loading, error } = useQuotePdfData(quoteId, responses)
  useEffect(() => { if (error) toast.error('Failed to load quote for preview') }, [error])

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
