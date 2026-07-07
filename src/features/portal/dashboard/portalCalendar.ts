import type { PortalShipmentRow } from './portalDashboardApi'
import { arrivalDate, dateInMonth, departureDate, parsePortalDate } from './portalShipmentDates'

function jobLabel(r: PortalShipmentRow): string {
  return String(r.job_no ?? r.house_bill ?? r.shipment_no ?? r.job_unique)
}

export type CalendarEvent = {
  jobUnique: number
  jobNo: string
  kind: 'arrival' | 'departure'
}

export type CalendarDay = {
  day: number
  events: CalendarEvent[]
}

export function buildCalendar(rows: PortalShipmentRow[], anchor: Date): { monthLabel: string; days: CalendarDay[] } {
  const y = anchor.getFullYear()
  const m = anchor.getMonth()
  const monthLabel = anchor.toLocaleDateString('en-NZ', { month: 'long', year: 'numeric' })
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const byDay = new Map<number, CalendarEvent[]>()

  const push = (day: number, ev: CalendarEvent) => {
    const list = byDay.get(day) ?? []
    if (list.some((e) => e.jobUnique === ev.jobUnique && e.kind === ev.kind)) return
    list.push(ev)
    byDay.set(day, list)
  }

  for (const r of rows) {
    const jobNo = jobLabel(r)
    const eta = arrivalDate(r)
    const etd = departureDate(r)

    if (dateInMonth(eta, y, m)) {
      const d = parsePortalDate(eta)!.getDate()
      push(d, { jobUnique: r.job_unique, jobNo, kind: 'arrival' })
    }
    if (dateInMonth(etd, y, m)) {
      const d = parsePortalDate(etd)!.getDate()
      push(d, { jobUnique: r.job_unique, jobNo, kind: 'departure' })
    }
  }

  const days: CalendarDay[] = []
  for (let day = 1; day <= daysInMonth; day++) {
    const events = (byDay.get(day) ?? []).sort((a, b) => a.jobNo.localeCompare(b.jobNo))
    days.push({ day, events })
  }
  return { monthLabel, days }
}
