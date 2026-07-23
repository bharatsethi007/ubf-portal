export type DocumentTag = {
  id: string
  name: string
  is_system: boolean
}

export type BookingDocumentRow = {
  id: string
  booking_id: string
  file_name: string
  storage_path: string
  mime_type: string | null
  size_bytes: number | null
  created_at: string
  tag_id: string | null
  uploaded_by: string | null
  tag_name: string | null
  uploader_email: string | null
}

export type PendingUpload = {
  key: string
  file: File
  tagId: string | null
}

export type UploadProgressRow = {
  key: string
  name: string
  status: 'uploading' | 'done' | 'error'
  error?: string
}

export function isPreviewable(mime: string | null, fileName: string): boolean {
  if (mime?.startsWith('image/')) return true
  if (mime === 'application/pdf') return true
  const lower = fileName.toLowerCase()
  return lower.endsWith('.pdf') || /\.(png|jpe?g|gif|webp)$/i.test(lower)
}
