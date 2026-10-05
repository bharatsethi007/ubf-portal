import { useCallback, useEffect, useState } from 'react'
import { Send } from 'lucide-react'
import { toast } from 'sonner'
import type { StaffUser } from '@/features/bookingRecord/bookingRecordTypes'
import { staffDisplayName, staffInitials } from '@/features/bookingRecord/staffDisplayUtils'
import { addComment, errText, fetchComments, type TaskComment } from './tasksApi'

function when(ts: string): string {
  const d = new Date(ts)
  return `${d.toLocaleDateString('en-NZ', { timeZone: 'Pacific/Auckland', day: '2-digit', month: '2-digit' })} ${d.toLocaleTimeString('en-NZ', { timeZone: 'Pacific/Auckland', hour: '2-digit', minute: '2-digit', hour12: false })}`
}

/** Thread on a task. Assignee, creator and earlier commenters get a bell alert (DB trigger). */
export default function TaskComments({ taskId, staff }: { taskId: string; staff: StaffUser[] }) {
  const [rows, setRows] = useState<TaskComment[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try { setRows(await fetchComments(taskId)) } catch (e) { toast.error(errText(e, 'Could not load comments')) }
  }, [taskId])
  useEffect(() => { void load() }, [load])

  async function send() {
    const body = text.trim()
    if (!body || busy) return
    setBusy(true)
    try { await addComment(taskId, body); setText(''); await load() }
    catch (e) { toast.error(errText(e, 'Could not post')) }
    finally { setBusy(false) }
  }

  const who = (c: TaskComment) => {
    if (c.author_kind === 'customer') return { name: 'Customer', initials: 'C', bg: '#FEF4E6', fg: '#B54708' }
    const s = staff.find((x) => x.user_id === c.author_id)
    return { name: s ? staffDisplayName(s.email) : 'Staff', initials: s ? staffInitials(s.email, s.initials) : '?', bg: '#EEF4FF', fg: '#0A2472' }
  }

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#667085', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>
        Comments{rows.length ? ` · ${rows.length}` : ''}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 10 }}>
        {rows.length === 0 ? <span style={{ fontSize: 12, color: '#98A2B3' }}>No comments yet.</span> : null}
        {rows.map((c) => {
          const w = who(c)
          return (
            <div key={c.id} style={{ display: 'flex', gap: 8 }}>
              <span style={{ width: 24, height: 24, borderRadius: 12, background: w.bg, color: w.fg, fontSize: 10, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{w.initials}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12 }}><span style={{ color: '#101828', fontWeight: 500 }}>{w.name}</span> <span style={{ color: '#98A2B3' }}>{when(c.created_at)}</span></div>
                <div style={{ fontSize: 13, color: '#344054', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{c.body}</div>
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
        <textarea className="input" rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Comment…  Ctrl+Enter to post"
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void send() } }}
          style={{ flex: 1, height: 'auto', padding: 8, fontSize: 13 }} />
        <button type="button" className="btn btn--inline" title="Post comment" aria-label="Post comment" disabled={!text.trim() || busy}
          onClick={() => void send()} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, padding: 0 }}>
          <Send size={14} />
        </button>
      </div>
    </div>
  )
}
