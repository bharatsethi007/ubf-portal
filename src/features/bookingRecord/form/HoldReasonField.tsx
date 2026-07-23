import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { fetchHoldReasons, type HoldReason } from '../holdReasonsApi'

type Props = {
  value: string | null
  onChange: (code: string | null, label: string | null) => void
}

export default function HoldReasonField({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [reasons, setReasons] = useState<HoldReason[]>([])
  const selected = reasons.find((r) => r.code === value)

  useEffect(() => {
    void fetchHoldReasons().then(setReasons).catch(() => setReasons([]))
  }, [])

  function pick(code: string | null) {
    const hit = reasons.find((r) => r.code === code)
    onChange(code, hit?.label ?? null)
    setOpen(false)
  }

  return (
    <label className="filter-field booking-form-field">
      <span className="filter-field__label">Hold</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              className="booking-hold-select"
            />
          }
        >
          {selected?.label ?? 'None'}
          <ChevronDown size={14} className="booking-hold-select__chev" />
        </PopoverTrigger>
        <PopoverContent align="start" className="booking-hold-select-menu">
          <ul className="booking-combobox-menu booking-hold-select-list" role="listbox">
            <li>
              <button
                type="button"
                className={`booking-combobox-option${!value ? ' booking-combobox-option--active' : ''}`}
                onClick={() => pick(null)}
              >
                None
              </button>
            </li>
            {reasons.map((r) => (
              <li key={r.code}>
                <button
                  type="button"
                  className={`booking-combobox-option${value === r.code ? ' booking-combobox-option--active' : ''}`}
                  onClick={() => pick(r.code)}
                >
                  {r.label}
                </button>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
    </label>
  )
}
