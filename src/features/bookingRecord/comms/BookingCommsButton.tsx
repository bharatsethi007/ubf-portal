import { useState } from 'react'
import { MessagesSquare } from 'lucide-react'
import { useBookingComms } from './useBookingComms'
import CommsModal from './CommsModal'

export default function BookingCommsButton({ bookingId, bookingRef }: { bookingId: string; bookingRef: string }) {
  const [open, setOpen] = useState(false)
  const comms = useBookingComms(bookingId)

  return (
    <>
      <button type="button" className="master-bill-field__copy tasks-bell__btn" title="Customer comms" onClick={() => setOpen(true)}>
        <MessagesSquare size={16} />
        {comms.complaintOpenCount > 0 ? (
          <span className="tasks-bell__badge" title={`${comms.complaintOpenCount} open complaint(s)`}>{comms.complaintOpenCount}</span>
        ) : null}
      </button>
      <CommsModal open={open} onOpenChange={setOpen} bookingRef={bookingRef} comms={comms} />
    </>
  )
}
