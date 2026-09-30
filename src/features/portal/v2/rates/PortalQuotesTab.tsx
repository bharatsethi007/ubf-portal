import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileText } from 'lucide-react'
import { usePorts } from '../../../../hooks/usePorts'
import QuoteGroupCard from './QuoteGroupCard'
import { groupOffers, listOffers, type QuoteOffer } from './quotesApi'
import './quotes.css'

type Filter = 'pending' | 'approved' | 'rejected' | 'all'
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'pending', label: 'Awaiting you' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
]

type Props = { focusId: string | null; onCount: (n: number) => void }

/** Quotes UBF priced for this account, one card per quote with its options. */
export default function PortalQuotesTab({ focusId, onCount }: Props) {
  const { ports } = usePorts()
  const [rows, setRows] = useState<QuoteOffer[] | null>(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<Filter | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [flash, setFlash] = useState('')

  const groups = useMemo(() => groupOffers(rows ?? []), [rows])

  const load = useCallback(() => {
    listOffers()
      .then((r) => { setRows(r); onCount(groupOffers(r).filter((g) => g.status === 'pending').length) })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load your quotes'))
  }, [onCount])
  useEffect(load, [load])

  useEffect(() => {
    const g = focusId ? groups.find((x) => x.options.some((o) => o.id === focusId || o.quote_id === focusId)) : null
    if (g) setOpen((cur) => cur ?? g.quote_id)
  }, [focusId, groups])

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { pending: 0, approved: 0, rejected: 0, all: groups.length }
    for (const g of groups) if (g.status in c) c[g.status as Filter]++
    return c
  }, [groups])

  const focused = focusId ? groups.find((x) => x.options.some((o) => o.id === focusId || o.quote_id === focusId)) : undefined
  const active: Filter = filter ?? (focused ? (focused.status in counts ? (focused.status as Filter) : 'all') : counts.pending ? 'pending' : 'all')
  const shown = groups.filter((g) => active === 'all' || g.status === active)

  function answered(quoteNo: string) {
    setFlash(`Thanks. We've let the team know about ${quoteNo}.`)
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
              <b>{groups.length === 0 ? 'No quotes yet.' : 'Nothing here.'}</b>
              <p>{groups.length === 0 ? 'When our team prices a quote for you, it shows up here to review and approve.' : 'Pick another status to see more quotes.'}</p>
            </div>
          </div>
        )}
        {shown.map((g, i) => (
          <QuoteGroupCard key={g.quote_id} g={g} ports={ports} isOpen={open === g.quote_id} focusId={focusId} delay={0.03 * i}
            onToggle={() => setOpen(open === g.quote_id ? null : g.quote_id)} onAnswered={() => answered(g.quote_no)} />
        ))}
      </div>
    </>
  )
}
