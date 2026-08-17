import type { StaffUser } from '../bookingRecordTypes'

export type MentionStaff = { user_id: string; handle: string; name: string; initials: string | null }

export function toMentionStaff(rows: StaffUser[]): MentionStaff[] {
  return rows
    .map((r) => {
      const local = (r.email ?? '').split('@')[0] ?? ''
      const handle = local.toLowerCase()
      const name = local || r.initials || 'Staff'
      return { user_id: r.user_id, handle, name, initials: r.initials ?? null }
    })
    .filter((s) => s.handle)
}

const MENTION_RE = /@([a-zA-Z0-9._-]+)/g

export function parseMentionedUserIds(body: string, staff: MentionStaff[]): string[] {
  const found = new Set<string>()
  const byHandle = new Map(staff.map((s) => [s.handle, s.user_id]))
  let m: RegExpExecArray | null
  while ((m = MENTION_RE.exec(body)) !== null) {
    const uid = byHandle.get(m[1].toLowerCase())
    if (uid) found.add(uid)
  }
  return [...found]
}
