import { useState } from 'react'
import { Ban, Check, Pencil, Trash2, UserX, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ViewMode } from './conferencesApi'
import { hhmm, meetingBadge } from './meetingTime'
import type { ConferenceMeeting } from './meetingsApi'

type Props = {
  meeting: ConferenceMeeting
  viewMode: ViewMode
  now: Date
  onClose: () => void
  onEdit: () => void
  onComplete: () => void
  onCancel: (reason: string | null) => void
  onNoShow: (reason: string | null) => void
  onDelete: () => void
}

export default function MeetingDetail({
  meeting,
  viewMode,
  now,
  onClose,
  onEdit,
  onComplete,
  onCancel,
  onNoShow,
  onDelete,
}: Props) {
  const [reasonMode, setReasonMode] = useState<'cancel' | 'no_show' | null>(null)
  const [reasonText, setReasonText] = useState('')
  const isMobile = viewMode === 'mobile'
  const badge = meetingBadge(meeting, now)
  const agentLabel = meeting.agent_name ?? meeting.manual_agent_name ?? '—'
  const isBreak = meeting.is_break

  function submitReason() {
    const r = reasonText.trim() || null
    if (reasonMode === 'cancel') onCancel(r)
    else if (reasonMode === 'no_show') onNoShow(r)
  }

  const body = (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-medium text-foreground">{agentLabel}</h3>
          <div className="mt-0.5 text-sm text-muted-foreground">
            {hhmm(meeting.start_time)}–{hhmm(meeting.end_time)}
          </div>
        </div>
        {!isBreak && (
          <span className={`conf-meeting__badge conf-meeting__badge${badge.variant}`}>{badge.label}</span>
        )}
      </div>

      {meeting.contact_name && (
        <div className="text-sm text-muted-foreground">
          Contact: <span className="text-foreground">{meeting.contact_name}</span>
        </div>
      )}

      {isBreak ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onEdit}>
            <Pencil className="size-4" />
            Edit
          </Button>
          <Button type="button" size="sm" variant="destructive" onClick={onDelete}>
            <Trash2 className="size-4" />
            Delete
          </Button>
        </div>
      ) : reasonMode ? (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-foreground">
            {reasonMode === 'cancel' ? 'Cancellation reason' : 'No-show reason'}{' '}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <input
            className="input"
            autoFocus
            value={reasonText}
            placeholder="Add a note…"
            onChange={(e) => setReasonText(e.target.value)}
          />
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={submitReason}>
              Confirm
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setReasonMode(null)
                setReasonText('')
              }}
            >
              Back
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={onComplete}>
              <Check className="size-4" />
              Mark completed
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setReasonMode('cancel')
                setReasonText('')
              }}
            >
              <Ban className="size-4" />
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setReasonMode('no_show')
                setReasonText('')
              }}
            >
              <UserX className="size-4" />
              No-show
            </Button>
          </div>
          <div className="h-px bg-border" />
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={onEdit}>
              <Pencil className="size-4" />
              Edit
            </Button>
            <Button type="button" size="sm" variant="destructive" onClick={onDelete}>
              <Trash2 className="size-4" />
              Delete
            </Button>
          </div>
        </div>
      )}
    </div>
  )

  if (isMobile) {
    return (
      <div className="conf-sheet" style={{ zIndex: 50 }}>
        <div className="conf-sheet__head" style={{ display: 'flex', alignItems: 'center' }}>
          <h3>Meeting details</h3>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-4">{body}</div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-background p-5 shadow-xl"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Meeting details
          </span>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>
        {body}
      </div>
    </div>
  )
}
