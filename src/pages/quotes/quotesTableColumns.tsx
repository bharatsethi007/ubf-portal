import type { ColumnDef } from '@tanstack/react-table'
import {
  Files, FolderOpen, Send, Share2, Trophy, XCircle, Repeat2,
  Plane, Boxes, Container, Ship, type LucideIcon,
} from 'lucide-react'

export type QuoteRow = {
  id: string
  quote_no: string | null
  status: string
  customer_name: string | null
  shipment_mode: string | null
  shipment_type: string | null
  from_port_code: string | null
  to_port_code: string | null
  created_by: string | null
  created_at: string
}

export const STATUS_TABS: { key: string; label: string; Icon: LucideIcon }[] = [
  { key: 'all', label: 'All Quotes', Icon: Files },
  { key: 'open', label: 'Open', Icon: FolderOpen },
  { key: 'published', label: 'Published', Icon: Share2 },
  { key: 'sent', label: 'Sent', Icon: Send },
  { key: 'won', label: 'Won', Icon: Trophy },
  { key: 'lost', label: 'Lost', Icon: XCircle },
  { key: 'crosswin', label: 'Cross win', Icon: Repeat2 },
]

// Selectable target statuses for the bulk change-status modal.
export const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'published', label: 'Published' },
  { value: 'sent', label: 'Sent' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
  { value: 'crosswin', label: 'Cross win' },
]

function fmtCreated(iso: string): string {
  const d = new Date(iso)
  return isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function quoteStatusPill(status: string) {
  const key = status.toLowerCase()
  const label = key === 'crosswin' ? 'Cross win' : status.charAt(0).toUpperCase() + status.slice(1)
  return <span className={`quote-pill quote-pill--${key}`}>{label}</span>
}

function modeInfo(mode: string | null, type: string | null): { label: string; Icon: LucideIcon } {
  const m = (mode ?? '').toLowerCase()
  const t = (type ?? '').toUpperCase()
  if (m.includes('air') || t === 'AIR') return { label: 'Air', Icon: Plane }
  if (t === 'LCL') return { label: 'LCL', Icon: Boxes }
  if (t === 'FCL') return { label: 'FCL', Icon: Container }
  return { label: mode ?? '—', Icon: Ship }
}

export function quotesTableColumns(
  portMap: Map<string, string>,
  staffMap: Map<string, string>,
): ColumnDef<QuoteRow>[] {
  const port = (code: string | null) => (code ? portMap.get(code) ?? code : '—')
  return [
    {
      accessorKey: 'quote_no',
      header: 'Quote #',
      cell: ({ getValue }) => getValue<string | null>() ?? '—',
    },
    {
      accessorKey: 'customer_name',
      header: 'Customer',
      cell: ({ getValue }) => getValue<string | null>() ?? '—',
    },
    {
      id: 'mode',
      header: 'Mode',
      cell: ({ row }) => {
        const { label, Icon } = modeInfo(row.original.shipment_mode, row.original.shipment_type)
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon size={14} /> {label}
          </span>
        )
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => quoteStatusPill(getValue<string>()),
    },
    {
      id: 'origin',
      header: 'Origin',
      cell: ({ row }) => port(row.original.from_port_code),
    },
    {
      id: 'destination',
      header: 'Destination',
      cell: ({ row }) => port(row.original.to_port_code),
    },
    {
      id: 'created_by',
      header: 'Created by',
      cell: ({ row }) =>
        row.original.created_by ? staffMap.get(row.original.created_by) ?? '—' : '—',
    },
    {
      accessorKey: 'created_at',
      header: 'Created',
      cell: ({ getValue }) => fmtCreated(getValue<string>()),
    },
  ]
}
