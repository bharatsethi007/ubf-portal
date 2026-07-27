import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { fetchHoldReasons, type HoldReason } from '@/features/bookingRecord/holdReasonsApi'
import { bulkUpdateBookings } from '@/components/board/boardBulkUpdate'
import { toastBulkUpdateResult } from '@/components/board/bulkResultToast'
import type { ImportSeaRow } from '../types'

type Props = {
  rows: ImportSeaRow[]
  disabled?: boolean
  onApplied: () => void
}

export default function ImportSeaBulkSetHold({ rows, disabled, onApplied }: Props) {
  const [open, setOpen] = useState(false)
  const [reasons, setReasons] = useState<HoldReason[]>([])
  const [holdCode, setHoldCode] = useState<string>('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    void fetchHoldReasons().then(setReasons).catch(() => setReasons([]))
  }, [open])

  async function apply() {
    setBusy(true)
    try {
      const patch = holdCode === '__clear__'
        ? { hold_code: null, hold_reason: null }
        : {
            hold_code: holdCode || null,
            hold_reason: note.trim() || null,
          }
      const result = await bulkUpdateBookings(
        rows.map((row) => ({
          id: row.id,
          booking_ref: row.booking_ref,
          patch,
        })),
      )
      toastBulkUpdateResult('Set hold', result.succeeded.length, result.failed)
      if (result.succeeded.length) {
        setOpen(false)
        setHoldCode('')
        setNote('')
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
        Set hold
        <ChevronDown size={14} />
      </PopoverTrigger>
      <PopoverContent align="start" className="import-sea-bulk-popover">
        <label className="filter-field booking-form-field">
          <span className="filter-field__label">Hold reason</span>
          <select
            className="input input--sm"
            value={holdCode}
            onChange={(e) => setHoldCode(e.target.value)}
          >
            <option value="">Select…</option>
            <option value="__clear__">Clear hold</option>
            {reasons.map((r) => (
              <option key={r.code} value={r.code}>{r.label}</option>
            ))}
          </select>
        </label>
        {holdCode && holdCode !== '__clear__' ? (
          <label className="filter-field booking-form-field">
            <span className="filter-field__label">Note (optional)</span>
            <textarea
              className="input input--sm"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
        ) : null}
        <Button
          type="button"
          size="sm"
          disabled={busy || !holdCode}
          onClick={() => void apply()}
        >
          Apply to {rows.length} booking{rows.length === 1 ? '' : 's'}
        </Button>
      </PopoverContent>
    </Popover>
  )
}
