import { supabase } from '@/supabase'
import {
  deleteBookingDocument,
  loadBookingDocuments,
  signedDownloadUrl,
  updateBookingDocumentTag,
  uploadBookingFile,
} from '@/components/bookings/bookingDocumentsApi'
import type { BookingDocument } from '@/types/bookingDocument'
import type { BookingDocumentRow, DocumentTag } from './documentTypes'

async function mapDocuments(rows: BookingDocument[]): Promise<BookingDocumentRow[]> {
  const tagIds = [...new Set(rows.map((r) => r.tag_id).filter(Boolean))] as string[]
  const userIds = [...new Set(rows.map((r) => r.uploaded_by).filter(Boolean))] as string[]

  const [tagsRes, staffRes] = await Promise.all([
    tagIds.length
      ? supabase.from('document_tags').select('id, name').in('id', tagIds)
      : Promise.resolve({ data: [] }),
    userIds.length
      ? supabase.from('staff_users').select('user_id, email').in('user_id', userIds)
      : Promise.resolve({ data: [] }),
  ])

  const tagMap = new Map((tagsRes.data as { id: string; name: string }[] | null)?.map((t) => [t.id, t.name]))
  const staffMap = new Map(
    (staffRes.data as { user_id: string; email: string }[] | null)?.map((s) => [s.user_id, s.email]),
  )

  return rows.map((row) => ({
    id: row.id,
    booking_id: row.booking_id,
    file_name: row.file_name,
    storage_path: row.storage_path,
    mime_type: row.mime_type,
    size_bytes: row.size_bytes,
    created_at: row.created_at ?? '',
    tag_id: row.tag_id ?? null,
    uploaded_by: row.uploaded_by ?? null,
    tag_name: row.tag_id ? tagMap.get(row.tag_id) ?? null : null,
    uploader_email: row.uploaded_by ? staffMap.get(row.uploaded_by) ?? null : null,
  }))
}

export async function fetchBookingDocumentRows(bookingId: string): Promise<BookingDocumentRow[]> {
  const rows = await loadBookingDocuments(bookingId)
  return mapDocuments(rows)
}

export async function fetchDocumentTags(): Promise<DocumentTag[]> {
  const { data, error } = await supabase
    .from('document_tags')
    .select('id, name, is_system')
    .order('name')
  if (error) throw new Error(error.message)
  return (data ?? []) as DocumentTag[]
}

export async function createDocumentTag(name: string, createdBy: string | null): Promise<DocumentTag> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Tag name is required')
  const { data, error } = await supabase
    .from('document_tags')
    .insert({ name: trimmed, is_system: false, created_by: createdBy })
    .select('id, name, is_system')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Failed to create tag')
  return data as DocumentTag
}

export async function uploadTaggedBookingFile(
  file: File,
  bookingId: string,
  accountId: string,
  tagId: string | null,
  uploadedBy: string | null,
): Promise<BookingDocumentRow> {
  const doc = await uploadBookingFile(file, bookingId, accountId, { tagId, uploadedBy })
  const [row] = await mapDocuments([doc])
  return row
}

export { deleteBookingDocument, signedDownloadUrl, updateBookingDocumentTag }
