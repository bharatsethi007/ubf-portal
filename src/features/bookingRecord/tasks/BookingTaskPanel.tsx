import { useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { BookingRecord, BookingRecordPatch, BookingTask, StaffUser } from '../bookingRecordTypes'
import { useBookingNotes } from '../notes/useBookingNotes'
import BookingNotesSection from './BookingNotesSection'
import BookingTaskRow, { taskProgressLabel } from './BookingTaskRow'
import MilestoneToggles from './MilestoneToggles'
import type {
  BookingTrackingEvent,
  ContainerTrackingRow,
} from '../tracking/trackingTypes'

type PatchFn = (ui: Partial<BookingRecord>, db: BookingRecordPatch) => void

type Props = {
  bookingId: string
  booking: BookingRecord
  trackingContainers: ContainerTrackingRow[]
  trackingEvents: BookingTrackingEvent[]
  onPatch: PatchFn
  tasks: BookingTask[]
  staff: StaffUser[]
  doneCount: number
  onToggle: (task: BookingTask, done: boolean) => void
  onAdd: (title: string, assignedTo: string | null) => void
  onDelete: (task: BookingTask) => void
  onDueDate: (task: BookingTask, iso: string | null) => void
}

function staffLabel(user: StaffUser): string {
  return user.email.split('@')[0]?.replace(/[._]/g, ' ') ?? user.email
}

function PanelDivider() {
  return <hr className="booking-panel-divider" />
}

export default function BookingTaskPanel({
  bookingId,
  booking,
  trackingContainers,
  trackingEvents,
  onPatch,
  tasks,
  staff,
  doneCount,
  onToggle,
  onAdd,
  onDelete,
  onDueDate,
}: Props) {
  const [text, setText] = useState('')
  const [mentionOpen, setMentionOpen] = useState(false)
  const pendingAssignee = useRef<string | null>(null)
  const { notes, loading: notesLoading, addNote } = useBookingNotes(bookingId)

  const mentionStart = text.lastIndexOf('@')
  const showMention = mentionOpen && mentionStart >= 0
  const query = showMention ? text.slice(mentionStart + 1).toLowerCase() : ''

  const filteredStaff = useMemo(
    () => staff.filter((s) => s.email.toLowerCase().includes(query)),
    [staff, query],
  )

  function pickStaff(user: StaffUser) {
    const before = text.slice(0, mentionStart)
    setText(`${before}@${staffLabel(user)} `)
    pendingAssignee.current = user.user_id
    setMentionOpen(false)
  }

  function submitTask() {
    const title = text.trim()
    if (!title) return
    onAdd(title, pendingAssignee.current)
    setText('')
    pendingAssignee.current = null
  }

  return (
    <aside className="card booking-task-panel">
      <MilestoneToggles
        booking={booking}
        containers={trackingContainers}
        events={trackingEvents}
        onPatch={onPatch}
      />

      <PanelDivider />

      <section className="booking-tasks-section">
        <h4 className="booking-panel-subtitle">Tasks</h4>
        <div className="booking-task-panel__progress">
          <div className="booking-task-panel__progress-bar">
            <div
              className="booking-task-panel__progress-fill"
              style={{ width: tasks.length ? `${(doneCount / tasks.length) * 100}%` : '0%' }}
            />
          </div>
          <span className="booking-task-panel__progress-label">
            {taskProgressLabel(doneCount, tasks.length)}
          </span>
        </div>

        <div className="booking-task-panel__list">
          {tasks.map((task) => (
            <BookingTaskRow
              key={task.id}
              task={task}
              onToggle={(done) => onToggle(task, done)}
              onDueDate={(iso) => onDueDate(task, iso)}
              onDelete={task.is_default ? undefined : () => onDelete(task)}
            />
          ))}
        </div>

        <div className="booking-task-panel__add">
          <div className="booking-task-panel__add-wrap">
            <input
              type="text"
              className="input input--xs booking-task-panel__input"
              placeholder="Add task… (@ to assign)"
              value={text}
              onChange={(e) => {
                const v = e.target.value
                setText(v)
                setMentionOpen(v.includes('@'))
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  submitTask()
                }
              }}
            />
            {showMention && filteredStaff.length > 0 ? (
              <div className="booking-combobox-menu">
                {filteredStaff.map((user) => (
                  <button
                    key={user.user_id}
                    type="button"
                    className="booking-mention-option"
                    onClick={() => pickStaff(user)}
                  >
                    {user.email}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <Button type="button" size="xs" variant="outline" onClick={submitTask}>
            Add
          </Button>
        </div>
      </section>

      <PanelDivider />

      <BookingNotesSection notes={notes} loading={notesLoading} onAdd={addNote} />
    </aside>
  )
}
