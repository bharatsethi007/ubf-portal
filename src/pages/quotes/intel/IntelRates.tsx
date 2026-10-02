import { CalendarClock, FileWarning, MapPin, Ship } from 'lucide-react'
import type { RateSummary } from './factsApi'

const money = (n: number | null, ccy: string | null) => (n == null ? '-' : `${ccy ?? ''} ${n.toLocaleString(undefined, { maximumFractionDigits: n < 10 ? 2 : 0 })}`.trim())
const dt = (s: string | null) => (s ? new Date(s).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' }) : 'open')

export default function IntelRates({ rs }: { rs: RateSummary }) {
  const none = rs.live.length === 0
  return (
    <div className="fi-sec" style={{ animationDelay: '.1s' }}>
      <div className="fi-label">Rate cards<span className="fi-label__aside">buy → sell</span></div>

      {none && (
        <div className="fi-note" style={{ marginTop: 0, marginBottom: 8 }}>
          No live {rs.kind.toUpperCase()} rate card on this lane.{rs.expired.length ? ' Last card shown below.' : ' Use Request Rates.'}
        </div>
      )}

      {rs.live.map((c, i) => (
        <div key={c.cardId ?? i} className="fi-card" style={{ animationDelay: `${0.14 + i * 0.06}s` }}>
          <div className="fi-card__head">
            <Ship size={13} color="#0A2472" />
            <span className="fi-card__name">{c.carrier}</span>
            {c.transitDays != null && <span className="fi-muted">{c.transitDays}d{c.via ? ` via ${c.via}` : ''}</span>}
            <span className={`fi-chip fi-card__exp${c.daysLeft != null && c.daysLeft <= 14 ? ' fi-card__exp--soon' : ''}`}>
              <CalendarClock size={10} /> {c.daysLeft != null && c.daysLeft <= 14 ? `${c.daysLeft}d left` : `to ${dt(c.validTo)}`}
            </span>
          </div>
          <div className="fi-card__rows">
            {c.rows.map((r) => (
              <div key={r.k} className="fi-card__row">
                <span className="fi-card__k">{r.k}</span>
                <span>{money(r.buy, c.currency)}</span>
                <span className="fi-card__arrow">→</span>
                <span className="fi-card__sell">{r.sell != null ? money(r.sell, c.currency) : 'markup'}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {rs.expired.map((c, i) => (
        <div key={`x${i}`} className="fi-card fi-card--expired" style={{ animationDelay: `${0.2 + i * 0.06}s` }}>
          <div className="fi-card__head">
            <FileWarning size={13} color="#8a94a6" />
            <span className="fi-card__name">{c.carrier}</span>
            <span className="fi-chip fi-card__exp">expired {dt(c.validTo)}</span>
          </div>
          <div className="fi-card__rows">
            {c.rows.map((r) => (
              <div key={r.k} className="fi-card__row">
                <span className="fi-card__k">{r.k}</span><span>{money(r.buy, c.currency)}</span>
                <span className="fi-card__arrow">→</span><span>{money(r.sell, c.currency)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {rs.drafts > 0 && <div className="fi-muted" style={{ marginTop: 6 }}>{rs.drafts} draft card{rs.drafts === 1 ? '' : 's'} waiting to be validated.</div>}

      <div className="fi-locals">
        {([['Origin locals', rs.localOrigin], ['Destination locals', rs.localDest]] as const).map(([lbl, list]) => (
          <div key={lbl} className={`fi-local${list.length ? ' fi-local--on' : ''}`}>
            <MapPin size={12} />
            <div style={{ minWidth: 0 }}>
              <div className="fi-local__l">{lbl}</div>
              <div className="fi-local__t">{list.length ? list.map((s) => s.title).join(', ') : 'No sheet'}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
