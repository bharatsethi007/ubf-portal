import {
  Anchor,
  ArrowDownToLine,
  ArrowUpToLine,
  FileText,
  LogIn,
  LogOut,
  MapPin,
  Package,
  Ship,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { BookingTrackingEvent } from './trackingTypes'
import { carrierEventLabel } from './carrierEventLabels'
import { eventVesselLabel, formatEventTimestamp } from './trackingFormat'

type EventStyle = { Icon: LucideIcon; dot: string; ring: string }

function eventStyle(code: string): EventStyle {
  switch (code.trim().toUpperCase()) {
    case 'ARRI':
      return { Icon: Anchor, dot: 'bg-emerald-500', ring: 'ring-emerald-100' }
    case 'DEPA':
      return { Icon: Ship, dot: 'bg-blue-500', ring: 'ring-blue-100' }
    case 'LOAD':
      return { Icon: ArrowUpToLine, dot: 'bg-[#F7941D]', ring: 'ring-orange-100' }
    case 'DISC':
      return { Icon: ArrowDownToLine, dot: 'bg-[#F7941D]', ring: 'ring-orange-100' }
    case 'GTIN':
      return { Icon: LogIn, dot: 'bg-slate-500', ring: 'ring-slate-100' }
    case 'GTOT':
      return { Icon: LogOut, dot: 'bg-slate-500', ring: 'ring-slate-100' }
    case 'RECE':
    case 'ISSU':
    case 'APPR':
    case 'RELS':
      return { Icon: FileText, dot: 'bg-[#0A2472]', ring: 'ring-blue-100' }
    default:
      return { Icon: Package, dot: 'bg-slate-400', ring: 'ring-slate-100' }
  }
}

type PortGroup = {
  key: string
  code: string | null
  title: string
  countryCode: string | null
  events: BookingTrackingEvent[]
}

function countryFromUnloc(code: string | null): string | null {
  if (!code) return null
  const cc = code.trim().slice(0, 2).toLowerCase()
  return /^[a-z]{2}$/.test(cc) ? cc : null
}

/** Merge all events at a port into one stop (journey order), portless document
 * events into a trailing "Documentation" group. Assumes ascending time order. */
function buildGroups(events: BookingTrackingEvent[]): PortGroup[] {
  const byPort = new Map<string, PortGroup>()
  const order: string[] = []
  const docs: BookingTrackingEvent[] = []

  for (const ev of events) {
    const code = ev.partner_port_code?.trim() || null
    if (!code) {
      docs.push(ev)
      continue
    }
    let group = byPort.get(code)
    if (!group) {
      group = {
        key: code,
        code,
        title: ev.event_location ?? code,
        countryCode: countryFromUnloc(code),
        events: [],
      }
      byPort.set(code, group)
      order.push(code)
    } else if ((!group.title || group.title === group.code) && ev.event_location) {
      group.title = ev.event_location
    }
    group.events.push(ev)
  }

  const groups = order.map((code) => byPort.get(code)!)
  if (docs.length > 0) {
    groups.push({ key: 'docs', code: null, title: 'Documentation', countryCode: null, events: docs })
  }
  return groups
}

type Leg = { text: string; cls: string }

/** POL / T/S / POD marker for a port group. */
function legFor(group: PortGroup, physicalKeys: string[]): Leg | null {
  if (!group.code) return null
  const i = physicalKeys.indexOf(group.key)
  if (i === 0) return { text: 'POL', cls: 'bg-emerald-100 text-emerald-700' }
  if (i === physicalKeys.length - 1 && physicalKeys.length > 1) {
    return { text: 'POD', cls: 'bg-[#0A2472]/10 text-[#0A2472]' }
  }
  return { text: 'T/S', cls: 'bg-amber-100 text-amber-700' }
}

function TrackingSummary({
  events,
  groups,
}: {
  events: BookingTrackingEvent[]
  groups: PortGroup[]
}) {
  const physical = groups.filter((g) => g.code)
  const origin = physical[0] ?? null
  const dest = physical.length > 1 ? physical[physical.length - 1] : null

  const departs = events.find((e) => e.event_type_code.toUpperCase() === 'DEPA') ?? null
  const arrivals = events.filter((e) => e.event_type_code.toUpperCase() === 'ARRI')
  const arrives = arrivals.length ? arrivals[arrivals.length - 1] : null

  const containers = [...new Set(events.map((e) => e.container_no).filter(Boolean))] as string[]
  const iso = events.find((e) => e.container_iso_type)?.container_iso_type ?? null

  return (
    <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold tracking-tight">
          {containers.length === 1 ? containers[0] : `${containers.length} containers`}
        </span>
        {iso ? (
          <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[11px] font-medium text-slate-700">
            {iso}
          </span>
        ) : null}
      </div>

      {origin ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
          <span className="inline-flex items-center gap-1.5">
            {origin.countryCode ? <span className={`fi fi-${origin.countryCode} rounded-sm`} aria-hidden /> : null}
            <span className="font-medium">{origin.title}</span>
          </span>
          {dest ? (
            <>
              <span className="text-muted-foreground">→</span>
              <span className="inline-flex items-center gap-1.5">
                {dest.countryCode ? <span className={`fi fi-${dest.countryCode} rounded-sm`} aria-hidden /> : null}
                <span className="font-medium">{dest.title}</span>
              </span>
            </>
          ) : null}
        </div>
      ) : null}

      {(departs || arrives) ? (
        <div className="mt-1.5 flex flex-col gap-0.5 text-xs text-muted-foreground sm:flex-row sm:gap-4">
          {departs ? <span>Departs · {formatEventTimestamp(departs.event_datetime)}</span> : null}
          {arrives ? <span>Arrives · {formatEventTimestamp(arrives.event_datetime)}</span> : null}
        </div>
      ) : null}
    </div>
  )
}

