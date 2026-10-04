// Customer portal: booking documents shared by UBF + customer uploads. Files live in S3.
// RLS on booking_documents returns only shared docs on the customer's own bookings.
import { supabase } from '../../../supabase'
import { fileKey, removeFiles, signedUrl, uploadFile } from '../../../lib/fileStore'

export type PortalDocument = {
  id: string
  file_name: string
  storage_path: string
  mime_type: string | null
  size_bytes: number | null
  created_at: string
  uploaded_via: 'staff' | 'customer'
}

const SELECT = 'id, file_name, storage_path, mime_type, size_bytes, created_at, uploaded_via'

export async function listPortalDocuments(bookingId: string): Promise<PortalDocument[]> {
  const { data, error } = await supabase
    .from('booking_documents')
    .select(SELECT)
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as PortalDocument[]
}

/** Upload to S3 under <account>/<booking>/ then record it. Always visible to staff and the customer. */
export async function uploadPortalDocument(bookingId: string, file: File): Promise<PortalDocument> {
  const [{ data: acct }, { data: auth }] = await Promise.all([
    supabase.rpc('my_account_id'),
    supabase.auth.getUser(),
  ])
  if (!acct || !auth.user) throw new Error('Not signed in')
  const safe = file.name.replace(/[^\w.\-()+ ]/g, '_')
  const path = `${acct}/${bookingId}/${Date.now()}_${safe}`
  await uploadFile(fileKey('booking-documents', path), file, { contentType: file.type || undefined })
  const { data, error } = await supabase
    .from('booking_documents')
    .insert({
      booking_id: bookingId,
      file_name: file.name,
      storage_path: path,
      mime_type: file.type || null,
      size_bytes: file.size,
      uploaded_by: auth.user.id,
      uploaded_via: 'customer',
      customer_visible: true,
    })
    .select(SELECT)
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Could not save document')
  return data as PortalDocument
}

/** Own upload: deleted for good (S3 + record). UB Freight doc: removed from the customer's list only. */
export async function removePortalDocument(doc: PortalDocument): Promise<void> {
  if (doc.uploaded_via === 'customer') await removeFiles([fileKey('booking-documents', doc.storage_path)])
  const { error } = await supabase.rpc('portal_remove_document', { p_doc: doc.id })
  if (error) throw new Error('Could not remove the document. Try again.')
}

export function portalDocumentUrl(doc: PortalDocument, download = false): Promise<string> {
  return signedUrl(fileKey('booking-documents', doc.storage_path), {
    expires: 3600,
    download: download ? doc.file_name : undefined,
  })
}
