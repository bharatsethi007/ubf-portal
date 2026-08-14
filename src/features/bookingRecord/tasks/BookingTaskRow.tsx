import { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { fmtShort } from '@/utils/format'
import { staffInitials, staffDisplayName } from '../staffDisplayUtils'
import type { BookingTask, StaffUser } from '../bookingRecordTypes'

type Props = {
  task: BookingTask
  staff: StaffUser[]
  onToggle: (done: boolean, invoiceNo?: string | null) => void
  onAssign: (userId: string | null) => void
  onDelete?: () => void
}

export default function BookingTaskRow({ task, staff, onToggle, onAssign, onDelete }: Props) {
  const done = task.status === 'done'
  const [assignOpen, setAssignOpen] = useState(false)
  const [invoicePrompt, setInvoicePrompt] = useState(false)
  const [invoiceNo, setInvoiceNo] = useState('')

  function pick(userId: string | null) {
    onAssign(userId)
    setAssignOpen(false)
  }

  function handleToggle(checked: boolean) {
    if (checked && task.billable && !done) {
      setInvoiceNo(task.invoice_no ?? '')
      setInvoicePrompt(true)
      return
    }
    onToggle(checked)
  }

  function confirmInvoice() {
    const inv = invoiceNo.trim()
    if (!inv) return
    onToggle(true, inv)
    setInvoicePrompt(false)
  }

  return (
    <div className="booking-task-row">
      <input
        type="checkbox"
        className="booking-task-row__check"
        checked={done}
        onChange={(e) => handleToggle(e.target.checked)}
        aria-label={`Mark ${task.title} done`}
      />
      <span className={`booking-task-row__title${done ? ' booking-task-row__title--done' : ''}`}>
        {task.billable ? (
          <span className="booking-task-row__billable" title="Billable — invoice required">$</span>
        ) : null}
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
        <PopoverContent align="end" className="booking-task-assignee-menu">
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
        <span className="booking-task-row__date">
          {fmtShort(task.completed_at)}
          {task.billable && task.invoice_no ? (
            <span className="booking-task-row__inv"> &middot; {task.invoice_no}</span>
          ) : null}
        </span>
      ) : (
        <span className="booking-task-row__date" aria-hidden />
      )}

      {onDelete ? (
        <button type="button" className="text-link booking-task-row__delete" onClick={onDelete}>
          Delete
        </button>
      ) : null}

      {invoicePrompt ? (
        <div className="booking-task-row__invoice-prompt">
          <input
            type="text"
            className="input input--xs"
            placeholder="Invoice number\u2026"
            value={invoiceNo}
            autoFocus
            onChange={(e) => setInvoiceNo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); confirmInvoice() }
              if (e.key === 'Escape') { setInvoicePrompt(false) }
            }}
          />
          <button type="button" className="btn" onClick={confirmInvoice} disabled={!invoiceNo.trim()}>
            Save
          </button>
          <button type="button" className="text-link" onClick={() => setInvoicePrompt(false)}>
            Cancel
          </button>
        </div>
      ) : null}
    </div>
  )
}

export function taskProgressLabel(done: number, total: number): string {
  return `${done} of ${total} complete`
}
