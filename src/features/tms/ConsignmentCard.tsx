import { useState } from 'react'
import { ArrowUp, ArrowDown, AlertTriangle, X, Check, Package, Weight, Box, Clock, CalendarClock, ChevronDown, ChevronUp } from 'lucide-react'
import { format } from 'date-fns'
import { cardTotals, type CardRow } from './dispatchApi'

const TYPE_LABEL: Record<string, string> = { 'pick-up': 'PICK-UP', 'drop-off': 'DROP-OFF', transfer: 'TRANSFER' }
const fmt = (v: string | null) => (v ? format(new Date(v), 'd MMM, h:mm a') : '—')
const DONE = ['complete', 'checked_in', 'cancel', 'archived']

type Props = { card: CardRow; onOpen: () => void; onUnassign?: (id: string) => void; onComplete?: (id: string) => void }

export default function ConsignmentCard({ card, onOpen, onUnassign, onComplete }: Props) {
  const [expanded, setExpanded] = useState(false)
  const t = cardTotals(card)
  const canComplete = !DONE.includes(card.status)
  const flags = [
    card.signature_required && 'Signature', card.photo_pod_required && 'Photo POD',
    card.tail_lift_required && 'Tail Lift', card.temperature_control && 'Temp',
  ].filter(Boolean) as string[]

  const showPickup = card.order_type !== 'drop-off'
  const showDropoff = card.order_type !== 'pick-up'

  return (
    <div draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', card.id)}
      className="group relative w-full cursor-grab rounded-lg border border-neutral-200 bg-white p-2.5 text-left hover:border-[#0A2472]/40 hover:shadow-sm active:cursor-grabbing">
      {canComplete && onComplete && (
        <button type="button" aria-label="Mark complete" title="Mark complete" onClick={(e) => { e.stopPropagation(); onComplete(card.id) }}
          className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded text-emerald-600 hover:bg-emerald-50">
          <Check size={14} />
        </button>
      )}
      {card.assigned_driver_leg1 && onUnassign && (
        <button type="button" aria-label="Unassign" onClick={(e) => { e.stopPropagation(); onUnassign(card.id) }}
          className="absolute right-8 top-1.5 hidden h-5 w-5 items-center justify-center rounded text-neutral-400 hover:bg-red-50 hover:text-red-600 group-hover:flex">
          <X size={13} />
        </button>
      )}

      <div className="flex items-stretch gap-1">
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5 pr-12">
            <span className="text-sm font-semibold text-[#0A2472]">{card.consignment_no ?? '—'}</span>
            <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-neutral-600">{TYPE_LABEL[card.order_type] ?? card.order_type}</span>
            {card.goods_type === 'dangerous' && <AlertTriangle size={13} className="text-red-600" />}
            {flags.map((f) => <span key={f} className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-600">{f}</span>)}
          </div>

          {expanded ? (
            <div className="space-y-1.5 text-sm">
              <div className="flex items-start gap-1.5">
                <ArrowUp size={13} className="mt-0.5 shrink-0 text-[#0F7A4E]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{card.sender_company ?? '—'}</span>
                  <span className="block truncate text-xs text-neutral-500">{card.sender_address ?? '—'}</span>
                </span>
              </div>
              <div className="flex items-start gap-1.5">
                <ArrowDown size={13} className="mt-0.5 shrink-0 text-[#B0264A]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{card.receiver_company ?? '—'}</span>
                  <span className="block truncate text-xs text-neutral-500">{card.receiver_address ?? '—'}</span>
                </span>
              </div>
              <div className="flex items-center gap-3 border-t border-neutral-100 pt-1.5 text-xs text-neutral-600">
                <span className="inline-flex items-center gap-1"><Package size={13} className="text-neutral-400" />{t.pc}</span>
                <span className="inline-flex items-center gap-1"><Weight size={13} className="text-neutral-400" />{t.kg} kg</span>
                <span className="inline-flex items-center gap-1"><Box size={13} className="text-neutral-400" />{t.cbm} CBM</span>
              </div>
              <div className="flex flex-col gap-0.5 text-[11px] text-neutral-500">
                {card.assigned_at && <span className="inline-flex items-center gap-1"><Clock size={12} className="text-neutral-400" />Assigned {fmt(card.assigned_at)}</span>}
                <span className="inline-flex items-center gap-1"><CalendarClock size={12} className="text-neutral-400" />Pickup {fmt(card.preferred_pickup_at)}</span>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-0.5 text-sm">
                {showPickup && (
                  <div className="flex items-center gap-1.5">
                    <ArrowUp size={13} className="shrink-0 text-[#0F7A4E]" />
                    <span className="truncate font-medium">{card.sender_company ?? '—'}</span>
                  </div>
                )}
                {showDropoff && (
                  <div className="flex items-center gap-1.5">
                    <ArrowDown size={13} className="shrink-0 text-[#B0264A]" />
                    <span className="truncate font-medium">{card.receiver_company ?? '—'}</span>
                  </div>
                )}
              </div>
              <div className="mt-2 flex items-center gap-3 border-t border-neutral-100 pt-1.5 text-[11px] text-neutral-500">
                <span className="inline-flex items-center gap-1"><Package size={12} className="text-neutral-400" />{t.pc}</span>
                <span className="inline-flex items-center gap-1"><Weight size={12} className="text-neutral-400" />{t.kg}</span>
                <span className="inline-flex items-center gap-1"><Box size={12} className="text-neutral-400" />{t.cbm}</span>
                <span className="ml-auto inline-flex items-center gap-1 truncate">
                  {card.assigned_at ? <Clock size={12} className="shrink-0 text-neutral-400" /> : <CalendarClock size={12} className="shrink-0 text-neutral-400" />}
                  <span className="truncate">{card.assigned_at ? fmt(card.assigned_at) : fmt(card.preferred_pickup_at)}</span>
                </span>
              </div>
            </>
          )}
        </button>

        <button type="button" onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v) }}
          title={expanded ? 'Collapse' : 'Expand'} aria-expanded={expanded}
          className="flex shrink-0 items-center self-center rounded px-0.5 text-neutral-400 hover:text-[#0A2472]">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>
    </div>
  )
}
