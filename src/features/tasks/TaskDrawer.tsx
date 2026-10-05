import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Circle, X } from 'lucide-react'
import { toast } from 'sonner'
import DateField from '@/components/DateField'
import type { StaffUser } from '@/features/bookingRecord/bookingRecordTypes'
import { staffDisplayName } from '@/features/bookingRecord/staffDisplayUtils'
import TaskComments from './TaskComments'
import TaskSubtasks from './TaskSubtasks'
import { errText, fetchTask, updateTask, type Priority, type StaffTask, type TaskPatch } from './tasksApi'

type Props = { taskId: string | null; staff: StaffUser[]; onClose: () => void; onChanged?: () => void }

const label = { fontSize: 11, color: '#667085', width: 84, flexShrink: 0 } as const
const row = { display: 'flex', alignItems: 'center', gap: 10, minHeight: 32 } as const

/** Right-hand task panel: owner, due, priority, notes, subtasks, comments. Opens from My tasks or a booking. */
export default function TaskDrawer({ taskId, staff, onClose, onChanged }: Props) {
  const [t, setT] = useState<StaffTask | null>(null)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')

  const load = useCallback(async () => {
    if (!taskId) { setT(null); return }
    try {
      const x = await fetchTask(taskId)
      setT(x); setTitle(x?.title ?? ''); setNotes(x?.description ?? '')
    } catch (e) { toast.error(errText(e, 'Could not load task')) }
  }, [taskId])
  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!taskId) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [taskId, onClose])

  if (!taskId) return null

  async function save(patch: TaskPatch) {
    if (!t) return
    setT({ ...t, ...patch })
    try { await updateTask(t.id, patch); onChanged?.() }
    catch (e) { toast.error(errText(e, 'Save failed')); void load() }
  }

  const done = t?.status === 'done'

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,.25)', zIndex: 70 }} />
      <aside role="dialog" aria-label="Task" style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 460, maxWidth: '100vw', background: '#fff', zIndex: 71, boxShadow: '-12px 0 32px rgba(16,24,40,.12)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #EAECF0' }}>
          <button type="button" onClick={() => void save({ status: done ? 'open' : 'done' })} disabled={!t}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${done ? '#ABEFC6' : '#D0D5DD'}`, background: done ? '#ECFDF3' : '#fff', color: done ? '#067647' : '#344054', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer' }}>
            {done ? <CheckCircle2 size={14} /> : <Circle size={14} />} {done ? 'Completed' : 'Mark complete'}
          </button>
          <button type="button" className="icon-btn" title="Close" aria-label="Close" onClick={onClose} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
        </div>

        {!t ? <p style={{ padding: 16, fontSize: 13, color: '#98A2B3' }}>Loading…</p> : (
          <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <textarea value={title} onChange={(e) => setTitle(e.target.value)} rows={1}
              onBlur={() => { const v = title.trim(); if (v && v !== t.title) void save({ title: v }) }}
              style={{ border: 'none', resize: 'none', fontSize: 18, fontWeight: 600, color: '#101828', outline: 'none', padding: 0, fontFamily: 'inherit' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={row}>
                <span style={label}>Booking</span>
                <Link to={`/bookings/${t.booking_id}`} onClick={onClose} className="mono" style={{ fontSize: 13, color: '#2563EB' }}>{t.booking?.booking_ref ?? 'Open booking'}</Link>
                {t.booking?.importer_name ? <span style={{ fontSize: 12, color: '#667085' }}>{t.booking.importer_name}</span> : null}
              </div>
              <div style={row}>
                <span style={label}>Assignee</span>
                <select className="input input--sm" value={t.assigned_to ?? ''} onChange={(e) => void save({ assigned_to: e.target.value || null })} style={{ width: 220 }}>
                  <option value="">Unassigned</option>
                  {staff.map((s) => <option key={s.user_id} value={s.user_id}>{staffDisplayName(s.email)}</option>)}
                </select>
              </div>
              <div style={row}>
                <span style={label}>Due</span>
                <DateField value={t.due_date} onChange={(v) => void save({ due_date: v || null })} width={150} placeholder="No date" />
                {t.due_date ? <button type="button" className="text-link" style={{ fontSize: 12 }} onClick={() => void save({ due_date: null })}>Clear</button> : null}
              </div>
              <div style={row}>
                <span style={label}>Priority</span>
                <select className="input input--sm" value={t.priority} onChange={(e) => void save({ priority: e.target.value as Priority })} style={{ width: 120 }}>
                  <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option>
                </select>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#667085', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Notes</div>
              <textarea className="input" rows={3} value={notes} placeholder="Add detail…" onChange={(e) => setNotes(e.target.value)}
                onBlur={() => { if (notes !== (t.description ?? '')) void save({ description: notes || null }) }}
                style={{ height: 'auto', padding: 8, fontSize: 13 }} />
            </div>

            {t.parent_id ? null : <TaskSubtasks parent={t} onChanged={() => onChanged?.()} />}
            <TaskComments taskId={t.id} staff={staff} />
          </div>
        )}
      </aside>
    </>
  )
}
