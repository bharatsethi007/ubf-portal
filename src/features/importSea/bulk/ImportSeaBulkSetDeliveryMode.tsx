import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { bulkUpdateBookings } from '@/components/board/boardBulkUpdate'
import { toastBulkUpdateResult } from '@/components/board/bulkResultToast'
import { DELIVERY_MODE_OPTIONS } from '../importSeaBoardUtils'
import type { ImportSeaRow } from '../types'

type Props = {
  rows: ImportSeaRow[]
  disabled?: boolean
  onApplied: () => void
}

export default function ImportSeaBulkSetDeliveryMode({ rows, disabled, onApplied }: Props) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('')
  const [busy, setBusy] = useState(false)

  async function apply() {
    if (!mode) return
    setBusy(true)
    try {
      const result = await bulkUpdateBookings(
        rows.map((row) => ({
          id: row.id,
          booking_ref: row.booking_ref,
          patch: { delivery_mode: mode },
        })),
      )
      toastBulkUpdateResult('Set delivery mode', result.succeeded.length, result.failed)
      if (result.succeeded.length) {
        setOpen(false)
        setMode('')
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
        Set delivery mode
        <ChevronDown size={14} />
      </PopoverTrigger>
      <PopoverContent align="start" className="import-sea-bulk-popover">
        <label className="filter-field booking-form-field">
          <span className="filter-field__label">Delivery mode</span>
          <select
            className="input input--sm"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
          >
            <option value="">Select…</option>
            {DELIVERY_MODE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
        <Button type="button" size="sm" disabled={busy || !mode} onClick={() => void apply()}>
          Apply to {rows.length} booking{rows.length === 1 ? '' : 's'}
        </Button>
      </PopoverContent>
    </Popover>
  )
}
