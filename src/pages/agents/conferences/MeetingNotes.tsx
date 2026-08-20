import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, X } from 'lucide-react'
import { toast } from 'sonner'
import type { ViewMode } from './conferencesApi'
import { updateMeeting } from './meetingsApi'

type Props = {
  meetingId: string
  initialNotes: string | null
  viewMode: ViewMode
  onSaved?: (notes: string) => void
  title?: string
}

export default function MeetingNotes({ meetingId, initialNotes, viewMode, onSaved, title }: Props) {
  const [notes, setNotes] = useState(initialNotes ?? '')
  const [savedNotes, setSavedNotes] = useState(initialNotes ?? '')
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMobile = viewMode === 'mobile'

  useEffect(() => {
    setNotes(initialNotes ?? '')
    setSavedNotes(initialNotes ?? '')
  }, [initialNotes, meetingId])

  const dirty = notes !== savedNotes

  async function persist(next: string) {
    setSaving(true)
    try {
      await updateMeeting(meetingId, { notes: next.trim() ? next : null })
      setSavedNotes(next)
      onSaved?.(next)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save notes')
    } finally {
      setSaving(false)
    }
  }

  function onChange(v: string) {
    setNotes(v)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      if (v !== savedNotes) void persist(v)
    }, 1200)
  }

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  async function closeEditor() {
    if (timer.current) clearTimeout(timer.current)
    if (notes !== savedNotes) await persist(notes)
    setEditing(false)
  }

  const statusText = saving ? 'Saving…' : dirty ? 'Unsaved' : savedNotes ? 'Saved' : ''
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
      {savedNotes.trim() ? (
        <p className="line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {savedNotes}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">Add notes…</p>
      )}
    </button>
  )

  const textarea = (
    <textarea
      autoFocus
      className="w-full flex-1 resize-none border-0 bg-transparent p-4 text-[15px] leading-relaxed text-foreground outline-none"
      placeholder="Type discussion notes…"
      value={notes}
      onChange={(e) => onChange(e.target.value)}
    />
  )

  return (
    <>
      {preview}

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
          {textarea}
        </div>
      )}

      {editing && !isMobile && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          onClick={() => void closeEditor()}
        >
          <div
            className="flex h-[70vh] w-[70vw] max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xl"
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
            {textarea}
          </div>
        </div>
      )}
    </>
  )
}
