import { useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { useBookingTasks } from '../useBookingTasks'
import { useBookingNotes } from '../notes/useBookingNotes'
import BookingTaskRow, { taskProgressLabel } from './BookingTaskRow'
import BookingNotesSection from './BookingNotesSection'

type Tab = 'tasks' | 'mentions' | 'notes'

export default function BookingTasksBell({ bookingId }: { bookingId: string }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('tasks')
  const [text, setText] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const { tasks, doneCount, toggleDone, addTask, removeTask, setDueDate } = useBookingTasks(bookingId)
  const { notes, loading: notesLoading, addNote } = useBookingNotes(bookingId)

  const openCount = tasks.length - doneCount
  const mentions = tasks.filter((t) => t.assigned_to)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function submit() {
    const title = text.trim()
    if (!title) return
    addTask(title, null)
    setText('')
  }

  const rows = (list: typeof tasks) => (
    <div className="booking-task-panel__list">
      {list.map((task) => (
        <BookingTaskRow
          key={task.id}
          task={task}
          onToggle={(done) => toggleDone(task, done)}
          onDueDate={(iso) => setDueDate(task, iso)}
          onDelete={task.is_default ? undefined : () => removeTask(task)}
        />
      ))}
    </div>
  )

  return (
    <div className="tasks-bell" ref={ref}>
      <button
        type="button"
        className="master-bill-field__copy tasks-bell__btn"
        title="Tasks, mentions & notes"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell size={16} />
        {tasks.length > 0 ? (
          openCount > 0
            ? <span className="tasks-bell__badge">{openCount}/{tasks.length}</span>
            : <span className="tasks-bell__badge tasks-bell__badge--done" title="All tasks complete" />
        ) : null}
      </button>

      {open ? (
        <div className="tasks-bell__panel">
          <div className="tasks-bell__tabs">
            <button type="button" className={`tasks-bell__tab${tab === 'tasks' ? ' on' : ''}`} onClick={() => setTab('tasks')}>Tasks</button>
            <button type="button" className={`tasks-bell__tab${tab === 'mentions' ? ' on' : ''}`} onClick={() => setTab('mentions')}>Mentions{mentions.length ? ` (${mentions.length})` : ''}</button>
            <button type="button" className={`tasks-bell__tab${tab === 'notes' ? ' on' : ''}`} onClick={() => setTab('notes')}>Notes</button>
          </div>

          <div className="tasks-bell__body">
            {tab === 'tasks' ? (
              <>
                <div className="tasks-bell__progress-label">{taskProgressLabel(doneCount, tasks.length)}</div>
                {rows(tasks)}
                <div className="booking-task-panel__add">
                  <input
                    type="text"
                    className="input input--xs booking-task-panel__input"
                    placeholder="Add task…"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
                  />
                  <button type="button" className="btn" onClick={submit}>Add</button>
                </div>
              </>
            ) : null}

            {tab === 'mentions' ? (
              mentions.length ? rows(mentions) : <p className="muted" style={{ fontSize: 12, padding: '8px 2px' }}>No mentions yet.</p>
            ) : null}

            {tab === 'notes' ? <BookingNotesSection notes={notes} loading={notesLoading} onAdd={addNote} /> : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
