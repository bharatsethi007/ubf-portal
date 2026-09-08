import type { ColumnDef } from '@tanstack/react-table'
import { fclStatusPill } from '../fcl/fclRateCardsColumns'
import type { CartageRateCardRow } from './cartageRatesApi'

export const CARTAGE_STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'validated', label: 'Validated' },
  { key: 'active', label: 'Active' },
  { key: 'expired', label: 'Expired' },
] as const

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function cartageRateCardsColumns(): ColumnDef<CartageRateCardRow>[] {
  return [
    { header: 'Vendor', accessorKey: 'vendor_name', cell: ({ row }) => row.original.vendor_name ?? <span className="muted">—</span> },
    { header: 'Title', accessorKey: 'title', cell: ({ row }) => row.original.title ?? <span className="muted">—</span> },
    { header: 'Validity', cell: ({ row }) => `${fmtDate(row.original.valid_from)} – ${fmtDate(row.original.valid_to)}` },
    { header: 'Currency', accessorKey: 'currency_code', cell: ({ row }) => row.original.currency_code ?? '—' },
    { header: 'Lines', accessorKey: 'line_count', cell: ({ row }) => row.original.line_count },
    { header: 'Status', accessorKey: 'status', cell: ({ row }) => fclStatusPill(row.original.status) },
    { header: 'Created', accessorKey: 'created_at', cell: ({ row }) => fmtDate(row.original.created_at) },
  ]
}
