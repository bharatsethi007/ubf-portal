import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { fmtShort } from '@/utils/format'

type Props = {
  label: string
  value: string | null
  onChange: (isoDate: string | null) => void
  embedded?: boolean
}

function parseDate(iso: string | null): Date | undefined {
  if (!iso) return undefined
  const d = parseISO(iso.includes('T') ? iso : `${iso}T12:00:00`)
  return Number.isNaN(d.getTime()) ? undefined : d
}

function toIso(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

export default function ImportSeaDateField({ label, value, onChange, embedded }: Props) {
  const [open, setOpen] = useState(false)
  const selected = parseDate(value)

  const picker = (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="input input--sm import-sea-date-trigger mono"
          />
        }
      >
        {selected ? fmtShort(toIso(selected)) : ''}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => {
            onChange(d ? toIso(d) : null)
            setOpen(false)
          }}
        />
        {value ? (
          <button
            type="button"
            className="text-link import-sea-date-clear"
            onClick={() => {
              onChange(null)
              setOpen(false)
            }}
          >
            Clear
          </button>
        ) : null}
      </PopoverContent>
    </Popover>
  )

  if (embedded) {
    return (
      <div className="import-sea-date-embedded" onClick={(e) => e.stopPropagation()}>
        {picker}
      </div>
    )
  }

  return (
    <label className="filter-field" onClick={(e) => e.stopPropagation()}>
      <span className="filter-field__label">{label}</span>
      {picker}
    </label>
  )
}
