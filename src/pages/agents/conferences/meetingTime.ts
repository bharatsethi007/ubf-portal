import type { ConferenceMeeting } from './meetingsApi'

export function hhmm(t: string): string {
  return t.slice(0, 5)
}

export function addMinutesToTime(start: string, mins: number): string {
  const [h, m] = hhmm(start).split(':').map(Number)
  let total = h * 60 + m + mins
  if (total > 23 * 60 + 59) total = 23 * 60 + 59
  const nh = Math.floor(total / 60)
  const nm = total % 60
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`
}

export type LiveState = 'live' | 'completed' | 'upcoming'

export function meetingLiveState(
  day: string,
  start: string,
  end: string,
  now = new Date(),
): LiveState {
  const startDate = new Date(`${day}T${hhmm(start)}:00`)
  const endDate = new Date(`${day}T${hhmm(end)}:00`)
  if (now >= startDate && now <= endDate) return 'live'
  if (now > endDate) return 'completed'
  return 'upcoming'
}

export function nextSlotStart(
  existing: { start_time: string; end_time: string }[],
  dayDefaultStart = '09:00',
  _defaultMinutes?: number,
): string {
  if (!existing.length) return dayDefaultStart
  let maxEnd = dayDefaultStart
  for (const m of existing) {
    const end = hhmm(m.end_time)
    if (end > maxEnd) maxEnd = end
  }
  return maxEnd
}

export type MeetingBadge = {
  label: string
  variant: '--live' | '--upcoming' | '--done' | '--cancel' | '--noshow'
}

export function meetingBadge(meeting: ConferenceMeeting, now: Date): MeetingBadge {
  if (meeting.status === 'cancelled') return { label: 'Cancelled', variant: '--cancel' }
  if (meeting.status === 'no_show') return { label: 'No show', variant: '--noshow' }
  if (meeting.status === 'completed') return { label: 'Completed', variant: '--done' }
  const live = meetingLiveState(meeting.meeting_date, meeting.start_time, meeting.end_time, now)
  if (live === 'live') return { label: '● Live now', variant: '--live' }
  if (live === 'upcoming') return { label: 'Upcoming', variant: '--upcoming' }
  return { label: 'Completed', variant: '--done' }
}

export function meetingSortPriority(meeting: ConferenceMeeting, now: Date): number {
  if (meeting.status === 'cancelled' || meeting.status === 'no_show' || meeting.status === 'completed') {
    return 3
  }
  const live = meetingLiveState(meeting.meeting_date, meeting.start_time, meeting.end_time, now)
  if (live === 'live') return 0
  if (live === 'upcoming') return 1
  return 2
}

export function sortMeetings(meetings: ConferenceMeeting[], now: Date): ConferenceMeeting[] {
  return [...meetings].sort((a, b) => {
    const pa = meetingSortPriority(a, now)
    const pb = meetingSortPriority(b, now)
    if (pa !== pb) return pa - pb
    return a.start_time.localeCompare(b.start_time)
  })
}

export function isMeetingDone(meeting: ConferenceMeeting): boolean {
  return (
    meeting.status === 'completed' ||
    meeting.status === 'cancelled' ||
    meeting.status === 'no_show'
  )
}
