import { CircleCheck, ListTodo } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { dueLabel, urgencyTone } from './flowText'
import type { BookingFlow } from './useBookingFlow'

type Props = {
  flow: BookingFlow | undefined
  onOpen: () => void
}

/** Rightmost board column: to-do icon coloured by urgency. Click opens the job drawer. */
export default function NextActionCell({ flow, onOpen }: Props) {
  const has = Boolean(flow?.next_action)
  const tone = has ? urgencyTone(flow?.urgency) : 'green'
  const tip = has ? `${flow!.next_action} · ${dueLabel(flow)}` : 'Nothing waiting'

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            className={`bk-todo bk-todo--${tone}`}
            aria-label={`Next action: ${tip}`}
            onClick={(e) => {
              e.stopPropagation()
              onOpen()
            }}
          />
        }
      >
        {has ? <ListTodo size={14} strokeWidth={2} /> : <CircleCheck size={14} strokeWidth={2} />}
      </TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  )
}
