import { useParams } from 'react-router-dom'
import EaBookingView from './EaBookingView'

/** /bookings/export-air/:bookingId */
export default function EaBookingPage() {
  const { bookingId } = useParams()
  return bookingId ? <EaBookingView key={bookingId} bookingId={bookingId} /> : null
}
