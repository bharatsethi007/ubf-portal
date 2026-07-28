import type { ColumnDef } from '@tanstack/react-table'

export type QuoteRow = {
  id: string
  quote_no: string | null
  status: string
  customer_name: string | null
  shipment_mode: string | null
  pickup_location: string | null
  drop_location: string | null
  created_by_name: string | null
  created_at: string
}

export const STATUS_TABS = [
  { key: 'all', label: 'All Quotes' },
  { key: 'open', label: 'Open' },
  { key: 'published', label: 'Published' },
  { key: 'sent', label: 'Sent' },
  { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Lost' },
] as const

function fmtCreated(iso: string): string {
  const d = new Date(iso)
  return isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function quoteStatusPill(status: string) {
  const key = status.toLowerCase()
  const label = status.charAt(0).toUpperCase() + status.slice(1)
  return <span className={`quote-pill quote-pill--${key}`}>{label}</span>
}

export function quotesTableColumns(): ColumnDef<QuoteRow>[] {
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
      accessorKey: 'shipment_mode',
      header: 'Mode',
      cell: ({ getValue }) => getValue<string | null>() ?? '—',
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => quoteStatusPill(getValue<string>()),
    },
    {
      accessorKey: 'pickup_location',
      header: 'Origin',
      cell: ({ getValue }) => getValue<string | null>() ?? '—',
    },
    {
      accessorKey: 'drop_location',
      header: 'Destination',
      cell: ({ getValue }) => getValue<string | null>() ?? '—',
    },
    {
      accessorKey: 'created_at',
      header: 'Created',
      cell: ({ getValue }) => fmtCreated(getValue<string>()),
    },
  ]
}
