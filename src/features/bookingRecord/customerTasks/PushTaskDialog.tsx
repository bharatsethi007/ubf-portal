import { useEffect, useState } from 'react'
import { Send } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import DateField from '@/components/DateField'
import { DOC_OPTIONS, KIND_META, type CustomerTaskKind, type PushTaskInput } from './customerTasksApi'

type Props = {
  open: boolean
  onClose: () => void
  containers: string[]
  onSend: (input: Omit<PushTaskInput, 'bookingId'>) => Promise<boolean>
}

const KINDS: CustomerTaskKind[] = ['empty_ready', 'confirm_delivery', 'upload_docs', 'approve', 'question', 'todo']
const label = { fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 4, display: 'block' } as const
const row = { marginBottom: 12 } as const

export default function PushTaskDialog({ open, onClose, containers, onSend }: Props) {
  const [kind, setKind] = useState<CustomerTaskKind>('empty_ready')
  const [title, setTitle] = useState(KIND_META.empty_ready.defaultTitle)
  const [note, setNote] = useState('')
  const [due, setDue] = useState<string | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [docs, setDocs] = useState<Set<string>>(new Set(['Commercial invoice', 'Packing list']))
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setKind('empty_ready'); setTitle(KIND_META.empty_ready.defaultTitle); setNote(''); setDue(null)
    setPicked(new Set(containers)); setBusy(false)
  }, [open, containers])

  function changeKind(k: CustomerTaskKind) {
    setKind(k)
    setTitle(KIND_META[k].defaultTitle)
  }

  function toggle(set: Set<string>, v: string, apply: (s: Set<string>) => void) {
    const n = new Set(set)
    if (n.has(v)) n.delete(v); else n.add(v)
    apply(n)
  }

  const needsContainer = KIND_META[kind].needsContainer
  const needsNote = kind === 'question' || kind === 'approve'
  const canSend = title.trim() !== ''
    && (!needsContainer || picked.size > 0)
    && (!needsNote || note.trim() !== '')
    && (kind !== 'upload_docs' || docs.size > 0)

  async function send() {
    if (!canSend || busy) return
    setBusy(true)
    const containerNos = picked.size > 0 && (needsContainer || picked.size < containers.length)
      ? [...picked] : [null]
    const ok = await onSend({
      kind,
      title: title.trim(),
      description: note.trim() || null,
      containerNos,
      dueDate: due,
      payload: kind === 'upload_docs' ? { docs: [...docs] } : {},
    })
    setBusy(false)
    if (ok) onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent style={{ maxWidth: 480 }}>
        <DialogTitle>Send task to customer</DialogTitle>

        <div style={row}>
          <span style={label}>Type</span>
          <select className="input input--sm" value={kind} onChange={(e) => changeKind(e.target.value as CustomerTaskKind)}>
            {KINDS.map((k) => <option key={k} value={k}>{KIND_META[k].label}</option>)}
          </select>
        </div>

        <div style={row}>
          <span style={label}>Title</span>
          <input className="input input--sm" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        {containers.length > 0 ? (
          <div style={row}>
            <span style={label}>{needsContainer ? 'Containers (one task each)' : 'Containers (all = whole booking)'}</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {containers.map((c) => (
                <label key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12 }} className="mono">
                  <input type="checkbox" checked={picked.has(c)} onChange={() => toggle(picked, c, setPicked)} />
                  {c}
                </label>
              ))}
            </div>
          </div>
        ) : null}

        {kind === 'upload_docs' ? (
          <div style={row}>
            <span style={label}>Documents needed</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {DOC_OPTIONS.map((d) => (
                <label key={d} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                  <input type="checkbox" checked={docs.has(d)} onChange={() => toggle(docs, d, setDocs)} />
                  {d}
                </label>
              ))}
            </div>
          </div>
        ) : null}

        <div style={row}>
          <span style={label}>Due</span>
          <DateField value={due} onChange={setDue} width={160} placeholder="Optional" />
        </div>

        <div style={row}>
          <span style={label}>{needsNote ? (kind === 'question' ? 'Question' : 'What to approve') : 'Note (optional)'}</span>
          <textarea className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} style={{ height: 'auto', padding: 8 }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <button type="button" className="text-link" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn btn--inline"
            title="Send to customer"
            aria-label="Send to customer"
            disabled={!canSend || busy}
            onClick={() => void send()}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 32, padding: 0 }}
          >
            <Send size={15} />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
