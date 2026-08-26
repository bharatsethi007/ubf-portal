import type { ColumnDef } from '@tanstack/react-table'
import { AlertTriangle, ArrowUp, ArrowDown, ArrowLeftRight, Package, Ship, Check } from 'lucide-react'
import { format } from 'date-fns'
import type { TmsConsignmentRow } from './tmsApi'

const TYPE_ICON: Record<string, { Icon: typeof ArrowUp; title: string; cls: string }> = {
  'pick-up': { Icon: ArrowUp, title: 'Pick-up', cls: 'bg-blue-50 text-blue-600' },
  'drop-off': { Icon: ArrowDown, title: 'Drop-off', cls: 'bg-amber-50 text-amber-600' },
  transfer: { Icon: ArrowLeftRight, title: 'Transfer', cls: 'bg-violet-50 text-violet-600' },
}

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
function initials(f?: string, l?: string) { return (`${f?.[0] ?? ''}${l?.[0] ?? ''}`).toUpperCase() || '—' }

export function opsColumns(): ColumnDef<TmsConsignmentRow>[] {
  return [
    { id: 'no', header: 'Consignment #', cell: ({ row }) => {
      const t = TYPE_ICON[row.original.order_type]
      const Icon = t?.Icon
      return (
        <span className="inline-flex items-center gap-2 font-medium text-neutral-900">
          {Icon && <span title={t.title} className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${t.cls}`}><Icon size={13} /></span>}
          <span className="inline-flex items-center gap-1 tabular-nums text-[13px]">{row.original.consignment_no ?? '—'}{row.original.goods_type === 'dangerous' && <AlertTriangle size={13} className="text-red-600" />}</span>
        </span>
      )
    } },
    { id: 'company', header: 'Company', cell: ({ row }) => <span className="text-[13px]">{(row.original.order_type === 'drop-off' ? row.original.receiver_company : row.original.sender_company) ?? '—'}</span> },
    { id: 'origin', header: 'Origin', cell: ({ row }) => <span className="text-[13px] text-neutral-600">{row.original.sender_address ?? '—'}</span> },
    { id: 'dest', header: 'Destination', cell: ({ row }) => <span className="text-[13px] text-neutral-600">{row.original.receiver_address ?? '—'}</span> },
    { id: 'links', header: 'Links', cell: ({ row }) => {
      const bref = row.original.booking?.booking_ref ?? (row.original.booking_id ? 'Booking linked' : null)
      const sref = row.original.shipment_ref ?? (row.original.job_unique != null ? `Shipment #${row.original.job_unique}` : null)
      if (!bref && !sref) return <span className="text-neutral-300">—</span>
      return (
        <span className="flex items-center gap-1.5">
          {bref && <span title={bref} className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><Package size={13} /></span>}
          {sref && <span title={sref} className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-50 text-sky-600"><Ship size={13} /></span>}
        </span>
      )
    } },
    { id: 'pickup', header: 'Preferred Pick-up', cell: ({ row }) => <span className="whitespace-nowrap text-[13px]">{fmt(row.original.preferred_pickup_at)}</span> },
    { id: 'eta', header: 'Estimated Delivery', cell: ({ row }) => <span className="whitespace-nowrap text-[13px]">{fmt(row.original.estimated_delivery_at)}</span> },
    { id: 'driver', header: 'Driver', cell: ({ row }) => {
      const d = row.original.driver1
      if (!d) return <span className="text-neutral-300">—</span>
      return <span title={`${d.first_name} ${d.last_name}`} className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0A2472] text-[11px] font-semibold text-white">{initials(d.first_name, d.last_name)}</span>
    } },
    { id: 'checkin', header: 'Check-in', cell: ({ row }) => row.original.wms_checkin_at
      ? <Check size={16} className="text-emerald-600" />
      : <span className="text-neutral-300">—</span> },
    { id: 'status', header: 'Status', cell: ({ row }) => {
      const b = STATUS_BADGE[row.original.status] ?? { label: row.original.status, cls: 'bg-neutral-100 text-neutral-700' }
      return <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${b.cls}`}>{b.label}</span>
    } },
  ]
}
