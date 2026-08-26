import { useEffect, useState } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Printer } from 'lucide-react'
import ubLogo from '@/assets/ub-logo.jpg'
import { fetchConsignment, type TmsConsignmentDetail } from './tmsApi'
import { qr, barcode, buildNoteHtml, printHtml } from './consignmentDocs'

export default function ConsignmentNoteModal({ id, open, onClose }: { id: string | null; open: boolean; onClose: () => void }) {
  const [html, setHtml] = useState('')
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!open || !id) { setHtml(''); return }
    let cancelled = false
    setLoading(true)
    fetchConsignment(id).then(async (d) => {
      if (!d || cancelled) return
      const cd = d as TmsConsignmentDetail
      const ref = cd.consignment_no ?? cd.id
      const qrUrl = await qr(ref)
      const barcodeUrl = barcode(ref)
      if (!cancelled) setHtml(buildNoteHtml(cd, { qrUrl, barcodeUrl, logoUrl: ubLogo }))
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, id])
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <span className="text-sm font-semibold text-neutral-900">Consignment note</span>
          <button type="button" onClick={() => printHtml('Consignment note', html)} disabled={!html} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0A2472] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0A2472]/90 disabled:opacity-50"><Printer size={15} /> Print</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto bg-neutral-50 p-4">
          {loading ? <p className="py-8 text-center text-sm text-neutral-400">Preparing…</p> : <div className="rounded-lg bg-white shadow-sm" dangerouslySetInnerHTML={{ __html: html }} />}
        </div>
      </DialogContent>
    </Dialog>
  )
}
