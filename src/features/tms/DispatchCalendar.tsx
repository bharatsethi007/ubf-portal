import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format, startOfDay, endOfDay, addDays, differenceInMinutes } from 'date-fns'
import ConsignmentDrawer from './ConsignmentDrawer'
import { listDrivers, type DriverRow } from './dispatchApi'
import { listCalendarConsignments, type CalRow } from './calendarApi'

const START_HOUR = 7
const END_HOUR = 19
const HOUR_PX = 56
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)
const BODY_H = (END_HOUR - START_HOUR) * HOUR_PX

const STATUS_STYLE: Record<string, string> = {
  unassigned: 'bg-amber-50 border-amber-300 text-amber-900',
  assigned: 'bg-blue-50 border-blue-300 text-blue-900',
  assignedLeg2: 'bg-blue-50 border-blue-300 text-blue-900',
  inTransit: 'bg-indigo-50 border-indigo-300 text-indigo-900',
  inTransitLeg2: 'bg-indigo-50 border-indigo-300 text-indigo-900',
  atDepot: 'bg-sky-50 border-sky-300 text-sky-900',
  complete: 'bg-emerald-50 border-emerald-300 text-emerald-900',
  checked_in: 'bg-emerald-50 border-emerald-300 text-emerald-900',
  failed: 'bg-red-50 border-red-300 text-red-900',
  inComplete: 'bg-red-50 border-red-300 text-red-900',
}

function blockGeom(c: CalRow) {
  if (!c.preferred_pickup_at) return null
  const start = new Date(c.preferred_pickup_at)
  const top = ((start.getHours() * 60 + start.getMinutes()) - START_HOUR * 60) / 60 * HOUR_PX
  let durMin = 40
  if (c.preferred_delivery_at) {
    const d = differenceInMinutes(new Date(c.preferred_delivery_at), start)
    if (d > 0 && d < 12 * 60) durMin = d
  }
  return { top, height: Math.max(30, (durMin / 60) * HOUR_PX) }
}

export default function DispatchCalendar() {
  const [day, setDay] = useState<Date>(new Date())
  const [drivers, setDrivers] = useState<DriverRow[]>([])
  const [rows, setRows] = useState<CalRow[]>([])
  const [loading, setLoading] = useState(true)
  const [drawerId, setDrawerId] = useState<string | null>(null)

  useEffect(() => { listDrivers().then(setDrivers).catch(() => {}) }, [])
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listCalendarConsignments(startOfDay(day).toISOString(), endOfDay(day).toISOString())
      .then((d) => { if (!cancelled) setRows(d) }).catch(() => { if (!cancelled) setRows([]) }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [day])

  const columns = useMemo(() => {
    const cols: { id: string | null; label: string; sub: string }[] = [{ id: null, label: 'Unassigned', sub: '' }]
    drivers.forEach((d) => cols.push({ id: d.id, label: `${d.first_name} ${d.last_name[0]}.`, sub: d.current_registration ?? '' }))
    return cols
  }, [drivers])

  const byCol = useMemo(() => {
    const m = new Map<string | null, CalRow[]>()
    rows.forEach((r) => { const k = r.assigned_driver_leg1; if (!m.has(k)) m.set(k, []); m.get(k)!.push(r) })
    return m
  }, [rows])

  const now = new Date()
  const isToday = format(now, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')
  const nowTop = ((now.getHours() * 60 + now.getMinutes()) - START_HOUR * 60) / 60 * HOUR_PX

  return (
    <div className="quotes-page">
      <div className="card quotes-page__card">
        <div className="mb-3 flex items-center gap-2">
          <button type="button" className="flex h-8 w-8 items-center justify-center rounded-md border border-neutral-200 hover:bg-neutral-50" onClick={() => setDay((d) => addDays(d, -1))}><ChevronLeft size={16} /></button>
          <span className="min-w-[170px] text-center text-sm font-semibold">{format(day, 'EEEE d MMM yyyy')}</span>
          <button type="button" className="flex h-8 w-8 items-center justify-center rounded-md border border-neutral-200 hover:bg-neutral-50" onClick={() => setDay((d) => addDays(d, 1))}><ChevronRight size={16} /></button>
          <button type="button" className="ml-1 rounded-md border border-neutral-200 px-2 py-1 text-xs hover:bg-neutral-50" onClick={() => setDay(new Date())}>Today</button>
          {loading && <span className="text-xs text-neutral-400">Loading…</span>}
        </div>

        <div className="overflow-x-auto">
          <div className="flex min-w-max">
            <div className="sticky left-0 z-10 w-14 shrink-0 bg-white">
              <div className="h-9" />
              <div className="relative" style={{ height: BODY_H }}>
                {HOURS.map((h, i) => (
                  <div key={h} className="absolute left-0 w-full pr-1 text-right text-[11px] text-neutral-400" style={{ top: i * HOUR_PX - 6 }}>
                    {format(new Date().setHours(h, 0, 0, 0), 'h a')}
                  </div>
                ))}
              </div>
            </div>

            {columns.map((col) => {
              const items = byCol.get(col.id) ?? []
              return (
                <div key={col.id ?? 'unassigned'} className="w-48 shrink-0 border-l border-neutral-200">
                  <div className="flex h-9 flex-col items-center justify-center border-b border-neutral-200 bg-neutral-50 text-center">
                    <span className="text-xs font-semibold text-neutral-700">{col.label}</span>
                    {col.sub && <span className="text-[10px] text-neutral-400">{col.sub}</span>}
                  </div>
                  <div className="relative" style={{ height: BODY_H }}>
                    {HOURS.map((h, i) => <div key={h} className="absolute left-0 w-full border-b border-neutral-100" style={{ top: i * HOUR_PX, height: HOUR_PX }} />)}
                    {col.id === null && isToday && nowTop >= 0 && nowTop <= BODY_H && (
                      <div className="absolute left-0 z-10 w-full border-t border-red-400" style={{ top: nowTop }} />
                    )}
                    {items.map((c) => {
                      const g = blockGeom(c)
                      if (!g) return null
                      const late = Boolean(c.preferred_pickup_at) && new Date(c.preferred_pickup_at as string) < now && ['unassigned', 'assigned', 'assignedLeg2'].includes(c.status)
                      const cls = STATUS_STYLE[c.status] ?? 'bg-neutral-50 border-neutral-300 text-neutral-800'
                      return (
                        <button key={c.id} type="button" onClick={() => setDrawerId(c.id)}
                          className={`absolute left-1 right-1 overflow-hidden rounded border px-1.5 py-1 text-left text-[11px] leading-tight ${cls} ${late ? 'ring-1 ring-red-400' : ''}`}
                          style={{ top: g.top, height: g.height }}>
                          <div className="flex items-center gap-1 font-semibold"><span>{c.order_type === 'drop-off' ? '↓' : '↑'}</span>{c.consignment_no}</div>
                          <div className="truncate">{c.order_type === 'drop-off' ? c.receiver_company : c.sender_company}</div>
                          {late && <div className="font-medium text-red-600">Late</div>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <p className="mt-2 text-xs text-neutral-400">Columns are drivers; blocks sit at preferred pick-up time. Click a block for detail.</p>
      </div>
      <ConsignmentDrawer id={drawerId} onClose={() => setDrawerId(null)} />
    </div>
  )
}
