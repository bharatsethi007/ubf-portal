import { ArrowRight, CalendarClock, Clock, MessageSquareQuote, Plane, Route, Ship } from 'lucide-react'
import { BREAKS, estimateTotal, money, type RateOption } from './ratesApi'

type Props = {
  o: RateOption
  cheapest: boolean
  fastest: boolean
  input: { kg: number; cbm: number; boxes: number }
  onBook: (o: RateOption) => void
  onQuote: (o: RateOption) => void
  delay: number
}

const fmtDate = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' }) : null)

/** One sell-side rate: price, service facts, and the two actions. */
export default function RateCard({ o, cheapest, fastest, input, onBook, onQuote, delay }: Props) {
  const total = estimateTotal(o, input)
  const priced = o.sell != null
  const air = o.product === 'AIR'
  return (
    <article className={`pv3-card pv3-rate pv3-rise${priced ? '' : ' pv3-rate--ask'}`} style={{ animationDelay: `${delay}s` }}>
      <div className="pv3-rate__main">
        <div className="pv3-rate__carrier">
          <span className="pv3-rate__ico">{air ? <Plane size={16} /> : <Ship size={16} />}</span>
          <div>
            <b>{o.carrier ?? 'Carrier'}</b>
            <span>{o.product === 'FCL' ? `Full container · ${o.container_type}` : o.product === 'LCL' ? 'Shared container (LCL)' : 'Air freight'}</span>
          </div>
          <div className="pv3-rate__tags">
            {cheapest && priced && <span className="pv3-tag pv3-tag--green">Best price</span>}
            {fastest && <span className="pv3-tag pv3-tag--blue">Fastest</span>}
          </div>
        </div>
        <ul className="pv3-rate__facts">
          <li><Clock size={14} />{o.transit_days ? `${o.transit_days} days port to port` : 'Transit on request'}</li>
          <li><Route size={14} />{o.via ? `Via ${o.via}` : 'Direct or best routing'}</li>
          {o.frequency && <li><CalendarClock size={14} />{o.frequency}</li>}
          {o.valid_to && <li><CalendarClock size={14} />Valid to {fmtDate(o.valid_to)}</li>}
        </ul>
        {air && priced && o.breaks && (
          <div className="pv3-rate__breaks" aria-label="Price per kg by weight">
            {BREAKS.filter((b) => o.breaks?.[b.k] != null).map((b) => (
              <span key={b.k}><i>{b.label}</i>{money(o.breaks![b.k], o.currency)}</span>
            ))}
          </div>
        )}
        {priced && o.extras.length > 0 && (
          <div className="pv3-rate__extras">
            Plus {o.extras.map((x) => `${x.label} ${money(x.amount, x.currency)}${x.basis ? ` ${x.basis.replace(/_/g, ' ')}` : ''}`).join(' · ')}
          </div>
        )}
      </div>
      <div className="pv3-rate__price">
        {priced ? (
          <>
            <span className="pv3-rate__amount">{money(o.sell, o.currency)}</span>
            <span className="pv3-rate__unit">{o.unit}{o.sell_min ? ` · min ${money(o.sell_min, o.currency)}` : ''}</span>
            {total != null && <span className="pv3-rate__total">About {money(Math.round(total), o.currency)} for your cargo</span>}
            <button type="button" className="pv3-btn pv3-btn--primary" onClick={() => onBook(o)}>Book this rate <ArrowRight size={14} /></button>
          </>
        ) : (
          <>
            <span className="pv3-rate__amount pv3-rate__amount--ask">Price on request</span>
            <span className="pv3-rate__unit">We run this lane. Ask and we reply within one business day.</span>
            <button type="button" className="pv3-btn pv3-btn--ghost" onClick={() => onQuote(o)}><MessageSquareQuote size={14} /> Get a price</button>
          </>
        )}
      </div>
    </article>
  )
}
