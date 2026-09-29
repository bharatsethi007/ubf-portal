import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock, Hash, Receipt } from 'lucide-react'
import { fmtDayLong, monthGrid, todayIso, type CalEvent, type Exception } from './homeModel'

export function ExceptionsCard({ items, loading }: { items: Exception[]; loading: boolean }) {
  const [all, setAll] = useState(false)
  const shown = all ? items : items.slice(0, 5)
  const icon = (e: Exception) => {
    if (e.kind === 'Billing') return <Receipt size={15} />
    if (e.kind === 'Data') return <Hash size={15} />
    if (e.kind === 'Departure') return <Clock size={15} />
    return <AlertTriangle size={15} />
  }
  return (
    <section className="pv3-card pv3-exc pv3-rise" style={{ animationDelay: '.15s' }}>
      <header className="pv3-card__head">
        <h2>Exceptions</h2>
        {items.length > 0 && <span className="pv3-count pv3-count--red">{items.length}</span>}
      </header>
      {loading ? (
        <div className="pv3-skel-list">{[0, 1, 2].map((i) => <span key={i} className="pv3-skel" />)}</div>
      ) : items.length === 0 ? (
        <div className="pv3-allclear">
          <CheckCircle2 size={22} />
          <div><strong>All clear</strong><span>No delays, holds or overdue items right now.</span></div>
        </div>
      ) : (
        <ul className="pv3-exc__list">
          {shown.map((e, i) => (
            <li key={e.key} style={{ animationDelay: `${0.2 + i * 0.06}s` }}>
              <Link to={e.to} className="pv3-exc__row">
                <span className={`pv3-exc__icon pv3-exc__icon--${e.tone}`}>{icon(e)}</span>
                <span className="pv3-exc__text">
                  <span className="pv3-exc__title">{e.title}</span>
                  <span className="pv3-exc__sub">{e.sub}</span>
                </span>
                <span className={`pv3-tag pv3-tag--${e.tone}`}>{e.kind}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {items.length > 5 && (
        <button type="button" className="pv3-textbtn" onClick={() => setAll((v) => !v)}>
          {all ? 'Show fewer' : `Show all ${items.length}`}
        </button>
      )}
    </section>
  )
}

export function CalendarCard({ events }: { events: CalEvent[] }) {
  const today = todayIso()
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() } })
  const [picked, setPicked] = useState<string>(today)
  const cells = useMemo(() => monthGrid(cursor.y, cursor.m), [cursor])
  const byDay = useMemo(() => {
    const m = new Map<string, CalEvent[]>()
    for (const e of events) {
      const list = m.get(e.date) ?? []
      list.push(e)
      m.set(e.date, list)
    }
    return m
  }, [events])
  const title = new Date(cursor.y, cursor.m, 1).toLocaleDateString('en-NZ', { month: 'long', year: 'numeric' })
  const shift = (n: number) => setCursor((c) => {
    const d = new Date(c.y, c.m + n, 1)
    return { y: d.getFullYear(), m: d.getMonth() }
  })
  const dayList = byDay.get(picked) ?? []

  return (
    <section className="pv3-card pv3-cal pv3-rise" style={{ animationDelay: '.22s' }}>
      <header className="pv3-card__head">
        <h2><CalendarDays size={16} /> Schedule</h2>
        <div className="pv3-cal__nav">
          <button type="button" aria-label="Previous month" onClick={() => shift(-1)}><ChevronLeft size={16} /></button>
          <span>{title}</span>
          <button type="button" aria-label="Next month" onClick={() => shift(1)}><ChevronRight size={16} /></button>
        </div>
      </header>
      <div className="pv3-cal__legend">
        <span><i className="pv3-dot pv3-dot--dep" />Departures</span>
        <span><i className="pv3-dot pv3-dot--arr" />Arrivals</span>
      </div>
      <div className="pv3-cal__grid" role="grid">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <span key={d} className="pv3-cal__dow">{d}</span>)}
        {cells.map((c) => {
          const list = byDay.get(c.iso) ?? []
          const dep = list.filter((e) => e.type === 'dep').length
          const arr = list.length - dep
          return (
            <button key={c.iso} type="button" onClick={() => setPicked(c.iso)}
              className={['pv3-cal__day', c.inMonth ? '' : 'pv3-cal__day--out', c.iso === today ? 'pv3-cal__day--today' : '', c.iso === picked ? 'pv3-cal__day--on' : ''].join(' ')}>
              <span className="pv3-cal__num">{Number(c.iso.slice(8))}</span>
              <span className="pv3-cal__marks">
                {dep > 0 && <span className="pv3-cal__pill pv3-cal__pill--dep">{dep}</span>}
                {arr > 0 && <span className="pv3-cal__pill pv3-cal__pill--arr">{arr}</span>}
              </span>
            </button>
          )
        })}
      </div>
      <div className="pv3-cal__day-list">
        <div className="pv3-cal__day-title">{fmtDayLong(picked)}</div>
        {dayList.length === 0 ? (
          <p className="pv3-muted">Nothing scheduled.</p>
        ) : dayList.slice(0, 6).map((e) => (
          <Link key={e.key} to={e.to} className="pv3-cal__event">
            <i className={`pv3-dot pv3-dot--${e.type}`} />
            <span className="pv3-mono">{e.no}</span>
            <span className="pv3-muted">{e.type === 'dep' ? 'departs' : 'arrives'} {e.place}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
