import { useEffect, useRef } from 'react'
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
  focusLabel?: string | null
  onClose: () => void
}

export default function PortConnectDetailModal({ visit, focusLabel, onClose }: Props) {
  const open = Boolean(visit)
  const row = visit?.row
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || !focusLabel || !scrollRef.current) return
    const el = scrollRef.current.querySelector(`[data-pc-field="${CSS.escape(focusLabel)}"]`)
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    el?.classList.add('pc-detail-panel__row--focus')
    const timer = window.setTimeout(() => {
      el?.classList.remove('pc-detail-panel__row--focus')
    }, 2500)
    return () => window.clearTimeout(timer)
  }, [open, focusLabel, visit?.row.container_no])

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
          <div ref={scrollRef} className="pc-detail-modal__panels">
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
