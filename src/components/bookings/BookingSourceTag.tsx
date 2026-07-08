import type { BookingSource } from '../../types/booking'

export default function BookingSourceTag({ source }: { source: BookingSource }) {
  if (source === 'customer_portal') return <span className="pill transit">Portal</span>
  if (source === 'email_parsed') return <span className="pill parsed">Parsed</span>
  if (source === 'email_import') return <span className="pill email-import">Email</span>
  return <span className="muted">Manual</span>
}
