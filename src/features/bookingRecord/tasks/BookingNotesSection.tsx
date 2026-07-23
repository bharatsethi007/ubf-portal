import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { fmtDate } from '@/utils/format'
import { staffDisplayName, staffInitials } from '../staffDisplayUtils'
import type { BookingNote } from '../notes/bookingNotesApi'

type Props = {
  notes: BookingNote[]
  loading: boolean
  onAdd: (body: string) => Promise<void>
}

function authorLabel(note: BookingNote): string {
  if (note.author_email) return staffDisplayName(note.author_email)
  return 'Staff'
}

export default function BookingNotesSection({ notes, loading, onAdd }: Props) {
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!draft.trim() || saving) return
    setSaving(true)
    try {
      await onAdd(draft)
      setDraft('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="booking-notes">
      <h4 className="booking-panel-subtitle">Notes</h4>
      {loading ? (
        <p className="muted booking-notes__empty">Loading notes…</p>
      ) : notes.length === 0 ? (
        <p className="muted booking-notes__empty">No notes yet.</p>
      ) : (
        <ul className="booking-notes__list">
          {notes.map((note) => (
            <li key={note.id} className="booking-notes__item">
              <p className="booking-notes__body">{note.body}</p>
              <div className="booking-notes__meta">
                <span className="booking-notes__avatar" title={authorLabel(note)}>
                  {note.author_email
                    ? staffInitials(note.author_email, note.author_initials)
                    : '?'}
                </span>
                <span>{authorLabel(note)}</span>
                <span className="booking-notes__dot" aria-hidden>·</span>
                <time dateTime={note.created_at}>{fmtDate(note.created_at, true)}</time>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="booking-notes__add">
        <Textarea
          className="booking-compact-textarea"
          rows={2}
          placeholder="Add a note…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <Button type="button" size="xs" variant="outline" disabled={!draft.trim() || saving} onClick={() => void submit()}>
          Add note
        </Button>
      </div>
    </section>
  )
}
