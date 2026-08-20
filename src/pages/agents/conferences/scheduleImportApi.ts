import { supabase } from '../../../supabase'
import { createMeeting } from './meetingsApi'

export type ParsedMeeting = {
  meeting_date: string
  start_time: string
  end_time: string
  agent_name_raw: string
  matched_agent_id: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  confidence: 'green' | 'amber' | 'red'
}

export type ReviewMeetingRow = ParsedMeeting & {
  key: string
  included: boolean
}

export async function parseScheduleSheet(
  conferenceId: string,
  days: string[],
  defaultMinutes: number,
  sheet: string[][],
): Promise<ParsedMeeting[]> {
  const { data, error } = await supabase.functions.invoke('conference-schedule-parse', {
    body: { conference_id: conferenceId, days, default_minutes: defaultMinutes, sheet },
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return (data?.meetings ?? []) as ParsedMeeting[]
}

export async function parseScheduleImage(
  conferenceId: string,
  days: string[],
  defaultMinutes: number,
  image: { media_type: string; data_base64: string },
): Promise<ParsedMeeting[]> {
  const { data, error } = await supabase.functions.invoke('conference-schedule-parse', {
    body: { conference_id: conferenceId, days, default_minutes: defaultMinutes, image },
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return (data?.meetings ?? []) as ParsedMeeting[]
}

export function toReviewRows(meetings: ParsedMeeting[]): ReviewMeetingRow[] {
  return meetings.map((m, i) => ({
    ...m,
    key: `row-${i}`,
    included: m.confidence !== 'red',
  }))
}

function dbTime(t: string): string {
  return t.length <= 5 ? `${t}:00` : t
}

export async function commitParsedMeetings(
  conferenceId: string,
  rows: ParsedMeeting[],
): Promise<number> {
  let n = 0
  for (const r of rows) {
    await createMeeting({
      conference_id: conferenceId,
      meeting_date: r.meeting_date,
      start_time: dbTime(r.start_time),
      end_time: dbTime(r.end_time),
      agent_id: r.matched_agent_id,
      manual_agent_name: r.matched_agent_id ? null : r.agent_name_raw,
      contact_name: r.contact_name,
      contact_email: r.contact_email,
      contact_phone: r.contact_phone,
    })
    n++
  }
  return n
}
