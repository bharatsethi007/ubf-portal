export type BookingDocument = {
  id: string
  booking_id: string
  file_name: string
  storage_path: string
  mime_type: string | null
  size_bytes: number | null
  created_at?: string
}
