import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import type { ViewMode } from './conferencesApi'
import { dayTabLabel } from './conferenceDays'
import MeetingEditor from './MeetingEditor'
import MeetingRow from './MeetingRow'
import { isMeetingDone, sortMeetings } from './meetingTime'
import {
  deleteMeeting,
  listDayMeetings,
  setMeetingStatus,
  type ConferenceMeeting,
} from './meetingsApi'
import './conferenceMeetings.css'

type Props = {
  conferenceId: string
  day: string
  dayIndex: number
  viewMode: ViewMode
  defaultMinutes: number
}

type EditState = ConferenceMeeting | null | 'new'

export default function ConferenceDaySchedule({
  conferenceId,
  day,
  dayIndex,
  viewMode,
  defaultMinutes,
}: Props) {
  const [meetings, setMeetings] = useState<ConferenceMeeting[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<EditState>(null)
  const [now, setNow] = useState(() => new Date())
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [reasonAction, setReasonAction] = useState<{ id: string; kind: 'cancel' | 'no_show' } | null>(null)
  const [reasonText, setReasonText] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await listDayMeetings(conferenceId, day)
      setMeetings(rows)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load meetings')
      setMeetings([])
    } finally {
      setLoading(false)
    }
  }, [conferenceId, day])

  useEffect(() => {
    void load()
    setEditing(null)
  }, [load])

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  const sorted = useMemo(() => sortMeetings(meetings, now), [meetings, now])
  const isMobile = viewMode === 'mobile'

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleDelete(meeting: ConferenceMeeting) {
    if (!window.confirm('Delete this meeting?')) return
    try {
      await deleteMeeting(meeting.id)
      toast.success('Meeting deleted')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete')
    }
  }

  async function handleComplete(meeting: ConferenceMeeting) {
    try {
      await setMeetingStatus(meeting.id, 'completed')
      toast.success('Marked completed')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update status')
    }
  }

  async function confirmReason() {
    if (!reasonAction) return
    try {
      await setMeetingStatus(
        reasonAction.id,
        reasonAction.kind === 'cancel' ? 'cancelled' : 'no_show',
        reasonText.trim() || null,
      )
      toast.success(reasonAction.kind === 'cancel' ? 'Meeting cancelled' : 'Marked no-show')
      setReasonAction(null)
      setReasonText('')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update status')
    }
  }

  const editor = editing !== null && (
    <MeetingEditor
      conferenceId={conferenceId}
      day={day}
      defaultMinutes={defaultMinutes}
      meeting={editing === 'new' ? null : editing}
      existingMeetings={meetings}
      viewMode={viewMode}
      onSaved={() => {
        setEditing(null)
        void load()
      }}
      onCancel={() => setEditing(null)}
    />
  )

  if (isMobile && editing !== null) {
    return editor
  }

  return (
    <div className="cp-card conf-schedule">
      <div className="cp-card-head conf-schedule__head">
        <h3 className="cp-card-title">Schedule — {dayTabLabel(day, dayIndex)}</h3>
        <div className="conf-schedule__head-actions">
          {!isMobile && (
            <button
              type="button"
              className="btn btn--inline conf-schedule__ai-btn"
              onClick={() => toast.info('AI schedule import — Step 6')}
            >
              <Sparkles size={14} />
              AI import
            </button>
          )}
          <button type="button" className="btn btn--inline quotes-page__new-btn" onClick={() => setEditing('new')}>
            <Plus size={16} />
            Add meeting
          </button>
        </div>
      </div>

      {editing !== null && editor}

      {(!isMobile || editing === null) && (
        <div className="conf-meeting-list pad-inline">
          {loading ? (
            <p className="text-muted-foreground">Loading meetings…</p>
          ) : sorted.length === 0 ? (
            <p className="text-muted-foreground">No meetings scheduled for this day.</p>
          ) : (
            sorted.map((meeting) => (
              <MeetingRow
                key={meeting.id}
                meeting={meeting}
                viewMode={viewMode}
                now={now}
                expanded={!isMeetingDone(meeting) || expanded.has(meeting.id)}
                reasonAction={reasonAction}
                reasonText={reasonText}
                onToggle={() => toggleExpanded(meeting.id)}
                onEdit={() => setEditing(meeting)}
                onDelete={() => void handleDelete(meeting)}
                onComplete={() => void handleComplete(meeting)}
                onStartReason={(kind) => {
                  setReasonAction({ id: meeting.id, kind })
                  setReasonText('')
                }}
                onReasonText={setReasonText}
                onConfirmReason={() => void confirmReason()}
                onCancelReason={() => {
                  setReasonAction(null)
                  setReasonText('')
                }}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
