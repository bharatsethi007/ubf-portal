import { Link } from 'react-router-dom'

type Props = {
  backHref: string
  onNewBooking?: () => void
}

export default function BookingRecordNav({ backHref }: Props) {
  return (
    <div className="booking-record-nav">
      <Link to={backHref} className="detail-back booking-record-back">
        ← Back to Import Sea board
      </Link>
    </div>
  )
}
