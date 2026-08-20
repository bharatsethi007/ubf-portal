import { useNavigate } from 'react-router-dom'
import { Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ViewMode } from './conferencesApi'
import { hhmm, isMeetingDone, meetingBadge } from './meetingTime'
import MeetingCards from './MeetingCards'
import MeetingNotes from './MeetingNotes'
import type { ConferenceMeeting } from './meetingsApi'
import './meetingCards.css'

type ReasonAction = { id: string; kind: 'cancel' | 'no_show' }

type Props = {
  meeting: ConferenceMeeting
  viewMode: ViewMode
  now: Date
  expanded: boolean
  reasonAction: ReasonAction | null
  reasonText: string
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
  onComplete: () => void
  onStartReason: (kind: 'cancel' | 'no_show') => void
  onReasonText: (text: string) => void
  onConfirmReason: () => void
  onCancelReason: () => void
  onOpenBrief?: (agentId: string, agentName: string) => void
}

export default function MeetingRow({
  meeting,
  viewMode,
  now,
  expanded,
  reasonAction,
  reasonText,
  onToggle,
  onEdit,
  onDelete,
  onComplete,
  onStartReason,
  onReasonText,
  onConfirmReason,
  onCancelReason,
  onOpenBrief,
}: Props) {
  const navigate = useNavigate()
  const badge = meetingBadge(meeting, now)
  const done = isMeetingDone(meeting)
  const slim = done && !expanded
  const agentLabel =
    meeting.agent_name ??
    meeting.manual_agent_name ??
    '—'
  const iconSize = viewMode === 'mobile' ? 18 : 16

  if (slim) {
    return (
      <button type="button" className="conf-meeting conf-meeting--slim" onClick={onToggle}>
        <span className={`conf-meeting__badge conf-meeting__badge${badge.variant}`}>{badge.label}</span>
        <span className="conf-meeting__time">
          {hhmm(meeting.start_time)}–{hhmm(meeting.end_time)}
        </span>
        <span className="conf-meeting__name">{agentLabel}</span>
      </button>
    )
  }

  return (
    <div className={`conf-meeting${done ? ' conf-meeting--done' : ''}`}>
      <div className="conf-meeting__main">
        <span className={`conf-meeting__badge conf-meeting__badge${badge.variant}`}>{badge.label}</span>
        <div className="conf-meeting__details">
          <div className="conf-meeting__time">
            {hhmm(meeting.start_time)}–{hhmm(meeting.end_time)}
          </div>
          <div className="conf-meeting__name">
            {meeting.agent_id ? (
              <button
                type="button"
                className="text-link"
                onClick={() => {
                  if (onOpenBrief) onOpenBrief(meeting.agent_id!, agentLabel)
                  else navigate(`/agents/${meeting.agent_id}`)
                }}
              >
                {agentLabel}
              </button>
            ) : (
              agentLabel
            )}
          </div>
          {meeting.contact_name && (
            <div className="conf-meeting__contact">{meeting.contact_name}</div>
          )}
        </div>
      </div>

      {reasonAction?.id === meeting.id ? (
        <div className="conf-meeting__reason">
          <input
            className="input input--sm"
            placeholder="Reason (optional)"
            value={reasonText}
            onChange={(e) => onReasonText(e.target.value)}
          />
          <Button type="button" size="sm" onClick={onConfirmReason}>
            Confirm
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onCancelReason}>
            Back
          </Button>
        </div>
      ) : (
        <div className="conf-meeting__actions">
          {meeting.status === 'upcoming' && (
            <>
              <Button type="button" size="sm" onClick={onComplete}>
                Mark completed
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => onStartReason('cancel')}>
                Cancel
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => onStartReason('no_show')}>
                No-show
              </Button>
            </>
          )}
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            aria-label="Edit"
            onClick={onEdit}
          >
            <Pencil size={iconSize} />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            aria-label="Delete"
            className="text-muted-foreground hover:text-destructive hover:border-destructive/40"
            onClick={onDelete}
          >
            <Trash2 size={iconSize} />
          </Button>
        </div>
      )}

      {expanded && (
        <div className="conf-meeting__expanded">
          <MeetingNotes meetingId={meeting.id} initialNotes={meeting.notes} viewMode={viewMode} />
          <div className="conf-meeting__cards">
            <span className="conf-meeting__cards-label">Cards</span>
            <MeetingCards meetingId={meeting.id} agentId={meeting.agent_id} viewMode={viewMode} />
          </div>
        </div>
      )}
    </div>
  )
}
