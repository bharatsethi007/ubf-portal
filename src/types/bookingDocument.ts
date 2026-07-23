export type BookingDocument = {
  id: string
  booking_id: string
  file_name: string
  storage_path: string
  mime_type: string | null
  size_bytes: number | null
  tag_id?: string | null
  uploaded_by?: string | null
  created_at?: string
}
