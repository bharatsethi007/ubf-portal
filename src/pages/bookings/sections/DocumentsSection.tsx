import type { RefObject } from 'react'
import BookingDocuments, { type BookingDocumentsHandle } from '../../../components/bookings/BookingDocuments'
import type { BookingDocument } from '../../../types/bookingDocument'
import { SectionCard } from '../formUi'

type Props = {
  bookingId?: string
  accountId?: string
  documents: BookingDocument[]
  documentsRef: RefObject<BookingDocumentsHandle | null>
}

export default function DocumentsSection({ bookingId, accountId, documents, documentsRef }: Props) {
  return (
    <SectionCard title="Documents">
      <BookingDocuments
        ref={documentsRef}
        bookingId={bookingId}
        accountId={accountId}
        initialDocuments={documents}
      />
    </SectionCard>
  )
}
