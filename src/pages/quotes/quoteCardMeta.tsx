import { Plane, Boxes, Container, Ship, type LucideIcon } from 'lucide-react'

// Kanban column order + labels. Keys match the `quotes.status` values.
export const BOARD_COLUMNS: { key: string; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'published', label: 'Published' },
  { key: 'sent', label: 'Quotation Sent' },
  { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Lost' },
  { key: 'crosswin', label: 'Cross Win' },
]

// Left-border accent per column head (uses the same hues as the status pills).
export const STATUS_ACCENT: Record<string, string> = {
  open: '#64748B',
  published: '#1D4ED8',
  sent: '#4338CA',
  won: '#047857',
  lost: '#B91C1C',
  crosswin: '#0F766E',
}

// Status <select> options for a card's inline status change.
export const CARD_STATUS_OPTIONS = BOARD_COLUMNS.map((c) => ({ value: c.key, label: c.label }))

export function modeTag(
  mode: string | null,
  type: string | null,
): { label: string; Icon: LucideIcon } {
  const m = (mode ?? '').toLowerCase()
  const t = (type ?? '').toUpperCase()
  if (m.includes('air') || t === 'AIR') return { label: 'Air', Icon: Plane }
  if (t === 'LCL') return { label: 'LCL', Icon: Boxes }
  if (t === 'FCL') return { label: 'FCL', Icon: Container }
  return { label: mode ?? '—', Icon: Ship }
}
