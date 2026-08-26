import type { ColumnDef } from '@tanstack/react-table'
import { AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'
import type { TmsConsignmentRow } from './tmsApi'

const TYPE_LABEL: Record<string, string> = { 'pick-up': 'PICK-UP', 'drop-off': 'DROP-OFF', transfer: 'TRANSFER' }

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  unassigned: { label: 'Unassigned', cls: 'bg-amber-100 text-amber-800' },
  assigned: { label: 'Assigned', cls: 'bg-blue-100 text-blue-800' },
  inTransit: { label: 'In Transit', cls: 'bg-indigo-100 text-indigo-800' },
  atDepot: { label: 'At Depot', cls: 'bg-sky-100 text-sky-800' },
  assignedLeg2: { label: 'Assigned (Leg 2)', cls: 'bg-blue-100 text-blue-800' },
  inTransitLeg2: { label: 'In Transit (Leg 2)', cls: 'bg-indigo-100 text-indigo-800' },
  onHold: { label: 'On Hold', cls: 'bg-orange-100 text-orange-800' },
  complete: { label: 'Complete', cls: 'bg-emerald-100 text-emerald-800' },
  checked_in: { label: 'Checked In', cls: 'bg-emerald-100 text-emerald-800' },
  failed: { label: 'Failed', cls: 'bg-red-100 text-red-800' },
  inComplete: { label: 'Incomplete', cls: 'bg-red-100 text-red-800' },
  cancel: { label: 'Cancelled', cls: 'bg-neutral-200 text-neutral-700' },
  archived: { label: 'Archived', cls: 'bg-neutral-200 text-neutral-700' },
}

function fmt(v: string | null) { return v ? format(new Date(v), 'd MMM, h:mm a') : '—' }

export function opsColumns(): ColumnDef<TmsConsignmentRow>[] {
  return [
    { id: 'type', header: 'Type', cell: ({ row }) => <span className="text-xs font-semibold tracking-wide text-neutral-600">{TYPE_LABEL[row.original.order_type] ?? row.original.order_type}</span> },
    { id: 'no', header: 'Consignment #', cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 font-medium">{row.original.consignment_no ?? '—'}{row.original.goods_type === 'dangerous' && <AlertTriangle size={14} className="text-red-600" />}</span>
    ) },
    { id: 'company', header: 'Company', cell: ({ row }) => (row.original.order_type === 'drop-off' ? row.original.receiver_company : row.original.sender_company) ?? '—' },
    { id: 'origin', header: 'Origin', cell: ({ row }) => <span className="text-sm text-neutral-600">{row.original.sender_address ?? '—'}</span> },
    { id: 'dest', header: 'Destination', cell: ({ row }) => <span className="text-sm text-neutral-600">{row.original.receiver_address ?? '—'}</span> },
    { id: 'pickup', header: 'Preferred Pick-up', cell: ({ row }) => <span className="whitespace-nowrap text-sm">{fmt(row.original.preferred_pickup_at)}</span> },
    { id: 'eta', header: 'Estimated Delivery', cell: ({ row }) => <span className="whitespace-nowrap text-sm">{fmt(row.original.estimated_delivery_at)}</span> },
    { id: 'driver', header: 'Driver', cell: ({ row }) => (row.original.driver1 ? `${row.original.driver1.first_name} ${row.original.driver1.last_name?.[0] ?? ''}.` : '—') },
    { id: 'wms', header: 'WMS Check-in', cell: () => <span className="text-neutral-400">—</span> },
    { id: 'tms', header: 'TMS Check-in', cell: () => <span className="text-neutral-400">—</span> },
    { id: 'status', header: 'Status', cell: ({ row }) => {
      const b = STATUS_BADGE[row.original.status] ?? { label: row.original.status, cls: 'bg-neutral-100 text-neutral-700' }
      return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${b.cls}`}>{b.label}</span>
    } },
  ]
}
