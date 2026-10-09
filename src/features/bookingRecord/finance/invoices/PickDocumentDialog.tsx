import { useEffect, useState } from 'react'
import { FilePlus2 } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { listInvoiceCandidateDocs, type InvoiceDoc } from './creditorInvoicesApi'

type Props = { bookingId: string; open: boolean; onOpenChange: (v: boolean) => void; onPick: (docId: string) => Promise<void> }

export default function PickDocumentDialog({ bookingId, open, onOpenChange, onPick }: Props) {
  const [docs, setDocs] = useState<InvoiceDoc[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setDocs(null)
    listInvoiceCandidateDocs(bookingId).then(setDocs).catch((e) => toast.error(e instanceof Error ? e.message : 'Load failed'))
  }, [open, bookingId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" showCloseButton>
        <DialogHeader><DialogTitle>Use a booking document</DialogTitle></DialogHeader>
        {docs == null && <p className="text-muted-foreground">Loading…</p>}
        {docs?.length === 0 && <p className="text-muted-foreground">No unused PDF or image documents on this booking.</p>}
        <div style={{ display: 'grid', gap: 4 }}>
          {docs?.map((d) => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 4px', borderBottom: '1px solid #F1F5F9' }}>
              <span className="text-sm" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.file_name}</span>
              <button className="icon-btn" title="Add as creditor invoice" aria-label="Add as creditor invoice" disabled={busy !== null}
                onClick={async () => { setBusy(d.id); try { await onPick(d.id); onOpenChange(false) } finally { setBusy(null) } }}>
                <FilePlus2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
