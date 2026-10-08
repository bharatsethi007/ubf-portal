import { Suspense, lazy, useEffect, useState } from 'react'
import { FileSearch } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog'
import { fetchQuoteResponses } from './quoteResponsesApi'

const QuotePreviewTab = lazy(() => import('./QuotePreviewTab'))

type Resp = { id: string; response_no: string | null }
type Props = { quoteId: string; quoteNo: string | null }

// Floating launcher stacked above the Freight Intelligence bubble.
// Loads responses fresh on every open so the PDF matches current edits.
export default function QuotePreviewBubble({ quoteId, quoteNo }: Props) {
  const [open, setOpen] = useState(false)
  const [responses, setResponses] = useState<Resp[] | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setResponses(null)
    fetchQuoteResponses(quoteId)
      .then((r) => { if (!cancelled) setResponses(r.map((x) => ({ id: x.id, response_no: x.response_no }))) })
      .catch(() => { if (!cancelled) setResponses([]) })
    return () => { cancelled = true }
  }, [open, quoteId])

  return (
    <>
      <button
        type="button"
        title="Preview quote PDF"
        aria-label="Preview quote PDF"
        onClick={() => setOpen(true)}
        className="fixed right-6 bottom-[88px] z-40 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-white text-[#0A2472] shadow-lg ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-xl"
      >
        <FileSearch size={22} strokeWidth={2} />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-3 rounded-xl bg-white p-5 sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Quote preview{quoteNo ? ` · ${quoteNo}` : ''}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(80vh/var(--mz,1))] overflow-auto">
            {responses == null ? (
              <p className="qr-placeholder">Loading preview…</p>
            ) : (
              <Suspense fallback={<p className="qr-placeholder">Loading preview…</p>}>
                <QuotePreviewTab quoteId={quoteId} responses={responses} />
              </Suspense>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
