import { Button } from '@/components/ui/button'
import type { BookingContainerRow, ContainerConflictResolution } from './bookingContainerTypes'

type Props = {
  row: BookingContainerRow
  onResolve: (resolution: ContainerConflictResolution) => void
  busy?: boolean
}

export default function BookingContainerConflictActions({ row, onResolve, busy }: Props) {
  const canUseErp = row.conflict_status === 'type_mismatch' ||
    (row.conflict_status === 'erp_only' && Boolean(row.erp_container_type))

  return (
    <div className="booking-container-conflict__actions">
      <Button
        type="button"
        variant="outline"
        size="xs"
        disabled={busy}
        onClick={() => onResolve('kept_manual')}
      >
        Keep mine
      </Button>
      <Button
        type="button"
        variant="outline"
        size="xs"
        disabled={busy || !canUseErp}
        onClick={() => onResolve('kept_erp')}
      >
        Use ERP
      </Button>
      <Button
        type="button"
        variant="outline"
        size="xs"
        disabled={busy}
        onClick={() => onResolve('both_valid')}
      >
        Both are correct
      </Button>
    </div>
  )
}
