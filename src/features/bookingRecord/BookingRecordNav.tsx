import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Props = {
  backHref: string
  onNewBooking: () => void
}

export default function BookingRecordNav({ backHref, onNewBooking }: Props) {
  return (
    <div className="booking-record-nav">
      <Link to={backHref} className="detail-back booking-record-back">
        ← Back to Import Sea board
      </Link>
      <Button type="button" size="sm" onClick={onNewBooking}>
        <Plus size={14} />
        New booking
      </Button>
    </div>
  )
}
