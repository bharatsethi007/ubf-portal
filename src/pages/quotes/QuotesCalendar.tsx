import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  addDays, addMonths, addWeeks, eachDayOfInterval, endOfMonth, endOfWeek,
  format, isSameMonth, isToday, startOfMonth, startOfWeek,
} from 'date-fns'
import { listCalendarQuotes, DATE_BASES, type BoardQuote, type DateBasis } from './quotesBoardApi'
import { modeTag } from './quoteCardMeta'

type Props = {
  search: string
  onOpen: (id: string) => void
}

type Mode = 'week' | 'month'
const WEEK_OPTS = { weekStartsOn: 1 as const } // Monday-first

// Local-date key for a quote's chosen date. Date-only columns are already
// 'yyyy-MM-dd'; created_at is a timestamp, so resolve it in local time.
function dayKey(value: string | null, basis: DateBasis): string | null {
  if (!value) return null
  if (basis === 'created_at') return format(new Date(value), 'yyyy-MM-dd')
  return value.slice(0, 10)
}

export default function QuotesCalendar({ search, onOpen }: Props) {
  const [mode, setMode] = useState<Mode>('week')
  const [basis, setBasis] = useState<DateBasis>('created_at')
  const [anchor, setAnchor] = useState<Date>(() => new Date())
  const [rows, setRows] = useState<BoardQuote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const reqId = useRef(0)

  // Visible day span. Month view pads to full weeks so leading/trailing days show.
  const { gridStart, gridEnd, days } = useMemo(() => {
    let start: Date
    let end: Date
    if (mode === 'week') {
      start = startOfWeek(anchor, WEEK_OPTS)
      end = endOfWeek(anchor, WEEK_OPTS)
    } else {
      start = startOfWeek(startOfMonth(anchor), WEEK_OPTS)
      end = endOfWeek(endOfMonth(anchor), WEEK_OPTS)
    }
    return { gridStart: start, gridEnd: end, days: eachDayOfInterval({ start, end }) }
  }, [mode, anchor])

  useEffect(() => {
    const my = ++reqId.current
    setLoading(true)
    const fromIso = format(gridStart, 'yyyy-MM-dd')
    const toIso = format(addDays(gridEnd, 1), 'yyyy-MM-dd') // exclusive upper bound
    listCalendarQuotes(basis, fromIso, toIso, search)
      .then((data) => {
        if (my !== reqId.current) return
        setRows(data)
        setError('')
      })
      .catch((e) => {
        if (my !== reqId.current) return
        setError(e instanceof Error ? e.message : 'Failed to load quotes')
        setRows([])
      })
      .finally(() => {
        if (my === reqId.current) setLoading(false)
      })
  }, [basis, gridStart, gridEnd, search])

  const byDay = useMemo(() => {
    const m = new Map<string, BoardQuote[]>()
    for (const r of rows) {
      const k = dayKey(r[basis], basis)
      if (!k) continue
      const b = m.get(k)
      if (b) b.push(r)
      else m.set(k, [r])
    }
    return m
  }, [rows, basis])

  function step(dir: -1 | 1) {
    setAnchor((a) => (mode === 'week' ? addWeeks(a, dir) : addMonths(a, dir)))
  }

  const rangeLabel =
    mode === 'week'
      ? `${format(gridStart, 'd MMM')} – ${format(gridEnd, 'd MMM yyyy')}`
      : format(anchor, 'MMMM yyyy')

  const activeColor = DATE_BASES.find((b) => b.value === basis)?.color ?? '#0EA5E9'
  const perCellCap = mode === 'week' ? 20 : 3

  function renderCard(q: BoardQuote) {
    const { label, Icon } = modeTag(q.shipment_mode, q.shipment_type)
    return (
      <button
        key={q.id}
        type="button"
        className="qcal__event"
        style={{ ['--evt' as string]: activeColor }}
        onClick={() => onOpen(q.id)}
        title={`${q.quote_no ?? ''} · ${q.customer_name ?? ''}`}
      >
        <span className="qcal__event-ref">{q.quote_no ?? '—'}</span>
        <span className="qcal__event-cust">{q.customer_name ?? '—'}</span>
        <span className="qcal__event-mode">
          <Icon size={11} /> {label}
        </span>
      </button>
    )
  }

  return (
    <div className="qcal">
      <div className="qcal__toolbar">
        <div className="qcal__nav">
          <button type="button" className="qcal__navbtn" onClick={() => step(-1)} aria-label="Previous">
            <ChevronLeft size={16} />
          </button>
          <button type="button" className="qcal__today" onClick={() => setAnchor(new Date())}>
            Today
          </button>
          <button type="button" className="qcal__navbtn" onClick={() => step(1)} aria-label="Next">
            <ChevronRight size={16} />
          </button>
          <span className="qcal__range">{rangeLabel}</span>
        </div>

        <div className="qcal__controls">
          <label className="qcal__select-label">
            <span>Date</span>
            <select
              className="input input--sm qcal__select"
              value={basis}
              onChange={(e) => setBasis(e.target.value as DateBasis)}
            >
              {DATE_BASES.map((b) => (
                <option key={b.value} value={b.value}>{b.label}</option>
              ))}
            </select>
          </label>
          <div className="qcal__seg">
            {(['week', 'month'] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                className={`qcal__seg-btn${mode === m ? ' qcal__seg-btn--on' : ''}`}
                onClick={() => setMode(m)}
              >
                {m === 'week' ? 'Weekly' : 'Monthly'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="qcal__weekdays">
        {days.slice(0, 7).map((d) => (
          <div key={d.toISOString()} className="qcal__weekday">{format(d, 'EEE')}</div>
        ))}
      </div>

      <div className={`qcal__grid qcal__grid--${mode}`} aria-busy={loading}>
        {days.map((d) => {
          const key = format(d, 'yyyy-MM-dd')
          const items = byDay.get(key) ?? []
          const shown = items.slice(0, perCellCap)
          const extra = items.length - shown.length
          const dim = mode === 'month' && !isSameMonth(d, anchor)
          return (
            <div
              key={key}
              className={`qcal__cell${dim ? ' qcal__cell--dim' : ''}${isToday(d) ? ' qcal__cell--today' : ''}`}
            >
              <div className="qcal__cell-head">
                <span className="qcal__cell-num">{format(d, 'd')}</span>
                {items.length > 0 && <span className="qcal__cell-count">{items.length}</span>}
              </div>
              <div className="qcal__cell-body">
                {shown.map(renderCard)}
                {extra > 0 && <span className="qcal__more">+{extra} more</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
