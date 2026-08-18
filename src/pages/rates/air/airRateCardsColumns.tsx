import type { ColumnDef } from '@tanstack/react-table'
import type { AirRateCardRow } from '../airRatesApi'

export const AIR_STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'validated', label: 'Validated' },
  { key: 'active', label: 'Active' },
  { key: 'expired', label: 'Expired' },
] as const

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  draft: { bg: '#EEF1F5', fg: '#5B6472' },
  validated: { bg: '#E7EEFF', fg: '#2447C0' },
  active: { bg: '#E4F6EC', fg: '#1B7F4B' },
  expired: { bg: '#FBE9E9', fg: '#B23B3B' },
}

export function airStatusPill(status: string) {
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

export function airRateCardsColumns(): ColumnDef<AirRateCardRow>[] {
  return [
    { header: 'Airline', accessorKey: 'vendor_account_id', cell: ({ row }) => row.original.vendor_name ?? row.original.vendor_account_id ?? '—' },
    { header: 'Title', accessorKey: 'title', cell: ({ row }) => row.original.title ?? <span className="muted">—</span> },
    { header: 'Validity', cell: ({ row }) => `${fmtDate(row.original.valid_from)} – ${fmtDate(row.original.valid_to)}` },
    { header: 'Currency', accessorKey: 'currency_code', cell: ({ row }) => row.original.currency_code ?? '—' },
    { header: 'Lines', accessorKey: 'line_count', cell: ({ row }) => row.original.line_count },
    { header: 'Status', accessorKey: 'status', cell: ({ row }) => airStatusPill(row.original.status) },
    { header: 'Created', accessorKey: 'created_at', cell: ({ row }) => fmtDate(row.original.created_at) },
  ]
}
