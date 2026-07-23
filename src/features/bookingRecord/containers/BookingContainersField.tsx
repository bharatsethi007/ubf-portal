import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import BookingContainerRowEditor from './BookingContainerRowEditor'
import type { ContainerConflictResolution } from './bookingContainerTypes'
import type { ContainerListItem } from './useBookingContainers'
import type { ContainerTrackingRow } from '../tracking/trackingTypes'
import { isContainerOverridden } from '../bookingFieldOverrides'
import type { PortConnectFieldKey } from '../portConnect/portConnectProvenance'

type Props = {
  rows: ContainerListItem[]
  trackingContainers?: ContainerTrackingRow[] | null
  fieldOverrides?: Record<string, boolean> | null
  lastSync?: string | null
  isFlashing?: (key: PortConnectFieldKey) => boolean
  onAdd: () => void
  onSave: (
    rowId: string,
    payload: { container_no: string; container_type: string | null; seal_no: string | null },
  ) => void
  onRemove: (rowId: string) => void
  onResolve?: (rowId: string, resolution: ContainerConflictResolution) => void
  onOverride?: (rowId: string) => void
  onRevert?: (rowId: string) => void
  resolveBusy?: boolean
}

export default function BookingContainersField({
  rows,
  trackingContainers,
  fieldOverrides,
  lastSync,
  isFlashing,
  onAdd,
  onSave,
  onRemove,
  onResolve,
  onOverride,
  onRevert,
  resolveBusy,
}: Props) {
  const trackingByNo = new Map(
    (trackingContainers ?? []).map((row) => [row.container_no.trim().toUpperCase(), row]),
  )

  return (
    <div className="booking-containers-field">
      <span className="filter-field__label">Container(s)</span>
      {rows.length === 0 ? (
        <p className="booking-containers-field__empty">
          No containers yet — add one to enable PortConnect tracking.
        </p>
      ) : (
        <div className="booking-containers-field__list">
          <div className="booking-container-row booking-container-row--head" aria-hidden>
            <span />
            <span>Number</span>
            <span>Type</span>
            <span>Seal</span>
            <span />
          </div>
          {rows.map((row) => (
            <BookingContainerRowEditor
              key={row.id}
              row={row}
              tracking={trackingByNo.get(row.container_no.trim().toUpperCase())}
              onSave={(payload) => onSave(row.id, payload)}
              onRemove={() => onRemove(row.id)}
              onResolve={onResolve ? (resolution) => onResolve(row.id, resolution) : undefined}
              onOverride={onOverride ? () => onOverride(row.id) : undefined}
              onRevert={onRevert ? () => onRevert(row.id) : undefined}
              overridden={isContainerOverridden(row.container_no, fieldOverrides)}
              lastSync={lastSync}
              flashType={isFlashing?.('container_type')}
              flashSeal={isFlashing?.('seal')}
              resolveBusy={resolveBusy}
            />
          ))}
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="booking-containers-field__add"
        onClick={onAdd}
      >
        <Plus size={14} />
        Add container
      </Button>
    </div>
  )
}
