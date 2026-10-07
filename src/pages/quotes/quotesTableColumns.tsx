import type { ColumnDef } from '@tanstack/react-table'
import CopyQuoteButton from './CopyQuoteButton'
import { AUTO_EXPIRED } from './quoteLostReasons'
import {
  Files, FolderOpen, Trophy, XCircle, Repeat2,
  Plane, Boxes, Container, Ship, Mail, Globe, PenLine, ArrowDownToLine, ArrowUpFromLine, type LucideIcon,
} from 'lucide-react'

export type QuoteRow = {
  id: string
  quote_no: string | null
  status: string
  customer_name: string | null
  shipment_mode: string | null
  shipment_type: string | null
  movement_type: string | null
  from_port_code: string | null
  to_port_code: string | null
  source: string | null
  created_by: string | null
  created_at: string
  lost_reason?: string | null
  lost_note?: string | null
  expires_at?: string | null
}

export const STATUS_TABS: { key: string; label: string; Icon: LucideIcon }[] = [
  { key: 'all', label: 'All Quotes', Icon: Files },
  { key: 'open', label: 'Open', Icon: FolderOpen },
  { key: 'won', label: 'Won', Icon: Trophy },
  { key: 'lost', label: 'Lost', Icon: XCircle },
  { key: 'crosswin', label: 'Cross win', Icon: Repeat2 },
]

// Selectable target statuses for the bulk change-status modal.
export const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
  { value: 'crosswin', label: 'Cross win' },
]

function expiryCell(iso: string | null | undefined) {
  if (!iso) return <span style={{ color: '#94a3b8' }}>Not priced</span>
  const ms = new Date(iso).getTime() - Date.now()
  const days = ms / 86400000
  const color = days < 0 ? '#B91C1C' : days < 2 ? '#B45309' : '#475569'
  const label = days < 0 ? 'Expired' : days < 1 ? `${Math.max(1, Math.round(ms / 3600000))}h left` : `${Math.floor(days)}d left`
  return <span style={{ color, whiteSpace: 'nowrap' }} title={fmtCreated(iso)}>{label}</span>
}

function lostReasonCell(reason: string | null | undefined, note: string | null | undefined) {
  if (!reason) return <span style={{ color: '#94a3b8' }}>No reason</span>
  const auto = reason === AUTO_EXPIRED
  return (
    <span
      title={note ?? undefined}
      style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 999, padding: '2px 9px', fontSize: 11, fontWeight: 500, lineHeight: 1.4, whiteSpace: 'nowrap', background: auto ? '#F2F4F7' : '#FEF2F2', color: auto ? '#667085' : '#B91C1C' }}
    >
      {reason}
    </span>
  )
}

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

type SourceInfo = { label: string; Icon: LucideIcon; bg: string; fg: string }

function sourceInfo(raw: string | null): SourceInfo {
  const s = (raw ?? 'manual').toLowerCase()
  if (s.includes('email')) return { label: 'Email', Icon: Mail, bg: '#EEF2FF', fg: '#4338CA' }
  if (s.includes('portal')) return { label: 'Portal', Icon: Globe, bg: '#ECFDF3', fg: '#067647' }
  if (s === 'manual' || s === '') return { label: 'Manual', Icon: PenLine, bg: '#F2F4F7', fg: '#667085' }
  return { label: raw!.charAt(0).toUpperCase() + raw!.slice(1), Icon: PenLine, bg: '#F2F4F7', fg: '#667085' }
}

export function quoteSourceCell(source: string | null) {
  const { label, Icon, bg, fg } = sourceInfo(source)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: bg, color: fg, borderRadius: 999, padding: '2px 9px', fontSize: 11, fontWeight: 500, lineHeight: 1.4 }}>
      <Icon size={12} strokeWidth={2} /> {label}
    </span>
  )
}

export function quoteTypeCell(movement: string | null) {
  const m = (movement ?? '').toLowerCase()
  const base = { display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 999, padding: '2px 9px', fontSize: 11, fontWeight: 500, lineHeight: 1.4 } as const
  if (m === 'import') return <span style={{ ...base, background: '#ECFDFF', color: '#0E7090' }}><ArrowDownToLine size={12} strokeWidth={2} /> Import</span>
  if (m === 'export') return <span style={{ ...base, background: '#FFF6ED', color: '#C4620E' }}><ArrowUpFromLine size={12} strokeWidth={2} /> Export</span>
  return <>—</>
}

export function quotesTableColumns(
  portMap: Map<string, string>,
  staffMap: Map<string, string>,
  statusTab = 'all',
): ColumnDef<QuoteRow>[] {
  const port = (code: string | null) => (code ? portMap.get(code) ?? code : '—')
  const extra: ColumnDef<QuoteRow>[] = []
  if (statusTab === 'open' || statusTab === 'all') {
    extra.push({ id: 'expires', header: 'Expires', cell: ({ row }) => row.original.status === 'open' ? expiryCell(row.original.expires_at) : '—' })
  }
  if (statusTab === 'lost' || statusTab === 'all') {
    extra.push({ id: 'lost_reason', header: 'Lost reason', cell: ({ row }) => row.original.status === 'lost' ? lostReasonCell(row.original.lost_reason, row.original.lost_note) : '—' })
  }
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
      id: 'type',
      header: 'Type',
      cell: ({ row }) => quoteTypeCell(row.original.movement_type),
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
      id: 'source',
      header: 'Source',
      cell: ({ row }) => quoteSourceCell(row.original.source),
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
    ...extra,
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => <CopyQuoteButton quoteId={row.original.id} quoteNo={row.original.quote_no} size={14} />,
    },
  ]
}
