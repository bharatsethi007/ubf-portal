import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookUser, Coffee, MoreHorizontal, ScanLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ViewMode } from './conferencesApi'
import { hhmm, meetingBadge } from './meetingTime'
import MeetingCards, { type MeetingCardsHandle } from './MeetingCards'
import MeetingNotes from './MeetingNotes'
import type { ConferenceMeeting } from './meetingsApi'
import './meetingCards.css'

type Props = {
  meeting: ConferenceMeeting
  viewMode: ViewMode
  now: Date
  onOpenDetail: () => void
  onOpenBrief?: (agentId: string, agentName: string) => void
}

const DOT: Record<string, string> = {
  '--live': 'bg-emerald-500',
  '--upcoming': 'bg-blue-500',
  '--done': 'bg-slate-400',
  '--cancel': 'bg-red-400',
  '--noshow': 'bg-amber-500',
}

export default function MeetingRow({ meeting, viewMode, now, onOpenDetail, onOpenBrief }: Props) {
  const navigate = useNavigate()
  const cardsRef = useRef<MeetingCardsHandle>(null)
  const [cardCount, setCardCount] = useState(0)
  const badge = meetingBadge(meeting, now)
  const agentLabel = meeting.agent_name ?? meeting.manual_agent_name ?? '—'
  const dotClass = DOT[badge.variant] ?? 'bg-slate-400'
  const dimmed = meeting.status === 'cancelled' || meeting.status === 'no_show'

  if (meeting.is_break) {
    return (
      <div className="flex gap-3">
        <div className="relative flex w-12 shrink-0 flex-col items-center">
          <span className="absolute top-1 bottom-0 w-px bg-border" aria-hidden />
          <span className="relative z-10 mt-1 h-2.5 w-2.5 rounded-full bg-slate-300 ring-4 ring-background" aria-hidden />
          <span className="relative z-10 mt-2 text-[11px] font-medium text-muted-foreground">
            {hhmm(meeting.start_time)}
          </span>
        </div>
        <button
          type="button"
          onClick={onOpenDetail}
          className="mb-3 flex flex-1 items-center justify-between gap-2 rounded-lg border border-dashed border-border bg-muted/40 px-4 py-2.5 text-left transition-colors hover:bg-muted/60"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Coffee className="size-4" />
            {meeting.manual_agent_name || 'Break'}
          </span>
          <span className="text-xs text-muted-foreground">
            {hhmm(meeting.start_time)}–{hhmm(meeting.end_time)}
          </span>
        </button>
      </div>
    )
  }

  return (
    <div className="flex gap-3">
      <div className="relative flex w-12 shrink-0 flex-col items-center">
        <span className="absolute top-1 bottom-0 w-px bg-border" aria-hidden />
        <span
          className={`relative z-10 mt-1 h-2.5 w-2.5 rounded-full ring-4 ring-background ${dotClass}`}
          aria-hidden
        />
        <span className="relative z-10 mt-2 text-[11px] font-medium text-muted-foreground">
          {hhmm(meeting.start_time)}
        </span>
      </div>

      <div
        className={`mb-3 flex-1 rounded-xl border border-border bg-background p-4 shadow-sm ${
          dimmed ? 'opacity-70' : ''
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {meeting.agent_id ? (
              <button
                type="button"
                className="max-w-full truncate text-left text-[15px] font-medium text-foreground hover:text-primary"
                onClick={() => {
                  if (onOpenBrief) onOpenBrief(meeting.agent_id!, agentLabel)
                  else navigate(`/agents/${meeting.agent_id}`)
                }}
              >
                {agentLabel}
              </button>
            ) : (
              <div className="truncate text-[15px] font-medium text-foreground">{agentLabel}</div>
            )}
            <div className="mt-0.5 text-xs text-muted-foreground">
              {hhmm(meeting.start_time)}–{hhmm(meeting.end_time)}
              {meeting.contact_name ? ` · ${meeting.contact_name}` : ''}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className={`conf-meeting__badge conf-meeting__badge${badge.variant}`}>
              {badge.label}
            </span>
            {(cardCount > 0 || !!meeting.agent_id) && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="View contacts"
                title="Contacts"
                className={cardCount > 0 ? 'text-emerald-600 hover:text-emerald-700' : 'text-muted-foreground'}
                onClick={() => cardsRef.current?.openContacts()}
              >
                <BookUser className="size-[18px]" />
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Scan business card"
              title="Scan business card"
              onClick={() => cardsRef.current?.openScanner()}
            >
              <ScanLine className="size-[18px]" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Meeting details"
              title="Meeting details"
              onClick={onOpenDetail}
            >
              <MoreHorizontal className="size-[18px]" />
            </Button>
          </div>
        </div>

        <div className="mt-3">
          <MeetingNotes
            meetingId={meeting.id}
            initialNotes={meeting.notes}
            viewMode={viewMode}
            title={agentLabel}
          />
        </div>

        <div className="mt-3">
          <MeetingCards
            ref={cardsRef}
            meetingId={meeting.id}
            agentId={meeting.agent_id}
            viewMode={viewMode}
            onCountChange={setCardCount}
          />
        </div>
      </div>
    </div>
  )
}
