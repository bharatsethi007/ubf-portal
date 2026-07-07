import { useMemo, useState } from 'react'
import type { PortMap } from '../../../hooks/usePorts'
import type { CalendarDay, CalendarEvent, PortalShipmentRow } from '../dashboard/portalDashboardApi'
import { formatShortDate } from '../dashboard/portalFormat'
import { mapShipmentStatus } from '../dashboard/portalStatus'
import { arrivalDate, departureDate } from '../dashboard/portalShipmentDates'
import { formatContainerNumbers } from '../dashboard/portalContainerLabels'
import ShipmentDetailModal from './ShipmentDetailModal'

const MAX_CHIPS = 3

type Props = {
  monthLabel: string
  days: CalendarDay[]
  rowsByJob: Map<number, PortalShipmentRow>
  containerMap: Map<string, string[]>
  ports: PortMap
  onPrevMonth: () => void
  onNextMonth: () => void
}

function routeShort(row: PortalShipmentRow, ports: PortMap): string {
  const o = ports.get(row.origin ?? '')?.name ?? row.origin ?? '—'
  const d = ports.get(row.destination ?? '')?.name ?? row.destination ?? '—'
  return `${o} → ${d}`
}

export default function ScheduleCalendar({
  monthLabel, days, rowsByJob, containerMap, ports, onPrevMonth, onNextMonth,
}: Props) {
  const [view, setView] = useState<'week' | 'month'>('month')
  const [hover, setHover] = useState<{ ev: CalendarEvent; rect: DOMRect } | null>(null)
  const [modalJob, setModalJob] = useState<number | null>(null)

  const visible = useMemo(() => {
    if (view === 'month') return days
    const today = new Date().getDate()
    const start = Math.max(1, today - 2)
    return days.filter((d) => d.day >= start && d.day < start + 7)
  }, [days, view])

  const modalRow = modalJob != null ? rowsByJob.get(modalJob) : undefined
  const hoverRow = hover ? rowsByJob.get(hover.ev.jobUnique) : undefined

  return (
    <>
      <div className="portal-card portal-card--pad portal-card--calendar">
        <div className="portal-cal-head">
          <div className="portal-cal-head__left">
            <span className="portal-card-title">Schedule</span>
            <div className="portal-cal-nav">
              <button type="button" className="portal-cal-navbtn" onClick={onPrevMonth} aria-label="Previous month">
                ‹
              </button>
              <span className="portal-card-meta">{monthLabel}</span>
              <button type="button" className="portal-cal-navbtn" onClick={onNextMonth} aria-label="Next month">
                ›
              </button>
            </div>
          </div>
          <div className="portal-cal-tog">
            {(['week', 'month'] as const).map((v) => (
              <button key={v} type="button"
                className={`portal-caltog${view === v ? ' portal-caltog--on' : ''}`}
                onClick={() => setView(v)}>
                {v}
              </button>
            ))}
          </div>
        </div>
        <div className="portal-cal-legend">
          <span><span className="portal-cal-legend__dot portal-cal-legend__dot--blue" /> Arrivals</span>
          <span><span className="portal-cal-legend__dot portal-cal-legend__dot--orange" /> Departures</span>
        </div>
        <div className="portal-cal-grid">
          {visible.map((d) => (
            <CalendarCell
              key={d.day}
              day={d}
              onHover={(ev, rect) => setHover({ ev, rect })}
              onLeave={() => setHover(null)}
              onSelect={(job) => setModalJob(job)}
            />
          ))}
        </div>
      </div>

      {hover && hoverRow && (
        <div
          className="portal-cal-popover"
          style={{ top: hover.rect.bottom + 6, left: hover.rect.left }}
        >
          <div className="portal-cal-popover__job nums">{hover.ev.jobNo}</div>
          <div className="portal-cal-popover__route">{routeShort(hoverRow, ports)}</div>
          <div className="portal-cal-popover__dates nums">
            {formatShortDate(departureDate(hoverRow))} → {formatShortDate(arrivalDate(hoverRow))}
          </div>
          <div className="portal-cal-popover__status">{mapShipmentStatus(hoverRow.status).label}</div>
        </div>
      )}

      {modalRow && (
        <ShipmentDetailModal
          row={modalRow}
          ports={ports}
          containerLabel={formatContainerNumbers(containerMap.get(modalRow.consol_key ?? '') ?? [])}
          onClose={() => setModalJob(null)}
        />
      )}
    </>
  )
}

function CalendarCell({
  day, onHover, onLeave, onSelect,
}: {
  day: CalendarDay
  onHover: (ev: CalendarEvent, rect: DOMRect) => void
  onLeave: () => void
  onSelect: (jobUnique: number) => void
}) {
  const shown = day.events.slice(0, MAX_CHIPS)
  const extra = day.events.length - shown.length
  const on = day.events.length > 0

  return (
    <div className={`portal-cal-cell${on ? ' portal-cal-cell--on' : ''}`}>
      <span className="portal-cal-cell__day nums">{day.day}</span>
      {on && (
        <div className="portal-cal-cell__chips">
          {shown.map((ev) => (
            <button
              key={`${ev.jobUnique}-${ev.kind}`}
              type="button"
              className={`portal-cal-chip nums portal-cal-chip--${ev.kind === 'arrival' ? 'blue' : 'orange'}`}
              onMouseEnter={(e) => onHover(ev, e.currentTarget.getBoundingClientRect())}
              onMouseLeave={onLeave}
              onClick={() => onSelect(ev.jobUnique)}
            >
              {ev.jobNo}
            </button>
          ))}
          {extra > 0 && <span className="portal-cal-chip portal-cal-chip--more nums">+{extra}</span>}
        </div>
      )}
    </div>
  )
}
