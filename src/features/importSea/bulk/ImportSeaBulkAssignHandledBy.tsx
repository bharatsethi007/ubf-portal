import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import StaffField from '@/features/bookingRecord/form/StaffField'
import { fetchStaffUsers } from '@/features/bookingRecord/bookingRecordApi'
import type { StaffUser } from '@/features/bookingRecord/bookingRecordTypes'
import { bulkUpdateBookings } from '@/components/board/boardBulkUpdate'
import { toastBulkUpdateResult } from '@/components/board/bulkResultToast'
import type { ImportSeaRow } from '../types'

type Props = {
  rows: ImportSeaRow[]
  disabled?: boolean
  onApplied: () => void
}

export default function ImportSeaBulkAssignHandledBy({ rows, disabled, onApplied }: Props) {
  const [open, setOpen] = useState(false)
  const [staff, setStaff] = useState<StaffUser[]>([])
  const [handledBy, setHandledBy] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    void fetchStaffUsers().then(setStaff).catch(() => setStaff([]))
  }, [open])

  async function apply() {
    setBusy(true)
    try {
      const result = await bulkUpdateBookings(
        rows.map((row) => ({
          id: row.id,
          booking_ref: row.booking_ref,
          patch: { handled_by: handledBy },
        })),
      )
      toastBulkUpdateResult('Assign handled by', result.succeeded.length, result.failed)
      if (result.succeeded.length) {
        setOpen(false)
        onApplied()
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button type="button" size="sm" variant="outline" disabled={disabled || busy} />
        }
      >
        Assign handled by
        <ChevronDown size={14} />
      </PopoverTrigger>
      <PopoverContent align="start" className="import-sea-bulk-popover">
        <StaffField value={handledBy} staff={staff} onChange={setHandledBy} />
        <Button type="button" size="sm" disabled={busy} onClick={() => void apply()}>
          Apply to {rows.length} booking{rows.length === 1 ? '' : 's'}
        </Button>
      </PopoverContent>
    </Popover>
  )
}
