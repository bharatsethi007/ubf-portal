import { RotateCcw, X } from 'lucide-react'
import { fmtDay, KIND_META, responseSummary, type CustomerTask } from './customerTasksApi'

type Props = {
  tasks: CustomerTask[]
  onCancel: (id: string) => void
  onReopen: (id: string) => void
}

function statusOf(t: CustomerTask): { text: string; bg: string; fg: string } {
  const today = new Date().toISOString().slice(0, 10)
  if (t.status === 'done') return { text: 'Done', bg: '#ECFDF3', fg: '#067647' }
  if (t.status === 'cancelled' || t.status === 'na') return { text: 'Cancelled', bg: '#F2F4F7', fg: '#667085' }
  if (t.due_date && t.due_date < today) return { text: 'Overdue', bg: '#FDECEC', fg: '#B42318' }
  if (t.response) return { text: 'Planned', bg: '#EEF4FF', fg: '#3538CD' }
  return { text: 'Waiting on customer', bg: '#FEF4E6', fg: '#B54708' }
}

const iconBtn = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center' } as const

export default function CustomerTaskList({ tasks, onCancel, onReopen }: Props) {
  if (tasks.length === 0) {
    return <p className="text-muted-foreground" style={{ fontSize: 12, margin: '6px 0' }}>No customer tasks yet.</p>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {tasks.map((t) => {
        const s = statusOf(t)
        const answer = responseSummary(t)
        const docs = Array.isArray(t.payload?.docs) ? (t.payload.docs as string[]).join(', ') : null
        const closed = t.status !== 'open'
        return (
          <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px', border: '1px solid #EAECF0', borderRadius: 8, background: '#fff' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12.5, textDecoration: closed && t.status !== 'done' ? 'line-through' : undefined }}>{t.title}</span>
                <span style={{ background: s.bg, color: s.fg, borderRadius: 10, padding: '1px 8px', fontSize: 11 }}>{s.text}</span>
              </div>
              <div className="text-muted-foreground" style={{ fontSize: 11, marginTop: 2 }}>
                {KIND_META[t.kind]?.label ?? t.kind}
                {t.due_date ? ` · due ${fmtDay(t.due_date)}` : ''}
                {docs ? ` · ${docs}` : ''}
                {t.description ? ` · ${t.description}` : ''}
              </div>
              {answer ? (
                <div style={{ fontSize: 12, marginTop: 4, color: '#0A2472' }}>
                  {answer}
                  {t.responded_at ? <span className="text-muted-foreground" style={{ fontSize: 11 }}> · {fmtDay(t.responded_at)}</span> : null}
                </div>
              ) : null}
            </div>
            {t.status === 'open' ? (
              <button type="button" className="icon-btn" style={iconBtn} title="Cancel task" aria-label="Cancel task" onClick={() => onCancel(t.id)}>
                <X size={14} />
              </button>
            ) : (
              <button type="button" className="icon-btn" style={iconBtn} title="Reopen task" aria-label="Reopen task" onClick={() => onReopen(t.id)}>
                <RotateCcw size={14} />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
