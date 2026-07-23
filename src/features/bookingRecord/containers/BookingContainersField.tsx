import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import BookingContainerRowEditor from './BookingContainerRowEditor'
import type { ContainerConflictResolution } from './bookingContainerTypes'
import type { ContainerListItem } from './useBookingContainers'

type Props = {
  rows: ContainerListItem[]
  onAdd: () => void
  onSave: (
    rowId: string,
    payload: { container_no: string; container_type: string | null; seal_no: string | null },
  ) => void
  onRemove: (rowId: string) => void
  onResolve?: (rowId: string, resolution: ContainerConflictResolution) => void
  resolveBusy?: boolean
}

export default function BookingContainersField({
  rows,
  onAdd,
  onSave,
  onRemove,
  onResolve,
  resolveBusy,
}: Props) {
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
              onSave={(payload) => onSave(row.id, payload)}
              onRemove={() => onRemove(row.id)}
              onResolve={onResolve ? (resolution) => onResolve(row.id, resolution) : undefined}
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
