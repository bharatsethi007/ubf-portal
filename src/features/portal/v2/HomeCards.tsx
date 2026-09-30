import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock, Hash, MessageSquare, Plane, Receipt, Ship } from 'lucide-react'
import { useMessageDock } from './messages/MessagesDock'
import { fmtDayLong, monthGrid, todayIso, type CalEvent, type Exception } from './homeModel'

type ExProps = { items: Exception[]; loading: boolean; selected?: number | null; onSelect?: (id: number) => void }

/** Exceptions on Home. Each row opens to say why it's flagged, what happens next, and messages UBF in one click. */
export function ExceptionsCard({ items, loading }: ExProps) {
  const [all, setAll] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const { openMessages } = useMessageDock()
  const shown = all ? items : items.slice(0, 5)
  const icon = (e: Exception) => {
    if (e.kind === 'Billing') return <Receipt size={15} />
    if (e.kind === 'Data') return <Hash size={15} />
    if (e.kind === 'Departure') return <Clock size={15} />
    return <AlertTriangle size={15} />
  }
  return (
    <section id="exceptions" className="pv3-card pv3-exc pv3-rise" style={{ animationDelay: '.15s' }}>
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
          {shown.map((e, i) => {
            const isOpen = open === e.key
            return (
              <li key={e.key} style={{ animationDelay: `${0.2 + i * 0.06}s` }}>
                <button type="button" className={`pv3-exc__row${isOpen ? ' pv3-exc__row--on' : ''}`} aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : e.key)}>
                  <span className={`pv3-exc__icon pv3-exc__icon--${e.tone}`}>{icon(e)}</span>
                  <span className="pv3-exc__text">
                    <span className="pv3-exc__title">{e.title}</span>
                    <span className="pv3-exc__sub">{e.sub}</span>
                  </span>
                  <span className={`pv3-tag pv3-tag--${e.tone}`}>{e.kind}</span>
                  <ChevronDown size={16} className={`pv3-chev${isOpen ? ' pv3-chev--open' : ''}`} aria-hidden />
                </button>
                {isOpen && (
                  <div className="pv3-exc__more">
                    <p><b>Why</b>{e.why}</p>
                    <p><b>Next</b>{e.next}</p>
                    {e.items && e.items.length > 0 && (
                      <div className="pv3-exc__chips">
                        {e.items.map((x) => <Link key={x.id} to={x.to} className="pv3-exc__chip pv3-mono">{x.no}</Link>)}
                      </div>
                    )}
                    <div className="pv3-exc__acts">
                      <button type="button" className="pv3-btn pv3-btn--primary" onClick={() => openMessages({ job: e.ask.job ?? null, subject: e.ask.subject, draft: e.ask.draft, compose: true })}>
                        <MessageSquare size={14} /> Message UBF
                      </button>
                      <Link to={e.link.to} className="pv3-btn pv3-btn--ghost">{e.link.label} <ArrowRight size={14} /></Link>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
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

type CalProps = { events: CalEvent[]; selected: number | null; onSelect: (id: number) => void; statusOf: (id: number) => { label: string; tone: string } }

export function CalendarCard({ events, selected, onSelect, statusOf }: CalProps) {
  const today = todayIso()
  const byDay = useMemo(() => {
    const m = new Map<string, CalEvent[]>()
    for (const e of events) {
      const list = m.get(e.date) ?? []
      list.push(e)
      m.set(e.date, list)
    }
    return m
  }, [events])

  // Open on today, or the next day that has something on it.
  const firstUseful = useMemo(() => {
    if (byDay.has(today)) return today
    const dates = [...byDay.keys()].sort()
    return dates.find((d) => d >= today) ?? dates[dates.length - 1] ?? today
  }, [byDay, today])

  const [picked, setPicked] = useState<string>(today)
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() } })
  useEffect(() => {
    setPicked(firstUseful)
    setCursor({ y: Number(firstUseful.slice(0, 4)), m: Number(firstUseful.slice(5, 7)) - 1 })
  }, [firstUseful])

  const cells = useMemo(() => monthGrid(cursor.y, cursor.m), [cursor])
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
            <button key={c.iso} type="button"
              onClick={() => { setPicked(c.iso); if (list.length === 1) onSelect(list[0].id) }}
              aria-label={`${fmtDayLong(c.iso)}: ${dep} departures, ${arr} arrivals`}
              className={['pv3-cal__day', c.inMonth ? '' : 'pv3-cal__day--out', c.iso === today ? 'pv3-cal__day--today' : '', c.iso === picked ? 'pv3-cal__day--on' : '', list.length ? 'pv3-cal__day--busy' : ''].join(' ')}>
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
        <div className="pv3-cal__day-title">{fmtDayLong(picked)}{picked === today ? ' · today' : ''}</div>
        {dayList.length === 0 ? (
          <p className="pv3-muted">Nothing scheduled this day.</p>
        ) : dayList.map((e) => {
          const st = statusOf(e.id)
          return (
            <button key={e.key} type="button" className={`pv3-cal__event${selected === e.id ? ' pv3-cal__event--on' : ''}`} onClick={() => onSelect(e.id)}>
              <span className={`pv3-cal__type pv3-cal__type--${e.type}`}>{e.sea ? <Ship size={13} /> : <Plane size={13} />}</span>
              <span className="pv3-cal__eventmain">
                <span className="pv3-mono pv3-strong">{e.no}</span>
                <span className="pv3-muted">{e.type === 'dep' ? 'Departs' : 'Arrives'} {e.place}</span>
              </span>
              <span className={`pv3-pill pv3-pill--${st.tone}`}>{st.label}</span>
              <ChevronRight size={14} className="pv3-drawer__chev" />
            </button>
          )
        })}
      </div>
    </section>
  )
}
