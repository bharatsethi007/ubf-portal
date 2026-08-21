import { dayTabLabel } from './conferenceDays'
import { hhmm, meetingBadge } from './meetingTime'
import type { ConferenceMeeting } from './meetingsApi'

type Props = {
  days: string[]
  meetings: ConferenceMeeting[]
  now: Date
  onOpenDetail: (m: ConferenceMeeting) => void
}

const HOUR_PX = 64
const HEADER_PX = 40
const COL_MIN = 150
const GUTTER = 56

const BREAK_STYLE = { bg: '#f1f5f9', fg: '#64748b', bd: '#cbd5e1' }

const VARIANT_STYLE: Record<string, { bg: string; fg: string; bd: string }> = {
  '--live': { bg: '#dcfce7', fg: '#166534', bd: '#86efac' },
  '--upcoming': { bg: '#dbeafe', fg: '#1d4ed8', bd: '#bfdbfe' },
  '--done': { bg: '#d1fae5', fg: '#047857', bd: '#a7f3d0' },
  '--cancel': { bg: '#fee2e2', fg: '#b91c1c', bd: '#fecaca' },
  '--noshow': { bg: '#fef3c7', fg: '#b45309', bd: '#fde68a' },
}

function toMin(t: string): number {
  const [h, m] = t.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

function fmtHour(h: number): string {
  const period = h < 12 ? 'AM' : 'PM'
  const display = ((h + 11) % 12) + 1
  return `${display} ${period}`
}

type Item = { m: ConferenceMeeting; s: number; e: number }
type Placed = { item: Item; col: number; cols: number }

function layoutColumns(items: Item[]): Placed[] {
  const sorted = [...items].sort((a, b) => a.s - b.s || a.e - b.e)
  const result: Placed[] = []
  let cluster: Item[] = []
  let clusterEnd = -1

  const flush = () => {
    const colEnds: number[] = []
    const assigned: { item: Item; col: number }[] = []
    for (const it of cluster) {
      let c = colEnds.findIndex((end) => end <= it.s)
      if (c === -1) {
        c = colEnds.length
        colEnds.push(it.e)
      } else {
        colEnds[c] = it.e
      }
      assigned.push({ item: it, col: c })
    }
    const cols = colEnds.length || 1
    for (const a of assigned) result.push({ item: a.item, col: a.col, cols })
    cluster = []
    clusterEnd = -1
  }

  for (const it of sorted) {
    if (cluster.length && it.s >= clusterEnd) flush()
    cluster.push(it)
    clusterEnd = Math.max(clusterEnd, it.e)
  }
  if (cluster.length) flush()
  return result
}

export default function ConferenceCalendar({ days, meetings, now, onOpenDetail }: Props) {
  const allTimes = meetings.flatMap((m) => [toMin(m.start_time), toMin(m.end_time)])
  let startH = 8
  let endH = 18
  if (allTimes.length) {
    startH = Math.min(startH, Math.floor(Math.min(...allTimes) / 60))
    endH = Math.max(endH, Math.ceil(Math.max(...allTimes) / 60))
  }
  startH = Math.max(0, startH)
  endH = Math.min(24, endH)
  if (endH <= startH) endH = startH + 1
  const gridStartMin = startH * 60
  const totalPx = (endH - startH) * HOUR_PX
  const pxPerMin = HOUR_PX / 60
  const hours = Array.from({ length: endH - startH + 1 }, (_, i) => startH + i)

  const byDay = days.map((day) => {
    const items: Item[] = meetings
      .filter((m) => m.meeting_date === day)
      .map((m) => {
        const s = toMin(m.start_time)
        return { m, s, e: Math.max(toMin(m.end_time), s + 15) }
      })
    return { day, placed: layoutColumns(items) }
  })

  const minWidth = GUTTER + COL_MIN * days.length

  return (
    <div
      className="overflow-auto rounded-xl border border-border bg-background"
      style={{ maxHeight: 'calc(100vh - 190px)' }}
    >
      <div style={{ minWidth }}>
        <div className="sticky top-0 z-10 flex border-b border-border bg-background">
          <div className="shrink-0" style={{ width: GUTTER }} />
          {days.map((day, di) => (
            <div
              key={day}
              className="flex-1 border-l border-border py-2 text-center text-xs font-medium text-foreground"
              style={{ minWidth: COL_MIN, height: HEADER_PX }}
            >
              {dayTabLabel(day, di)}
            </div>
          ))}
        </div>

        <div className="flex">
          <div className="relative shrink-0" style={{ width: GUTTER, height: totalPx }}>
            {hours.map((h, i) => (
              <span
                key={h}
                className="absolute right-2 text-[11px] text-muted-foreground"
                style={{ top: i * HOUR_PX - 6 }}
              >
                {fmtHour(h)}
              </span>
            ))}
          </div>

          {byDay.map(({ day, placed }) => (
            <div
              key={day}
              className="relative flex-1 border-l border-border"
              style={{ minWidth: COL_MIN, height: totalPx }}
            >
              {hours.map((h, i) => (
                <div
                  key={h}
                  className="absolute inset-x-0 border-t border-border/60"
                  style={{ top: i * HOUR_PX }}
                />
              ))}

              {placed.map(({ item, col, cols }) => {
                const style = item.m.is_break
                  ? BREAK_STYLE
                  : VARIANT_STYLE[meetingBadge(item.m, now).variant] ?? VARIANT_STYLE['--upcoming']
                const top = (item.s - gridStartMin) * pxPerMin
                const height = Math.max((item.e - item.s) * pxPerMin - 2, 22)
                const widthPct = 100 / cols
                const label = item.m.agent_name ?? item.m.manual_agent_name ?? '—'
                return (
                  <button
                    key={item.m.id}
                    type="button"
                    onClick={() => onOpenDetail(item.m)}
                    className="absolute overflow-hidden rounded-md border px-2 py-1 text-left transition-shadow hover:shadow-sm"
                    style={{
                      top,
                      height,
                      left: `calc(${col * widthPct}% + 2px)`,
                      width: `calc(${widthPct}% - 4px)`,
                      background: style.bg,
                      color: style.fg,
                      borderColor: style.bd,
                    }}
                  >
                    <div className="truncate text-[11px] font-medium leading-tight">{label}</div>
                    <div className="truncate text-[10px] leading-tight opacity-80">
                      {hhmm(item.m.start_time)}–{hhmm(item.m.end_time)}
                    </div>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
