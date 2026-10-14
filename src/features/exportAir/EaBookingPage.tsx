import { useParams } from 'react-router-dom'
import EaHawbShell from './master/EaHawbShell'

/** /bookings/export-air/:bookingId */
export default function EaBookingPage() {
  const { bookingId } = useParams()
  return bookingId ? <EaHawbShell key={bookingId} bookingId={bookingId} /> : null
}
