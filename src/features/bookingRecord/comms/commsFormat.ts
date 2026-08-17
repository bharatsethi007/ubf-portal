import { Phone, Mail, MessageCircle, StickyNote } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { BookingComm, CommActivityType, CommSentiment, ComplaintSeverity } from './commsTypes'

export const ACTIVITY_ICON: Record<CommActivityType, LucideIcon> = {
  phone_call: Phone,
  email: Mail,
  im: MessageCircle,
  note: StickyNote,
}

export function sentimentClass(s: CommSentiment | null): string {
  return s ? `comms-chip comms-chip--${s}` : ''
}
export function severityClass(s: ComplaintSeverity | null): string {
  return s ? `comms-sev comms-sev--${s}` : 'comms-sev'
}

export function authorInitials(comm: Pick<BookingComm, 'author_initials' | 'author_email'>): string {
  const raw = comm.author_initials?.trim()
  if (raw) return raw.toUpperCase().slice(0, 3)
  const email = comm.author_email
  if (email) {
    const local = email.split('@')[0] ?? ''
    const parts = local.split(/[._-]+/).filter(Boolean)
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return local.slice(0, 2).toUpperCase()
  }
  return '—'
}

export function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function dateGroupLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yest = new Date(); yest.setDate(today.getDate() - 1)
  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  if (same(d, today)) return 'Today'
  if (same(d, yest)) return 'Yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
}

export function groupByDate(comms: BookingComm[]): { label: string; items: BookingComm[] }[] {
  const asc = [...comms].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))
  const groups: { label: string; items: BookingComm[] }[] = []
  for (const c of asc) {
    const label = dateGroupLabel(c.occurred_at)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.items.push(c)
    else groups.push({ label, items: [c] })
  }
  return groups
}
