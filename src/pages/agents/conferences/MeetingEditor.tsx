import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ViewMode } from './conferencesApi'
import MeetingAgentPicker from './MeetingAgentPicker'
import MeetingContactField from './MeetingContactField'
import { addMinutesToTime, hhmm, nextSlotStart } from './meetingTime'
import {
  createMeeting,
  updateMeeting,
  type ConferenceMeeting,
} from './meetingsApi'

type Props = {
  conferenceId: string
  day: string
  defaultMinutes: number
  meeting?: ConferenceMeeting | null
  existingMeetings: ConferenceMeeting[]
  viewMode: ViewMode
  onSaved: () => void
  onCancel: () => void
}

export default function MeetingEditor({
  conferenceId,
  day,
  defaultMinutes,
  meeting,
  existingMeetings,
  viewMode,
  onSaved,
  onCancel,
}: Props) {
  const isNew = !meeting
  const endTouched = useRef(false)
  const defaultStart = isNew
    ? nextSlotStart(existingMeetings, '09:00', defaultMinutes)
    : hhmm(meeting.start_time)

  const [agentId, setAgentId] = useState<string | null>(meeting?.agent_id ?? null)
  const [manualName, setManualName] = useState<string | null>(meeting?.manual_agent_name ?? null)
  const [startTime, setStartTime] = useState(defaultStart)
  const [endTime, setEndTime] = useState(
    isNew ? addMinutesToTime(defaultStart, defaultMinutes) : hhmm(meeting.end_time),
  )
  const [contactName, setContactName] = useState(meeting?.contact_name ?? '')
  const [contactEmail, setContactEmail] = useState(meeting?.contact_email ?? '')
  const [contactPhone, setContactPhone] = useState(meeting?.contact_phone ?? '')
  const [saving, setSaving] = useState(false)
  const [isBreak, setIsBreak] = useState(meeting?.is_break ?? false)
  const breakLabel = manualName ?? ''
  const title = isNew ? (isBreak ? 'Add break' : 'Add meeting') : isBreak ? 'Edit break' : 'Edit meeting'

  function onStartChange(v: string) {
    setStartTime(v)
    if (isNew && !endTouched.current) setEndTime(addMinutesToTime(v, defaultMinutes))
  }

  async function save() {
    if (isBreak) {
      if (!manualName?.trim()) {
        toast.error('Enter a label for the break')
        return
      }
    } else if (!agentId && !manualName?.trim()) {
      toast.error('Link an agent or enter a manual name')
      return
    }
    if (!startTime || !endTime) {
      toast.error('Start and end times are required')
      return
    }
    if (endTime <= startTime) {
      toast.error('End time must be after start time')
      return
    }

    setSaving(true)
    try {
      const payload = {
        start_time: `${startTime}:00`,
        end_time: `${endTime}:00`,
        agent_id: isBreak ? null : agentId,
        manual_agent_name: manualName?.trim() || null,
        contact_name: isBreak ? null : contactName.trim() || null,
        contact_email: isBreak ? null : contactEmail.trim() || null,
        contact_phone: isBreak ? null : contactPhone.trim() || null,
        is_break: isBreak,
      }
      if (isNew) {
        await createMeeting({
          conference_id: conferenceId,
          meeting_date: day,
          ...payload,
        })
        toast.success('Meeting added')
      } else {
        await updateMeeting(meeting.id, payload)
        toast.success('Meeting updated')
      }
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save meeting')
    } finally {
      setSaving(false)
    }
  }

  const segBtn =
    'inline-flex items-center gap-1.5 rounded-md px-3 h-8 text-[13px] font-medium transition-colors'

  const body = (
    <>
      <div className="mb-3 inline-flex items-center gap-0.5 rounded-lg border border-border bg-muted p-0.5">
        <button
          type="button"
          className={cn(
            segBtn,
            !isBreak ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
          onClick={() => setIsBreak(false)}
          aria-pressed={!isBreak}
        >
          Meeting
        </button>
        <button
          type="button"
          className={cn(
            segBtn,
            isBreak ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
          onClick={() => {
            setIsBreak(true)
            setAgentId(null)
          }}
          aria-pressed={isBreak}
        >
          Break
        </button>
      </div>

      {isBreak ? (
        <label className="conf-settings-field">
          <span>Break label</span>
          <input
            className="input"
            placeholder="e.g. Lunch, Coffee break"
            value={breakLabel}
            onChange={(e) => setManualName(e.target.value || null)}
          />
        </label>
      ) : (
        <MeetingAgentPicker
          value={{ agentId, manualName }}
          displayLabel={meeting?.agent_name ?? meeting?.manual_agent_name ?? undefined}
          onChange={({ agentId: nextId, manualName: nextManual }) => {
            setAgentId(nextId)
            setManualName(nextManual)
          }}
        />
      )}
      <div className="conf-editor-fields conf-editor-fields--time">
        <label className="conf-settings-field">
          <span>Start</span>
          <input className="input" type="time" value={startTime} onChange={(e) => onStartChange(e.target.value)} />
        </label>
        <label className="conf-settings-field">
          <span>End</span>
          <input
            className="input"
            type="time"
            value={endTime}
            onChange={(e) => {
              endTouched.current = true
              setEndTime(e.target.value)
            }}
          />
        </label>
      </div>
      {!isBreak && (
        <MeetingContactField
          agentId={agentId}
          contactName={contactName}
          contactEmail={contactEmail}
          contactPhone={contactPhone}
          onChange={({ contactName: n, contactEmail: e, contactPhone: p }) => {
            setContactName(n)
            setContactEmail(e)
            setContactPhone(p)
          }}
        />
      )}
      <div className="agent-modal__actions">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Cancel"
          title="Cancel"
          onClick={onCancel}
          disabled={saving}
        >
          <X className="size-[18px]" />
        </Button>
        <button type="button" className="btn quotes-page__new-btn" onClick={() => void save()} disabled={saving}>
          {saving ? 'Saving…' : isNew ? (isBreak ? 'Add break' : 'Add meeting') : 'Save changes'}
        </button>
      </div>
    </>
  )

  if (viewMode === 'mobile') {
    return (
      <div className="conf-sheet">
        <div className="conf-sheet__head">
          <h3>{title}</h3>
        </div>
        {body}
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-auto rounded-xl border border-border bg-background p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3">
          <h3 className="text-base font-medium text-foreground">{title}</h3>
        </div>
        <div className="conf-editor__body">{body}</div>
      </div>
    </div>
  )
}
