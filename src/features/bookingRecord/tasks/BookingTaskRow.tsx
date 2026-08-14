import { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { fmtShort } from '@/utils/format'
import { staffInitials, staffDisplayName } from '../staffDisplayUtils'
import type { BookingTask, StaffUser } from '../bookingRecordTypes'

type Props = {
  task: BookingTask
  staff: StaffUser[]
  onToggle: (done: boolean) => void
  onAssign: (userId: string | null) => void
  onDelete?: () => void
}

export default function BookingTaskRow({ task, staff, onToggle, onAssign, onDelete }: Props) {
  const done = task.status === 'done'
  const [assignOpen, setAssignOpen] = useState(false)

  function pick(userId: string | null) {
    onAssign(userId)
    setAssignOpen(false)
  }

  return (
    <div className="booking-task-row">
      <input
        type="checkbox"
        className="booking-task-row__check"
        checked={done}
        onChange={(e) => onToggle(e.target.checked)}
        aria-label={`Mark ${task.title} done`}
      />
      <span className={`booking-task-row__title${done ? ' booking-task-row__title--done' : ''}`}>
        {task.title}
      </span>

      <Popover open={assignOpen} onOpenChange={setAssignOpen}>
        <PopoverTrigger
          render={
            <button
              type="button"
              className={`booking-task-row__avatar${task.assignee ? '' : ' booking-task-row__avatar--empty'}`}
              title={task.assignee ? task.assignee.email : 'Assign task'}
            />
          }
        >
          {task.assignee ? staffInitials(task.assignee.email, task.assignee.initials) : ''}
        </PopoverTrigger>
        <PopoverContent align="end" className="booking-staff-select-menu">
          <ul className="booking-combobox-menu booking-staff-select-list" role="listbox">
            <li>
              <button
                type="button"
                className={`booking-combobox-option${!task.assigned_to ? ' booking-combobox-option--active' : ''}`}
                onClick={() => pick(null)}
              >
                Unassigned
              </button>
            </li>
            {staff.map((user) => (
              <li key={user.user_id}>
                <button
                  type="button"
                  className={`booking-combobox-option${task.assigned_to === user.user_id ? ' booking-combobox-option--active' : ''}`}
                  onClick={() => pick(user.user_id)}
                >
                  <span className="import-sea-handler import-sea-handler--form">
                    {staffInitials(user.email, user.initials)}
                  </span>
                  <span>{staffDisplayName(user.email)}</span>
                </button>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>

      {done && task.completed_at ? (
        <span className="booking-task-row__date">{fmtShort(task.completed_at)}</span>
      ) : (
        <span className="booking-task-row__date" aria-hidden />
      )}

      {onDelete ? (
        <button type="button" className="text-link booking-task-row__delete" onClick={onDelete}>
          Delete
        </button>
      ) : null}
    </div>
  )
}

export function taskProgressLabel(done: number, total: number): string {
  return `${done} of ${total} complete`
}
