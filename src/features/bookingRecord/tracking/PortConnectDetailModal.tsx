import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import PortConnectDetailPanel from './PortConnectDetailPanel'
import {
  containerDetailFields,
  eventDetailFields,
  visitDetailFields,
} from './portConnectDetailFields'
import type { PortConnectVisitView } from './trackingTypes'

type Props = {
  visit: PortConnectVisitView | null
  onClose: () => void
}

export default function PortConnectDetailModal({ visit, onClose }: Props) {
  const open = Boolean(visit)
  const row = visit?.row

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent className="pc-detail-modal sm:max-w-6xl" showCloseButton>
        <DialogHeader>
          <DialogTitle className="mono">
            {row?.container_no ?? 'Container'}
          </DialogTitle>
          <DialogDescription>
            PortConnect visit details — times shown in Pacific/Auckland.
          </DialogDescription>
        </DialogHeader>
        {row ? (
          <div className="pc-detail-modal__panels">
            <PortConnectDetailPanel title="Container Details" fields={containerDetailFields(row)} />
            <PortConnectDetailPanel title="Visit Details" fields={visitDetailFields(row)} />
            <PortConnectDetailPanel title="Event Details" fields={eventDetailFields(row)} />
          </div>
        ) : null}
        <p className="muted pc-detail-modal__note">
          Recent container changes can take 10–15 minutes to appear in PortConnect.
        </p>
      </DialogContent>
    </Dialog>
  )
}
