import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { PortConnectBulkItem } from '../importSeaPortConnectBulk'

type Props = {
  open: boolean
  eligibleCount: number
  ineligible: PortConnectBulkItem[]
  busy?: boolean
  onClose: () => void
  onConfirm: () => void
}

export default function ImportSeaPortConnectConfirmDialog({
  open,
  eligibleCount,
  ineligible,
  busy,
  onClose,
  onConfirm,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Refresh PortConnect</DialogTitle>
          <DialogDescription>
            Refresh {eligibleCount} booking{eligibleCount === 1 ? '' : 's'} from PortConnect.
            Each call is billed.
          </DialogDescription>
        </DialogHeader>

        {ineligible.length > 0 ? (
          <div className="import-sea-pc-confirm__skipped">
            <p className="import-sea-pc-confirm__skipped-title">
              {ineligible.length} booking{ineligible.length === 1 ? '' : 's'} will be skipped:
            </p>
            <ul className="import-sea-pc-confirm__skipped-list">
              {ineligible.slice(0, 8).map(({ row, reason }) => (
                <li key={row.id}>
                  <span className="mono">{row.booking_ref ?? row.id.slice(0, 8)}</span>
                  <span className="muted"> — {reason}</span>
                </li>
              ))}
              {ineligible.length > 8 ? (
                <li className="muted">…and {ineligible.length - 8} more</li>
              ) : null}
            </ul>
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy || eligibleCount === 0}
            onClick={onConfirm}
          >
            {busy ? 'Refreshing…' : `Refresh ${eligibleCount}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
