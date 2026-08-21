import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, List, Plus, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ViewMode } from './conferencesApi'
import { dayTabLabel } from './conferenceDays'
import MeetingEditor from './MeetingEditor'
import MeetingRow from './MeetingRow'
import ConferenceCalendar from './ConferenceCalendar'
import MeetingDetail from './MeetingDetail'
import AgentBriefPanel from './AgentBriefPanel'
import ScheduleImportModal from './ScheduleImportModal'
import { sortMeetings } from './meetingTime'
import {
  deleteMeeting,
  listConferenceMeetings,
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
  allDays?: string[]
}

type EditState = ConferenceMeeting | null | 'new'

export default function ConferenceDaySchedule({
  conferenceId,
  day,
  dayIndex,
  viewMode,
  defaultMinutes,
  allDays,
}: Props) {
  const [meetings, setMeetings] = useState<ConferenceMeeting[]>([])
  const [allMeetings, setAllMeetings] = useState<ConferenceMeeting[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<EditState>(null)
  const [now, setNow] = useState(() => new Date())
  const [detail, setDetail] = useState<ConferenceMeeting | null>(null)
  const [brief, setBrief] = useState<{ agentId: string; agentName: string } | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [scheduleView, setScheduleView] = useState<'list' | 'calendar'>('list')

  const conferenceDays = allDays ?? [day]

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [rows, all] = await Promise.all([
        listDayMeetings(conferenceId, day),
        listConferenceMeetings(conferenceId),
      ])
      setMeetings(rows)
      setAllMeetings(all)
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

  async function handleDelete(meeting: ConferenceMeeting) {
    if (!window.confirm('Delete this meeting?')) return
    try {
      await deleteMeeting(meeting.id)
      toast.success('Meeting deleted')
      setDetail(null)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete')
    }
  }

  async function statusChange(
    meeting: ConferenceMeeting,
    status: 'completed' | 'cancelled' | 'no_show',
    reason?: string | null,
  ) {
    try {
      await setMeetingStatus(meeting.id, status, reason ?? null)
      toast.success(
        status === 'completed'
          ? 'Marked completed'
          : status === 'cancelled'
            ? 'Meeting cancelled'
            : 'Marked no-show',
      )
      setDetail(null)
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
    return (
      <>
        {editor}
        {brief && (
          <AgentBriefPanel
            agentId={brief.agentId}
            agentName={brief.agentName}
            viewMode={viewMode}
            onClose={() => setBrief(null)}
          />
        )}
      </>
    )
  }

  const swBtn =
    'inline-flex items-center gap-1.5 rounded-md px-3 h-8 text-[13px] font-medium transition-colors'

  return (
    <>
    <div
      className="mb-3 ml-0.5 inline-flex items-center gap-0.5 rounded-lg border border-border bg-muted p-0.5"
      role="group"
      aria-label="Schedule view"
    >
      <button
        type="button"
        className={cn(
          swBtn,
          scheduleView === 'list'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
        )}
        onClick={() => setScheduleView('list')}
        aria-pressed={scheduleView === 'list'}
      >
        <List size={16} />
        List
      </button>
      <button
        type="button"
        className={cn(
          swBtn,
          scheduleView === 'calendar'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
        )}
        onClick={() => setScheduleView('calendar')}
        aria-pressed={scheduleView === 'calendar'}
      >
        <CalendarDays size={16} />
        Calendar
      </button>
    </div>
    <div className="cp-card conf-schedule">
      <div className="cp-card-head conf-schedule__head">
        <h3 className="cp-card-title">Schedule — {dayTabLabel(day, dayIndex)}</h3>
        <div className="conf-schedule__head-actions">
          {!isMobile && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setShowImport(true)}
              aria-label="AI import schedule"
              title="AI import schedule"
            >
              <Sparkles className="size-[18px]" />
            </Button>
          )}
          <button type="button" className="btn btn--inline quotes-page__new-btn" onClick={() => setEditing('new')}>
            <Plus size={16} />
            Add meeting
          </button>
        </div>
      </div>

      {editing !== null && editor}

      {(!isMobile || editing === null) && scheduleView === 'calendar' && (
        <div className="pad-inline pb-4">
          <ConferenceCalendar
            days={conferenceDays}
            meetings={allMeetings}
            now={now}
            onOpenDetail={(m) => setDetail(m)}
          />
        </div>
      )}

      {(!isMobile || editing === null) && scheduleView === 'list' && (
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
                onOpenDetail={() => setDetail(meeting)}
                onOpenBrief={(agentId, agentName) => setBrief({ agentId, agentName })}
              />
            ))
          )}
        </div>
      )}

    </div>

      {detail && (
        <MeetingDetail
          meeting={detail}
          viewMode={viewMode}
          now={now}
          onClose={() => setDetail(null)}
          onEdit={() => {
            setEditing(detail)
            setDetail(null)
          }}
          onComplete={() => void statusChange(detail, 'completed')}
          onCancel={(reason) => void statusChange(detail, 'cancelled', reason)}
          onNoShow={(reason) => void statusChange(detail, 'no_show', reason)}
          onDelete={() => void handleDelete(detail)}
        />
      )}

      {brief && (
        <AgentBriefPanel
          agentId={brief.agentId}
          agentName={brief.agentName}
          viewMode={viewMode}
          onClose={() => setBrief(null)}
        />
      )}

      {showImport && (
        <ScheduleImportModal
          conferenceId={conferenceId}
          days={conferenceDays}
          defaultMinutes={defaultMinutes}
          onClose={() => setShowImport(false)}
          onImported={() => {
            setShowImport(false)
            void load()
          }}
        />
      )}
    </>
  )
}
