import { Navigate, useParams } from 'react-router-dom'
import BookingRecordPage from '../features/bookingRecord/BookingRecordPage'

export const BOOKING_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Renders booking record for /bookings/:bookingId when segment is a UUID. */
export function BookingRecordRoute() {
  const { bookingId } = useParams()
  if (!bookingId || !BOOKING_ID_RE.test(bookingId)) {
    return <Navigate to="/bookings/ES" replace />
  }
  return <BookingRecordPage />
}
