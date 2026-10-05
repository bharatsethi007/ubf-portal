import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { addSubtask, errText, fetchSubtasks, updateTask, type StaffTask } from './tasksApi'

export default function TaskSubtasks({ parent, onChanged }: { parent: StaffTask; onChanged: () => void }) {
  const [rows, setRows] = useState<StaffTask[]>([])
  const [text, setText] = useState('')

  const load = useCallback(async () => {
    try { setRows(await fetchSubtasks(parent.id)) } catch (e) { toast.error(errText(e, 'Could not load subtasks')) }
  }, [parent.id])
  useEffect(() => { void load() }, [load])

  async function add() {
    const t = text.trim()
    if (!t) return
    setText('')
    try { await addSubtask(parent, t); await load(); onChanged() } catch (e) { toast.error(errText(e, 'Could not add subtask')) }
  }

  async function toggle(s: StaffTask) {
    const status = s.status === 'done' ? 'open' : 'done'
    setRows((rs) => rs.map((r) => (r.id === s.id ? { ...r, status } : r)))
    try { await updateTask(s.id, { status }); onChanged() } catch (e) { toast.error(errText(e, 'Could not update')); void load() }
  }

  const done = rows.filter((r) => r.status === 'done').length

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#667085', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>
        Subtasks{rows.length ? ` · ${done}/${rows.length}` : ''}
      </div>
      {rows.map((s) => (
        <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={s.status === 'done'} onChange={() => void toggle(s)} />
          <span style={{ textDecoration: s.status === 'done' ? 'line-through' : undefined, color: s.status === 'done' ? '#98A2B3' : '#101828' }}>{s.title}</span>
        </label>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
        <button type="button" className="icon-btn" title="Add subtask" aria-label="Add subtask" onClick={() => void add()}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <Plus size={14} />
        </button>
        <input className="input input--sm" placeholder="Add subtask…" value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void add() } }} style={{ flex: 1 }} />
      </div>
    </div>
  )
}
