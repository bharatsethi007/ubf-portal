import type { MouseEvent, ReactNode } from 'react'
import { Checkbox } from '@/components/ui/checkbox'

type Props = {
  checked: boolean
  indeterminate?: boolean
  disabled?: boolean
  ariaLabel: string
  onToggle: (shiftKey: boolean) => void
}

export default function BoardRowCheckbox({
  checked,
  indeterminate,
  disabled,
  ariaLabel,
  onToggle,
}: Props) {
  function handleClick(e: MouseEvent) {
    e.stopPropagation()
    if (disabled) return
    onToggle(e.shiftKey)
  }

  return (
    <Checkbox
      checked={checked}
      indeterminate={indeterminate}
      disabled={disabled}
      aria-label={ariaLabel}
      onClick={handleClick}
      onChange={() => undefined}
    />
  )
}

export function BoardHeaderCheckbox({
  state,
  disabled,
  onChange,
}: {
  state: false | true | 'indeterminate'
  disabled?: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <Checkbox
      checked={state === true}
      indeterminate={state === 'indeterminate'}
      disabled={disabled}
      aria-label="Select all filtered rows"
      onChange={(e) => onChange(e.target.checked)}
      onClick={(e) => e.stopPropagation()}
    />
  )
}

export function BoardCheckboxCell({ children }: { children: ReactNode }) {
  return (
    <td className="board-checkbox-cell" onClick={(e) => e.stopPropagation()}>
      {children}
    </td>
  )
}
