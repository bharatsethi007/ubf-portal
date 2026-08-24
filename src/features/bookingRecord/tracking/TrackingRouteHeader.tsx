import { deriveCarrierName } from './carrierNames'
import { formatEventTimestamp } from './trackingFormat'
import type { BookingTrackingEvent } from './trackingTypes'

function cc(code?: string | null): string | null {
  if (!code) return null
  const c = code.trim().slice(0, 2).toLowerCase()
  return /^[a-z]{2}$/.test(c) ? c : null
}

export default function TrackingRouteHeader({ events }: { events: BookingTrackingEvent[] }) {
  const evs = events
    .filter((e) => e.source === 'carrier' || e.source === 'seavantage')
    .slice()
    .sort((a, b) => new Date(a.event_datetime).getTime() - new Date(b.event_datetime).getTime())
  if (evs.length === 0) return null

  const ports = [...new Set(evs.map((e) => e.partner_port_code).filter(Boolean))] as string[]
  const originCode = ports[0] ?? null
  const destCode = ports.length > 1 ? ports[ports.length - 1] : null
  const originName = evs.find((e) => e.partner_port_code === originCode)?.event_location ?? originCode
  const destName = destCode
    ? (evs.find((e) => e.partner_port_code === destCode)?.event_location ?? destCode)
    : null

  const depart = evs.find((e) => ['DEPA', 'VD'].includes(e.event_type_code.toUpperCase())) ?? null
  const arrivals = evs.filter((e) => ['ARRI', 'VA'].includes(e.event_type_code.toUpperCase()))
  const arrive = arrivals.length ? arrivals[arrivals.length - 1] : null
  const arriveAtDest = destCode ? (arrivals.find((a) => a.partner_port_code === destCode) ?? null) : null

  const carrier = deriveCarrierName(evs)
  const vessel = [...evs].reverse().map((e) => e.inbound_vessel_name).find(Boolean) ?? null
  const containers = [...new Set(evs.map((e) => e.container_no).filter(Boolean))] as string[]

  const status = arriveAtDest ? 'Arrived' : depart ? 'In transit' : 'Booked'
  const statusDot = arriveAtDest ? 'bg-emerald-400' : depart ? 'bg-amber-400' : 'bg-slate-400'

  return (
    <div className="rounded-lg bg-[#0A2472] px-4 py-3 text-white">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-sm font-semibold tracking-tight">
          {containers.length === 1 ? containers[0] : `${containers.length} containers`}
        </span>
        {carrier ? <span className="rounded bg-white/15 px-1.5 py-0.5 text-[11px] font-medium">{carrier}</span> : null}
        {vessel ? <span className="text-[13px] text-white/80">{vessel}</span> : null}
        <span className="ml-auto inline-flex items-center gap-1.5 text-[13px]">
          <span className={`h-2 w-2 rounded-full ${statusDot}`} /> {status}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            {cc(originCode) ? <span className={`fi fi-${cc(originCode)} rounded-sm`} aria-hidden /> : null}
            <span className="truncate">{originName ?? '—'}</span>
          </div>
          <div className="text-[11px] text-white/60">
            {depart ? `ETD ${formatEventTimestamp(depart.event_datetime)}` : 'ETD —'}
          </div>
        </div>
        <div className="flex-1 border-t border-dashed border-white/30" />
        <div className="min-w-0 text-right">
          <div className="flex items-center justify-end gap-1.5 text-sm font-medium">
            {cc(destCode) ? <span className={`fi fi-${cc(destCode)} rounded-sm`} aria-hidden /> : null}
            <span className="truncate">{destName ?? '—'}</span>
          </div>
          <div className="text-[11px] text-white/60">
            {arriveAtDest || arrive ? `ETA ${formatEventTimestamp((arriveAtDest ?? arrive)!.event_datetime)}` : 'ETA —'}
          </div>
        </div>
      </div>
    </div>
  )
}
