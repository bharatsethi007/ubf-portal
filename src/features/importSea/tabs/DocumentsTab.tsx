import { formatFileSize } from '../../../components/bookings/bookingDocumentsApi'
import type { BookingDocument } from '../../../types/bookingDocument'
import EmptyTab from './EmptyTab'

type Props = { documents: BookingDocument[] }

export default function DocumentsTab({ documents }: Props) {
  if (documents.length === 0) {
    return <EmptyTab title="No documents" hint="Upload files on the booking form to see them here." />
  }

  return (
    <ul className="space-y-2 px-1">
      {documents.map((doc) => (
        <li
          key={doc.id}
          className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2"
        >
          <div className="min-w-0">
            <div className="truncate text-[13px] font-medium">{doc.file_name}</div>
            <div className="text-xs text-muted-foreground">
              {formatFileSize(doc.size_bytes)}
              {doc.created_at ? ` · ${doc.created_at.slice(0, 10)}` : ''}
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}
