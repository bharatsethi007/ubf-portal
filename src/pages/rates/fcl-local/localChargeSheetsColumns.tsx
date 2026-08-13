import type { ColumnDef } from '@tanstack/react-table'
import type { LocalChargeSheetRow } from './localChargesApi'

export const LOCAL_STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'validated', label: 'Validated' },
  { key: 'active', label: 'Active' },
  { key: 'expired', label: 'Expired' },
] as const

export const LOCAL_DIRECTION_TABS = [
  { key: 'all', label: 'All' },
  { key: 'origin', label: 'Origin' },
  { key: 'dest', label: 'Destination' },
] as const

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  draft: { bg: '#EEF1F5', fg: '#5B6472' },
  validated: { bg: '#E7EEFF', fg: '#2447C0' },
  active: { bg: '#E4F6EC', fg: '#1B7F4B' },
  expired: { bg: '#FBE9E9', fg: '#B23B3B' },
}

export function localStatusPill(status: string) {
  const key = status.toLowerCase()
  const c = STATUS_COLORS[key] ?? STATUS_COLORS.draft
  const label = key.charAt(0).toUpperCase() + key.slice(1)
  return (
    <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: c.bg, color: c.fg }}>
      {label}
    </span>
  )
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' })
}

function chips(codes: string[]): string {
  if (!codes.length) return '—'
  if (codes.length <= 3) return codes.join(', ')
  return `${codes.slice(0, 3).join(', ')} +${codes.length - 3}`
}

function titleCase(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

export function localChargeSheetsColumns(): ColumnDef<LocalChargeSheetRow>[] {
  return [
    { header: 'Title', accessorKey: 'title', cell: ({ row }) => row.original.title ?? <span className="muted">—</span> },
    { header: 'Direction', accessorKey: 'direction', cell: ({ row }) => (row.original.direction === 'dest' ? 'Destination' : 'Origin') },
    { header: 'Movement', accessorKey: 'movement', cell: ({ row }) => titleCase(row.original.movement) },
    { header: 'Ports', cell: ({ row }) => chips(row.original.port_codes) },
    { header: 'Lines', accessorKey: 'line_count', cell: ({ row }) => row.original.line_count },
    { header: 'Validity', cell: ({ row }) => `${fmtDate(row.original.valid_from)} – ${fmtDate(row.original.valid_to)}` },
    { header: 'Status', accessorKey: 'status', cell: ({ row }) => localStatusPill(row.original.status) },
    { header: 'Created', accessorKey: 'created_at', cell: ({ row }) => fmtDate(row.original.created_at) },
  ]
}
