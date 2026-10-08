import { useState } from 'react'
import { transitLabel } from '../../../../lib/transitLabel'
import { ChevronDown, Clock, Plane, Ship } from 'lucide-react'
import { fmtDay, placeName, shortCode, titleCase } from '../homeModel'
import { money } from './ratesApi'
import QuoteOfferDetail from './QuoteOfferDetail'
import { daysLeft, STATUS_LABEL, STATUS_TONE, type QuoteGroup } from './quotesApi'

type Props = {
  g: QuoteGroup
  ports: Parameters<typeof placeName>[1]
  isOpen: boolean
  focusId: string | null
  delay: number
  onToggle: () => void
  onAnswered: () => void
}

/** One quote: header row, then its options side by side with the charges for the picked one. */
export default function QuoteGroupCard({ g, ports, isOpen, focusId, delay, onToggle, onAnswered }: Props) {
  const o = g.first
  const pending = g.options.filter((x) => x.portal_status === 'pending')
  const initial = g.options.find((x) => x.portal_status === 'approved')?.id
    ?? g.options.find((x) => x.id === focusId)?.id ?? (pending[0] ?? g.options[0]).id
  const [pick, setPick] = useState(initial)
  const picked = g.options.find((x) => x.id === pick) ?? g.options[0]
  const air = o.shipment_mode === 'air'
  const cargo = o.containers ?? titleCase(o.goods).slice(0, 40)
  const tills = pending.map((x) => daysLeft(x.valid_till)).filter((n): n is number => n != null)
  const left = tills.length ? Math.min(...tills) : null
  const many = g.options.length > 1
  const decided = g.options.find((x) => x.decided_at)?.decided_at

  return (
    <article className={`pv3-card pv3-qcard pv3-rise${isOpen ? ' pv3-qcard--open' : ''}`} style={{ animationDelay: `${delay}s` }}>
      <button type="button" className="pv3-qcard__row" aria-expanded={isOpen} onClick={onToggle}>
        <span className="pv3-qcard__id">
          <span className="pv3-mono pv3-strong">{g.quote_no}</span>
          <span className="pv3-cell-sub">Sent {fmtDay(g.sent_at)}</span>
        </span>
        <span className="pv3-qcard__route">
          <span className="pv3-mode">{air ? <Plane size={14} /> : <Ship size={14} />}<span className="pv3-mono">{shortCode(o.from_port_code)} → {shortCode(o.to_port_code)}</span></span>
          <span className="pv3-cell-sub">{placeName(o.from_port_code, ports)} to {placeName(o.to_port_code, ports)}{cargo ? ` · ${cargo}` : ''}</span>
        </span>
        <span className="pv3-qcard__valid">
          {g.status === 'pending' && left != null
            ? <span className={left <= 3 ? 'pv3-tag pv3-tag--amber' : 'pv3-muted'}>{left <= 0 ? 'Expires today' : `${left} day${left === 1 ? '' : 's'} left`}</span>
            : decided ? <span className="pv3-muted">{STATUS_LABEL[g.status]} {fmtDay(decided)}</span> : null}
        </span>
        <span className="pv3-qcard__price">
          <span className="pv3-qcard__amount">
            {many && g.status === 'pending' && <small>from </small>}
            {money(g.status === 'approved' ? g.options.find((x) => x.portal_status === 'approved')?.total_sell : g.cheapest, g.currency)}
          </span>
          <span className="pv3-qcard__sub">
            {many && <span className="pv3-muted">{g.options.length} options</span>}
            <span className={`pv3-pill pv3-pill--${STATUS_TONE[g.status]}`}>{STATUS_LABEL[g.status]}</span>
          </span>
        </span>
        <ChevronDown size={16} className={`pv3-chev${isOpen ? ' pv3-chev--open' : ''}`} />
      </button>

      {isOpen && many && (
        <div className="pv3-qopts" role="radiogroup" aria-label="Options">
          {g.options.map((x, i) => (
            <button key={x.id} type="button" role="radio" aria-checked={x.id === picked.id}
              className={`pv3-qopt${x.id === picked.id ? ' pv3-qopt--on' : ''}${x.portal_status === 'crosswin' || x.portal_status === 'withdrawn' ? ' pv3-qopt--dim' : ''}`}
              onClick={() => setPick(x.id)}>
              <span className="pv3-qopt__top">
                <span>Option {i + 1}</span>
                {x.portal_status !== 'pending'
                  ? <span className={`pv3-pill pv3-pill--${STATUS_TONE[x.portal_status]}`}>{STATUS_LABEL[x.portal_status]}</span>
                  : i === 0 && <span className="pv3-tag pv3-tag--blue">Best price</span>}
              </span>
              <b>{x.carrier ?? 'Carrier to confirm'}</b>
              <span className="pv3-qopt__meta">
                <Clock size={12} />{x.transit_time || x.transit_time_days ? transitLabel(x.transit_time ?? x.transit_time_days) : 'Transit on request'}{x.via_port ? ` · via ${x.via_port}` : ''}
              </span>
              <span className="pv3-qopt__price">{money(x.total_sell, x.currency ?? g.currency)}</span>
            </button>
          ))}
        </div>
      )}
      {isOpen && <QuoteOfferDetail key={picked.id} o={picked} open={pending.length} onAnswered={onAnswered} />}
    </article>
  )
}
