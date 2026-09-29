import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, FileText, Plane, Ship } from 'lucide-react'
import { usePorts } from '../../../../hooks/usePorts'
import { fmtDay, placeName, shortCode, titleCase } from '../homeModel'
import { money } from './ratesApi'
import QuoteOfferDetail from './QuoteOfferDetail'
import { daysLeft, listOffers, STATUS_LABEL, STATUS_TONE, type QuoteOffer } from './quotesApi'
import './quotes.css'

type Filter = 'pending' | 'approved' | 'rejected' | 'all'
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'pending', label: 'Awaiting you' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
]

type Props = { focusId: string | null; onCount: (n: number) => void }

/** Quotes UBF priced for this account: review, approve or reject. */
export default function PortalQuotesTab({ focusId, onCount }: Props) {
  const { ports } = usePorts()
  const [rows, setRows] = useState<QuoteOffer[] | null>(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<Filter | null>(null)
  const [open, setOpen] = useState<string | null>(focusId)
  const [flash, setFlash] = useState('')

  const load = useCallback(() => {
    listOffers()
      .then((r) => { setRows(r); onCount(r.filter((x) => x.portal_status === 'pending').length) })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load your quotes'))
  }, [onCount])
  useEffect(load, [load])

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { pending: 0, approved: 0, rejected: 0, all: rows?.length ?? 0 }
    for (const r of rows ?? []) if (r.portal_status in c) c[r.portal_status as Filter]++
    return c
  }, [rows])

  const focused = rows?.find((r) => r.id === focusId)
  const active: Filter = filter ?? (focused ? (focused.portal_status in counts ? (focused.portal_status as Filter) : 'all') : counts.pending ? 'pending' : 'all')
  const shown = (rows ?? []).filter((r) => active === 'all' || r.portal_status === active)

  function answered(o: QuoteOffer) {
    setFlash(`Thanks. We've let the team know about ${o.response_no ?? o.quote_no}.`)
    setFilter('all')
    load()
  }

  return (
    <>
      {error && <div className="pv3-error">{error}</div>}
      {flash && <div className="pv3-qflash pv3-rise" role="status">{flash}</div>}

      <div className="pv3-tabs" role="tablist" aria-label="Quote status">
        {FILTERS.map((x) => (
          <button key={x.key} type="button" role="tab" aria-selected={active === x.key}
            className={`pv3-tabs__btn${active === x.key ? ' pv3-tabs__btn--on' : ''}`} onClick={() => setFilter(x.key)}>
            {x.label}{counts[x.key] > 0 && <span className="pv3-tabs__n">{counts[x.key]}</span>}
          </button>
        ))}
      </div>

      <div className="pv3-qlist">
        {rows === null && !error && [0, 1].map((i) => <div key={i} className="pv3-card pv3-qcard"><span className="pv3-skel" /></div>)}
        {rows && shown.length === 0 && (
          <div className="pv3-card pv3-rempty pv3-rise">
            <FileText size={28} />
            <div>
              <b>{rows.length === 0 ? 'No quotes yet.' : 'Nothing here.'}</b>
              <p>{rows.length === 0 ? 'When our team prices a quote for you, it shows up here to review and approve.' : 'Pick another status to see more quotes.'}</p>
            </div>
          </div>
        )}
        {shown.map((o, i) => {
          const isOpen = open === o.id
          const air = o.shipment_mode === 'air'
          const left = daysLeft(o.valid_till)
          const cargo = o.containers ?? titleCase(o.goods).slice(0, 40)
          return (
            <article key={o.id} className={`pv3-card pv3-qcard pv3-rise${isOpen ? ' pv3-qcard--open' : ''}`} style={{ animationDelay: `${0.03 * i}s` }}>
              <button type="button" className="pv3-qcard__row" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : o.id)}>
                <span className="pv3-qcard__id">
                  <span className="pv3-mono pv3-strong">{o.response_no ?? o.quote_no}</span>
                  <span className="pv3-cell-sub">Sent {fmtDay(o.sent_at)}</span>
                </span>
                <span className="pv3-qcard__route">
                  <span className="pv3-mode">{air ? <Plane size={14} /> : <Ship size={14} />}<span className="pv3-mono">{shortCode(o.from_port_code)} → {shortCode(o.to_port_code)}</span></span>
                  <span className="pv3-cell-sub">{placeName(o.from_port_code, ports)} to {placeName(o.to_port_code, ports)}{cargo ? ` · ${cargo}` : ''}</span>
                </span>
                <span className="pv3-qcard__valid">
                  {o.portal_status === 'pending' && left != null
                    ? <span className={left <= 3 ? 'pv3-tag pv3-tag--amber' : 'pv3-muted'}>{left <= 0 ? 'Expires today' : `${left} day${left === 1 ? '' : 's'} left`}</span>
                    : o.decided_at ? <span className="pv3-muted">{STATUS_LABEL[o.portal_status]} {fmtDay(o.decided_at)}</span>
                    : o.valid_till ? <span className="pv3-muted">Valid to {fmtDay(o.valid_till)}</span> : null}
                </span>
                <span className="pv3-qcard__price">
                  <span className="pv3-qcard__amount">{money(o.total_sell, o.currency ?? 'NZD')}</span>
                  <span className={`pv3-pill pv3-pill--${STATUS_TONE[o.portal_status]}`}>{STATUS_LABEL[o.portal_status]}</span>
                </span>
                <ChevronDown size={16} className={`pv3-chev${isOpen ? ' pv3-chev--open' : ''}`} />
              </button>
              {isOpen && <QuoteOfferDetail o={o} onAnswered={() => answered(o)} />}
            </article>
          )
        })}
      </div>
    </>
  )
}