export default function CarrierEventsList({ events }: { events: BookingTrackingEvent[] }) {
  const carrierEvents = events
    .filter((ev) => ev.source === 'carrier')
    .slice()
    .sort((a, b) => new Date(a.event_datetime).getTime() - new Date(b.event_datetime).getTime())

  if (carrierEvents.length === 0) return null

  const groups = buildGroups(carrierEvents)
  const physicalKeys = groups.filter((g) => g.code).map((g) => g.key)

  return (
    <div className="mt-3 space-y-3">
      <TrackingSummary events={carrierEvents} groups={groups} />

      {groups.map((group) => {
        const leg = legFor(group, physicalKeys)
        return (
          <div
            key={group.key}
            className="overflow-hidden rounded-lg border border-border/70 bg-card/40"
          >
            <div className="flex items-center gap-2 bg-muted/50 px-3 py-2">
              {group.countryCode ? (
                <span className={`fi fi-${group.countryCode} rounded-sm`} aria-hidden />
              ) : group.code ? (
                <MapPin size={14} className="text-muted-foreground" />
              ) : (
                <FileText size={14} className="text-muted-foreground" />
              )}
              <span className="text-[13px] font-semibold tracking-tight">{group.title}</span>
              {leg ? (
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${leg.cls}`}>
                  {leg.text}
                </span>
              ) : null}
              {group.code ? (
                <span className="ml-auto rounded bg-[#0A2472]/10 px-1.5 py-0.5 text-[11px] font-medium text-[#0A2472]">
                  {group.code}
                </span>
              ) : null}
            </div>

            <ul className="px-3 py-2">
              {group.events.map((ev, idx) => {
                const style = eventStyle(ev.event_type_code)
                const Icon = style.Icon
                const vessel = eventVesselLabel(ev)
                const isLast = idx === group.events.length - 1
                return (
                  <li key={String(ev.id)} className="relative flex gap-3 pb-3 last:pb-0">
                    {!isLast ? (
                      <span className="absolute bottom-0 left-[11px] top-6 w-px bg-border" />
                    ) : null}
                    <span
                      className={`relative z-[1] mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-white ring-4 ${style.dot} ${style.ring}`}
                    >
                      <Icon size={12} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[13px] font-medium">
                          {carrierEventLabel(ev.event_type_code)}
                          {ev.is_estimated ? (
                            <span className="ml-1 rounded bg-amber-100 px-1 py-px align-middle text-[10px] font-medium text-amber-700">
                              EST
                            </span>
                          ) : null}
                        </span>
                        <span className="nums shrink-0 text-xs text-muted-foreground">
                          {formatEventTimestamp(ev.event_datetime)}
                        </span>
                      </div>
                      {vessel ? (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{vessel}</p>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
