import { supabase } from '../../supabase'
import type { BookingDocument } from '../../types/bookingDocument'

const BUCKET = 'booking-documents'
const DOC_SELECT = 'id, booking_id, file_name, storage_path, mime_type, size_bytes, created_at'

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || bytes <= 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function buildStoragePath(accountId: string, bookingId: string, fileName: string): string {
  return `${accountId}/${bookingId}/${Date.now()}_${fileName}`
}

export async function loadBookingDocuments(bookingId: string): Promise<BookingDocument[]> {
  const { data, error } = await supabase
    .from('booking_documents')
    .select(DOC_SELECT)
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as BookingDocument[]
}

export async function uploadBookingFile(
  file: File,
  bookingId: string,
  accountId: string,
): Promise<BookingDocument> {
  const path = buildStoragePath(accountId, bookingId, file.name)
  const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  })
  if (uploadErr) throw new Error(uploadErr.message)

  const { data, error: insertErr } = await supabase
    .from('booking_documents')
    .insert({
      booking_id: bookingId,
      file_name: file.name,
      storage_path: path,
      mime_type: file.type || null,
      size_bytes: file.size,
    })
    .select(DOC_SELECT)
    .single()

  if (insertErr || !data) {
    await supabase.storage.from(BUCKET).remove([path])
    throw new Error(insertErr?.message ?? 'Failed to save document record')
  }
  return data as BookingDocument
}

export async function deleteBookingDocument(doc: BookingDocument): Promise<void> {
  const { error: storageErr } = await supabase.storage.from(BUCKET).remove([doc.storage_path])
  if (storageErr) throw new Error(storageErr.message)
  const { error } = await supabase.from('booking_documents').delete().eq('id', doc.id)
  if (error) throw new Error(error.message)
}

export async function signedDownloadUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 3600)
  if (error || !data?.signedUrl) throw new Error(error?.message ?? 'Failed to create download link')
  return data.signedUrl
}
