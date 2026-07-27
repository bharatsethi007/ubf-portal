import * as React from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  indeterminate?: boolean
}

const Checkbox = React.forwardRef<HTMLInputElement, Props>(
  ({ className, indeterminate, checked, ...props }, ref) => {
    const innerRef = React.useRef<HTMLInputElement>(null)
    React.useImperativeHandle(ref, () => innerRef.current as HTMLInputElement)

    React.useEffect(() => {
      if (innerRef.current) {
        innerRef.current.indeterminate = Boolean(indeterminate)
      }
    }, [indeterminate])

    return (
      <span className="board-checkbox-wrap">
        <input
          ref={innerRef}
          type="checkbox"
          role="checkbox"
          data-slot="checkbox"
          checked={checked}
          className={cn('board-checkbox', className)}
          {...props}
        />
        <span className="board-checkbox__icon" aria-hidden>
          <Check size={12} strokeWidth={3} />
        </span>
      </span>
    )
  },
)
Checkbox.displayName = 'Checkbox'

export { Checkbox }
