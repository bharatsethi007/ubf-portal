import { useEffect, useState } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Printer } from 'lucide-react'
import ubLogo from '@/assets/ub-logo.jpg'
import { fetchConsignment, type TmsConsignmentDetail } from './tmsApi'
import { qr, barcode, buildLabelHtml, printLabels } from './consignmentDocs'

export default function LabelsModal({ id, open, onClose }: { id: string | null; open: boolean; onClose: () => void }) {
  const [labels, setLabels] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!open || !id) { setLabels([]); return }
    let cancelled = false
    setLoading(true)
    fetchConsignment(id).then(async (d) => {
      if (!d || cancelled) return
      const cd = d as TmsConsignmentDetail
      const ref = cd.consignment_no ?? cd.id
      const total = Math.max(1, (cd.cargo ?? []).reduce((t, l) => t + (l.units ?? 0), 0))
      const barcodeUrl = barcode(ref)
      const parts: string[] = []
      for (let i = 1; i <= total; i++) {
        const pieceQrUrl = await qr(`${ref}|${i}/${total}`)
        parts.push(buildLabelHtml(cd, i, total, { pieceQrUrl, barcodeUrl, logoUrl: ubLogo }))
      }
      if (!cancelled) setLabels(parts)
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, id])
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <span className="text-sm font-semibold text-neutral-900">Labels</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => printLabels(labels, 'a4')} disabled={!labels.length} className="inline-flex items-center gap-1.5 rounded-lg border border-[#0A2472] px-3 py-1.5 text-sm font-medium text-[#0A2472] hover:bg-[#0A2472]/[0.04] disabled:opacity-50"><Printer size={15} /> Print A4</button>
            <button type="button" onClick={() => printLabels(labels, 'thermal')} disabled={!labels.length} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0A2472] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0A2472]/90 disabled:opacity-50"><Printer size={15} /> Print 100×150</button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto bg-neutral-50 p-4">
          {loading ? <p className="py-8 text-center text-sm text-neutral-400">Preparing labels…</p>
            : labels.map((l, i) => <div key={i} className="mb-4" dangerouslySetInnerHTML={{ __html: l }} />)}
        </div>
      </DialogContent>
    </Dialog>
  )
}
