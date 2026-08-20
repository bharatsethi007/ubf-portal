import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { ViewMode } from './conferencesApi'
import { updateMeeting } from './meetingsApi'

type Props = {
  meetingId: string
  initialNotes: string | null
  viewMode: ViewMode
  onSaved?: (notes: string) => void
}

export default function MeetingNotes({ meetingId, initialNotes, viewMode, onSaved }: Props) {
  const [notes, setNotes] = useState(initialNotes ?? '')
  const [savedNotes, setSavedNotes] = useState(initialNotes ?? '')
  const [saving, setSaving] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  return (
    <div className="conf-meeting__notes conf-notes">
      <div className="conf-notes__head">
        <span className="conf-meeting__notes-label">Notes</span>
        <span className="conf-notes__status">
          {saving ? 'Saving…' : dirty ? 'Unsaved' : savedNotes ? 'Saved' : ''}
        </span>
      </div>
      <textarea
        className="input conf-notes__area"
        rows={viewMode === 'mobile' ? 7 : 8}
        placeholder="Type discussion notes… (auto-saves)"
        value={notes}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          if (dirty) void persist(notes)
        }}
      />
    </div>
  )
}
