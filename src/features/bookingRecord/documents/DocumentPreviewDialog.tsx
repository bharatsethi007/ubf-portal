import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { BookingDocumentRow } from './documentTypes'

type Props = {
  doc: BookingDocumentRow | null
  previewUrl: string | null
  onClose: () => void
}

export default function DocumentPreviewDialog({ doc, previewUrl, onClose }: Props) {
  const open = Boolean(doc && previewUrl)
  const isPdf = doc?.mime_type === 'application/pdf' || doc?.file_name.toLowerCase().endsWith('.pdf')
  const isImage = doc?.mime_type?.startsWith('image/') ?? false

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent className="sm:max-w-4xl" showCloseButton>
        <DialogHeader>
          <DialogTitle>{doc?.file_name ?? 'Preview'}</DialogTitle>
        </DialogHeader>
        <div className="booking-doc-preview">
          {previewUrl && isPdf ? (
            <iframe title={doc?.file_name} src={previewUrl} className="booking-doc-preview__frame" />
          ) : null}
          {previewUrl && isImage ? (
            <img src={previewUrl} alt={doc?.file_name ?? ''} className="booking-doc-preview__image" />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
