import { formatFileSize } from '@/components/bookings/bookingDocumentsApi'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import DocumentTagMenu from './DocumentTagMenu'
import type { DocumentTag, PendingUpload } from './documentTypes'

type Props = {
  open: boolean
  pending: PendingUpload[]
  tags: DocumentTag[]
  onClose: () => void
  onConfirm: () => void
  onTagChange: (key: string, tagId: string | null) => void
  onCreateTag: (name: string) => Promise<DocumentTag>
}

export default function DocumentUploadConfirm({
  open,
  pending,
  tags,
  onClose,
  onConfirm,
  onTagChange,
  onCreateTag,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tag files before upload</DialogTitle>
        </DialogHeader>
        <ul className="booking-docs-confirm-list">
          {pending.map((item) => (
            <li key={item.key} className="booking-docs-confirm-row">
              <div className="booking-docs-confirm-row__meta">
                <span className="booking-docs-confirm-row__name">{item.file.name}</span>
                <span className="muted">{formatFileSize(item.file.size)}</span>
              </div>
              <DocumentTagMenu
                tags={tags}
                value={item.tagId}
                onChange={(tagId) => onTagChange(item.key, tagId)}
                onCreateTag={onCreateTag}
                compact
              />
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={onConfirm}>Upload {pending.length} file(s)</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
