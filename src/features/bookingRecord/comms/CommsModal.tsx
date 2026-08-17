import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useBookingComms } from './useBookingComms'
import CommsFeed from './CommsFeed'
import CommsComposer from './CommsComposer'
import './comms.css'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookingRef: string
  comms: ReturnType<typeof useBookingComms>
}

export default function CommsModal({ open, onOpenChange, bookingRef, comms }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[80vw] w-[80vw] h-[80vh] max-h-[85vh] p-0 gap-0 flex flex-col overflow-hidden rounded-2xl">
        <div className="comms-modal__head">
          <DialogTitle className="comms-modal__title">Comms · <span className="mono">{bookingRef}</span></DialogTitle>
          <p className="comms-modal__sub">Customer communications for this job. Visible to all staff.</p>
        </div>
        <div className="comms-modal__body">
          <div className="comms-modal__feed">
            <CommsFeed comms={comms.comms} loading={comms.loading} canDelete={comms.isAdmin} onDelete={comms.removeComm} />
          </div>
          <div className="comms-modal__composer">
            <CommsComposer onSubmit={comms.addComm} mentionStaff={comms.mentionStaff} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
