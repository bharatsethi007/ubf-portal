import { countUnresolvedBookingConflicts } from '@/features/bookingRecord/containers/containerConflictUtils'
import type { ImportSeaRow } from './types'

type Props = {
  rows: ImportSeaRow[]
  filteredCount: number
}

export default function ImportSeaBoardSummary({ rows, filteredCount }: Props) {
  const conflictBookings = countUnresolvedBookingConflicts(rows)

  return (
    <div className="import-sea-board-summary">
      <span>{filteredCount} booking{filteredCount === 1 ? '' : 's'}</span>
      {conflictBookings > 0 ? (
        <span className="import-sea-board-summary__warn">
          {conflictBookings} container conflict{conflictBookings === 1 ? '' : 's'}
        </span>
      ) : null}
    </div>
  )
}
