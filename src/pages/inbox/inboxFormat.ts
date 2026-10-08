import type { Channel, InboxRow } from './inboxApi'

export const CHANNEL_META: Record<Channel, { label: string; color: string }> = {
  whatsapp: { label: 'WhatsApp', color: '#1FAF5A' },
  wechat: { label: 'WeChat', color: '#0E7A3E' },
  portal: { label: 'Portal', color: '#7C95C8' },
  email: { label: 'Email', color: '#64748B' },
  internal: { label: 'Internal', color: '#94A3B8' },
}

export const TEAM_LABEL: Record<string, string> = {
  IS: 'Import Sea', IA: 'Import Air', ES: 'Export Sea', EA: 'Export Air', ACC: 'Accounts',
}

const AV_COLORS: [string, string][] = [
  ['#E6ECF8', '#3D5A8C'], ['#DCFCE7', '#0E7A3E'], ['#FEF3C7', '#7A4A00'], ['#EDE9FE', '#5B21B6'],
  ['#E0F2FE', '#075985'], ['#FCE7F3', '#9D174D'], ['#F1F5F9', '#334155'],
]

export function initials(name: string | null | undefined): string {
  const clean = (name ?? '').replace(/[^A-Za-z0-9 ]/g, ' ').trim()
  if (!clean) return '?'
  const parts = clean.split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : parts[0]?.[1] ?? '')).toUpperCase()
}

export function avatarColors(seed: string, unknown = false): { background: string; color: string } {
  if (unknown) return { background: '#FEE4E2', color: '#B42318' }
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  const [background, color] = AV_COLORS[h % AV_COLORS.length]
  return { background, color }
}

export function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000)
  if (s < 60) return 'now'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  if (s < 172800) return 'Yesterday'
  return new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })
}

export function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-NZ', { hour: 'numeric', minute: '2-digit' })
}

export function dayLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const y = new Date(); y.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === y.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' })
}

function dur(ms: number): string {
  const m = Math.round(Math.abs(ms) / 60000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h}h ${m % 60}m` : `${Math.floor(h / 24)}d`
}

export type Sla = { label: string; tone: 'late' | 'due' | 'ok' | 'done' }

export function slaFor(row: Pick<InboxRow, 'reply_due_at' | 'last_sender'>): Sla {
  if (row.reply_due_at) {
    const left = Date.parse(row.reply_due_at) - Date.now()
    return left < 0 ? { label: `Overdue ${dur(left)}`, tone: 'late' } : { label: `Reply in ${dur(left)}`, tone: 'due' }
  }
  if (row.last_sender === 'staff') return { label: 'Waiting on customer', tone: 'ok' }
  return { label: 'No reply needed', tone: 'done' }
}

export function windowLeft(endsAt: string | null): string | null {
  if (!endsAt) return null
  const left = Date.parse(endsAt) - Date.now()
  return left > 0 ? dur(left) : null
}
