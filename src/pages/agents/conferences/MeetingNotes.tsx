import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { ArrowLeft, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import type { ViewMode } from './conferencesApi'
import { updateMeeting, type NoteField } from './meetingsApi'

export type MeetingNotesHandle = { openEditor: () => void }

const DEFAULT_FIELD_LABELS = [
  'Key business',
  'Area of business',
  'Strengths',
  'Total staff',
  'Total sales personnel',
  'Branch locations',
  'Discussion',
  'Remarks',
  'Follow up',
] as const

// Fields that render as a tall text area (everything else is compact)
const LARGE_FIELDS = new Set<string>(['Discussion'])

function fieldMinClass(label: string, isMobile: boolean): string {
  if (LARGE_FIELDS.has(label.trim())) return isMobile ? 'min-h-[45vh]' : 'min-h-[200px]'
  return ''
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `f_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
}

function makeDefaultFields(seedDiscussion?: string | null): NoteField[] {
  return DEFAULT_FIELD_LABELS.map((label) => ({
    id: newId(),
    label,
    value: label === 'Discussion' && seedDiscussion ? seedDiscussion : '',
  }))
}

function parseInitialFields(initialFields: unknown, initialNotes: string | null): NoteField[] {
  if (Array.isArray(initialFields) && initialFields.length > 0) {
    return initialFields
      .filter((f): f is Record<string, unknown> => !!f && typeof f === 'object')
      .map((f) => ({
        id: typeof f.id === 'string' ? f.id : newId(),
        label: typeof f.label === 'string' ? f.label : '',
        value: typeof f.value === 'string' ? f.value : '',
      }))
  }
  return makeDefaultFields(initialNotes)
}

function flattenFields(fields: NoteField[]): string {
  return fields
    .map((f) => ({ label: f.label.trim(), value: f.value.trim() }))
    .filter((f) => f.value)
    .map((f) => (f.label ? `${f.label}: ${f.value}` : f.value))
    .join('\n')
}

function AutoTextarea({
  value,
  placeholder,
  minClass,
  onChange,
}: {
  value: string
  placeholder?: string
  minClass?: string
  onChange: (v: string) => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const resize = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [])
  useEffect(() => {
    resize()
  }, [value, resize])
  return (
    <textarea
      ref={ref}
      rows={1}
      className={`w-full resize-none overflow-hidden border-0 bg-transparent text-[15px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground${minClass ? ` ${minClass}` : ''}`}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onInput={resize}
    />
  )
}

function FieldsEditor({
  fields,
  isMobile,
  onChange,
}: {
  fields: NoteField[]
  isMobile: boolean
  onChange: (next: NoteField[]) => void
}) {
  function patch(id: string, part: Partial<NoteField>) {
    onChange(fields.map((f) => (f.id === id ? { ...f, ...part } : f)))
  }
  function remove(id: string) {
    onChange(fields.filter((f) => f.id !== id))
  }
  function add() {
    onChange([...fields, { id: newId(), label: '', value: '' }])
  }
  return (
    <div className={`grid ${isMobile ? 'grid-cols-2' : 'grid-cols-3'} items-start gap-3 p-4`}>
      {fields.map((f) => {
        const large = LARGE_FIELDS.has(f.label.trim())
        return (
          <div
            key={f.id}
            className={`rounded-lg border border-border bg-muted/20 px-3 py-2${large ? ' col-span-full' : ''}`}
          >
            <div className="mb-0.5 flex items-center gap-2">
              <input
                className="min-w-0 flex-1 border-0 bg-transparent text-[11px] font-semibold uppercase tracking-wide text-muted-foreground outline-none placeholder:text-muted-foreground/60"
                placeholder="Field name"
                value={f.label}
                onChange={(e) => patch(f.id, { label: e.target.value })}
              />
              <button
                type="button"
                aria-label="Delete field"
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                onClick={() => remove(f.id)}
              >
                <X size={14} />
              </button>
            </div>
            <AutoTextarea
              value={f.value}
              placeholder="—"
              minClass={fieldMinClass(f.label, isMobile)}
              onChange={(v) => patch(f.id, { value: v })}
            />
          </div>
        )
      })}
      <button
        type="button"
        className="col-span-full inline-flex w-fit items-center gap-1.5 rounded-md border border-dashed border-border px-2.5 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
        onClick={add}
      >
        <Plus size={14} />
        Add field
      </button>
    </div>
  )
}

type Props = {
  meetingId: string
  initialNotes: string | null
  initialFields?: unknown
  viewMode: ViewMode
  onSaved?: (notes: string) => void
  title?: string
  hidePreview?: boolean
}

const MeetingNotes = forwardRef<MeetingNotesHandle, Props>(function MeetingNotes(
  { meetingId, initialNotes, initialFields, viewMode, onSaved, title, hidePreview }: Props,
  ref,
) {
  const [fields, setFields] = useState<NoteField[]>(() =>
    parseInitialFields(initialFields, initialNotes),
  )
  const [savedJson, setSavedJson] = useState(() =>
    JSON.stringify(parseInitialFields(initialFields, initialNotes)),
  )
  const [savedText, setSavedText] = useState(() =>
    flattenFields(parseInitialFields(initialFields, initialNotes)),
  )
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMobile = viewMode === 'mobile'

  useImperativeHandle(ref, () => ({ openEditor: () => setEditing(true) }), [])

  useEffect(() => {
    const parsed = parseInitialFields(initialFields, initialNotes)
    setFields(parsed)
    setSavedJson(JSON.stringify(parsed))
    setSavedText(flattenFields(parsed))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId])

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  const dirty = JSON.stringify(fields) !== savedJson

  async function persist(next: NoteField[]) {
    setSaving(true)
    try {
      const flat = flattenFields(next)
      await updateMeeting(meetingId, {
        notes_fields: next,
        notes: flat.trim() ? flat : null,
      })
      setSavedJson(JSON.stringify(next))
      setSavedText(flat)
      onSaved?.(flat)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save notes')
    } finally {
      setSaving(false)
    }
  }

  function handleChange(next: NoteField[]) {
    setFields(next)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      if (JSON.stringify(next) !== savedJson) void persist(next)
    }, 1200)
  }

  async function closeEditor() {
    if (timer.current) clearTimeout(timer.current)
    if (JSON.stringify(fields) !== savedJson) await persist(fields)
    setEditing(false)
  }

  const statusText = saving ? 'Saving…' : dirty ? 'Unsaved' : savedText ? 'Saved' : ''
  const heading = title ? `Notes — ${title}` : 'Notes'

  const preview = (
    <button
      type="button"
      className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
      onClick={() => setEditing(true)}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Notes
        </span>
        {statusText && <span className="text-[11px] text-muted-foreground">{statusText}</span>}
      </div>
      {savedText.trim() ? (
        <p className="line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {savedText}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">Add notes…</p>
      )}
    </button>
  )

  const editor = <FieldsEditor fields={fields} isMobile={isMobile} onChange={handleChange} />

  return (
    <>
      {!hidePreview && preview}

      {editing && isMobile && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-background">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
            <button
              type="button"
              aria-label="Back"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
              onClick={() => void closeEditor()}
            >
              <ArrowLeft size={20} />
            </button>
            <span className="text-sm font-medium text-foreground">{heading}</span>
            <span className="ml-auto text-xs text-muted-foreground">{statusText}</span>
          </div>
          <div className="flex-1 overflow-y-auto">{editor}</div>
        </div>
      )}

      {editing && !isMobile && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          onClick={() => void closeEditor()}
        >
          <div
            className="flex h-[80vh] w-[80vw] flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <span className="text-sm font-medium text-foreground">{heading}</span>
              <span className="text-xs text-muted-foreground">{statusText}</span>
              <button
                type="button"
                aria-label="Close notes"
                className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                onClick={() => void closeEditor()}
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{editor}</div>
          </div>
        </div>
      )}
    </>
  )
})

export default MeetingNotes
