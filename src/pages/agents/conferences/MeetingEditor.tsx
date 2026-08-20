import { useRef, useState } from 'react'
import { toast } from 'sonner'
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

  function onStartChange(v: string) {
    setStartTime(v)
    if (isNew && !endTouched.current) setEndTime(addMinutesToTime(v, defaultMinutes))
  }

  async function save() {
    if (!agentId && !manualName?.trim()) {
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
        agent_id: agentId,
        manual_agent_name: manualName?.trim() || null,
        contact_name: contactName.trim() || null,
        contact_email: contactEmail.trim() || null,
        contact_phone: contactPhone.trim() || null,
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

  const body = (
    <>
      <MeetingAgentPicker
        value={{ agentId, manualName }}
        displayLabel={meeting?.agent_name ?? meeting?.manual_agent_name ?? undefined}
        onChange={({ agentId: nextId, manualName: nextManual }) => {
          setAgentId(nextId)
          setManualName(nextManual)
        }}
      />
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
      <div className="agent-modal__actions">
        <button type="button" className="btn btn--inline" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="button" className="btn quotes-page__new-btn" onClick={() => void save()} disabled={saving}>
          {saving ? 'Saving…' : isNew ? 'Add meeting' : 'Save changes'}
        </button>
      </div>
    </>
  )

  if (viewMode === 'mobile') {
    return (
      <div className="conf-sheet">
        <div className="conf-sheet__head">
          <h3>{isNew ? 'Add meeting' : 'Edit meeting'}</h3>
        </div>
        {body}
      </div>
    )
  }

  return (
    <div className="cp-card conf-editor">
      <div className="cp-card-head">
        <h3 className="cp-card-title">{isNew ? 'Add meeting' : 'Edit meeting'}</h3>
      </div>
      <div className="conf-editor__body">{body}</div>
    </div>
  )
}
