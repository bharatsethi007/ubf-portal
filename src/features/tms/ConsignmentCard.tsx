import { MapPin, AlertTriangle, X, Package, Weight, Box, Clock, CalendarClock } from 'lucide-react'
import { format } from 'date-fns'
import { cardTotals, type CardRow } from './dispatchApi'

const TYPE_LABEL: Record<string, string> = { 'pick-up': 'PICK-UP', 'drop-off': 'DROP-OFF', transfer: 'TRANSFER' }
const fmt = (v: string | null) => (v ? format(new Date(v), 'd MMM, h:mm a') : '—')

type Props = { card: CardRow; onOpen: () => void; onUnassign?: (id: string) => void }

export default function ConsignmentCard({ card, onOpen, onUnassign }: Props) {
  const t = cardTotals(card)
  const flags = [
    card.signature_required && 'Signature', card.photo_pod_required && 'Photo POD',
    card.tail_lift_required && 'Tail Lift', card.temperature_control && 'Temp',
  ].filter(Boolean) as string[]

  return (
    <div draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', card.id)}
      className="group relative w-full cursor-grab rounded-lg border border-neutral-200 bg-white p-3 text-left hover:border-[#0A2472]/40 hover:shadow-sm active:cursor-grabbing">
      {card.assigned_driver_leg1 && onUnassign && (
        <button type="button" aria-label="Unassign" onClick={(e) => { e.stopPropagation(); onUnassign(card.id) }}
          className="absolute right-2 top-2 hidden h-6 w-6 items-center justify-center rounded text-neutral-400 hover:bg-red-50 hover:text-red-600 group-hover:flex">
          <X size={14} />
        </button>
      )}
      <button type="button" onClick={onOpen} className="block w-full text-left">
        {/* header */}
        <div className="mb-2 flex flex-wrap items-center gap-1.5 pr-6">
          <span className="font-semibold text-[#0A2472]">{card.consignment_no ?? '—'}</span>
          <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-neutral-600">{TYPE_LABEL[card.order_type] ?? card.order_type}</span>
          {card.goods_type === 'dangerous' && <AlertTriangle size={14} className="text-red-600" />}
          {flags.map((f) => <span key={f} className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[11px] text-neutral-600">{f}</span>)}
        </div>

        {/* route: pickup -> drop-off (single column, full width) */}
        <div className="space-y-1.5 text-sm">
          <div className="flex items-start gap-1.5">
            <MapPin size={14} className="mt-0.5 shrink-0 text-neutral-400" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{card.sender_company ?? '—'}</span>
              <span className="block truncate text-xs text-neutral-500">{card.sender_address ?? '—'}</span>
            </span>
          </div>
          <div className="flex items-start gap-1.5">
            <MapPin size={14} className="mt-0.5 shrink-0 text-[#0A2472]" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{card.receiver_company ?? '—'}</span>
              <span className="block truncate text-xs text-neutral-500">{card.receiver_address ?? '—'}</span>
            </span>
          </div>
        </div>

        {/* footer: cargo totals with icons */}
        <div className="mt-2.5 flex items-center gap-3 border-t border-neutral-100 pt-2 text-xs text-neutral-600">
          <span className="inline-flex items-center gap-1"><Package size={13} className="text-neutral-400" />{t.pc}</span>
          <span className="inline-flex items-center gap-1"><Weight size={13} className="text-neutral-400" />{t.kg} kg</span>
          <span className="inline-flex items-center gap-1"><Box size={13} className="text-neutral-400" />{t.cbm} CBM</span>
        </div>

        {/* timing */}
        <div className="mt-1 flex items-center gap-1 text-[11px] text-neutral-500">
          {card.assigned_at
            ? <><Clock size={12} className="shrink-0 text-neutral-400" /><span className="truncate">Assigned {fmt(card.assigned_at)}</span></>
            : <><CalendarClock size={12} className="shrink-0 text-neutral-400" /><span className="truncate">Pickup {fmt(card.preferred_pickup_at)}</span></>}
        </div>
      </button>
    </div>
  )
}
