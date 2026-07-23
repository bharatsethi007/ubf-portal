import { fmtShort } from '@/utils/format'
import type { BookingTask } from '../bookingRecordTypes'

function staffInitials(email: string): string {
  const local = email.split('@')[0] ?? email
  const parts = local.split(/[._-]+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return local.slice(0, 2).toUpperCase()
}

type Props = {
  task: BookingTask
  onToggle: (done: boolean) => void
  onDueDate: (iso: string | null) => void
  onDelete?: () => void
}

export default function BookingTaskRow({ task, onToggle, onDueDate, onDelete }: Props) {
  const done = task.status === 'done'

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
      {task.assignee ? (
        <span className="booking-task-row__avatar" title={task.assignee.email}>
          {staffInitials(task.assignee.email)}
        </span>
      ) : (
        <span className="booking-task-row__avatar booking-task-row__avatar--empty" aria-hidden />
      )}
      <input
        type="date"
        className="input input--sm booking-task-row__due"
        value={task.due_date ?? ''}
        onChange={(e) => onDueDate(e.target.value || null)}
        aria-label="Due date"
      />
      {!task.is_default && onDelete ? (
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

export function formatTaskDue(iso: string | null): string {
  return iso ? fmtShort(iso) : ''
}
