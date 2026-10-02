import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchCurrentOption, fetchLaneIntel, type IntelOption, type IntelQuery, type LaneIntel } from './laneIntelApi'
import {
  fetchCredit, fetchQuoteFacts, fetchRateSummary, fetchSailings,
  type Credit, type QuoteFacts, type RateSummary, type Sailings,
} from './factsApi'

type Kind = 'fcl' | 'lcl' | 'air'

/** Loads lane intel on mount (debounced) so the launcher badge is live before the drawer opens. */
export function useLaneIntel(q: IntelQuery | null, quoteId: string | null, open: boolean, kind: Kind | null) {
  const [otherRates, setOtherRates] = useState<RateSummary | null>(null)
  const [sailings, setSailings] = useState<Sailings | null>(null)
  const [credit, setCredit] = useState<Credit | null>(null)
  const [intel, setIntel] = useState<LaneIntel | null>(null)
  const [rates, setRates] = useState<RateSummary | null>(null)
  const [option, setOption] = useState<IntelOption | null>(null)
  const [facts, setFacts] = useState<QuoteFacts | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const req = useRef(0)
  const key = q ? JSON.stringify(q) : ''

  // Option lines + saved quote fields. Polled while open so checks follow edits.
  const loadQuote = useCallback(async () => {
    if (!quoteId) { setOption(null); setFacts(null); return }
    try {
      const [o, f] = await Promise.all([fetchCurrentOption(quoteId), fetchQuoteFacts(quoteId)])
      setOption(o); setFacts(f)
    } catch { /* keep last */ }
  }, [quoteId])

  const load = useCallback(async () => {
    if (!q) { setIntel(null); setRates(null); return }
    const id = ++req.current
    setLoading(true); setError('')
    const ratesP = kind ? fetchRateSummary(q.from, q.to, kind).catch(() => null) : Promise.resolve(null)
    // Side data never blocks the panel: each one fails quietly to null.
    const other: Kind | null = kind === 'fcl' ? 'lcl' : kind === 'lcl' ? 'fcl' : null
    void Promise.all([
      other ? fetchRateSummary(q.from, q.to, other).catch(() => null) : Promise.resolve(null),
      q.mode === 'sea' ? fetchSailings(q.from, q.to, 'sea').catch(() => null) : Promise.resolve(null),
      q.customerId ? fetchCredit(q.customerId).catch(() => null) : Promise.resolve(null),
    ]).then(([o, s, c]) => { if (id === req.current) { setOtherRates(o); setSailings(s); setCredit(c) } })
    try {
      const [i, r] = await Promise.all([fetchLaneIntel(q), ratesP, loadQuote()])
      if (id === req.current) { setIntel(i); setRates(r) }
    } catch (e) {
      if (id === req.current) {
        setIntel(null); setRates(await ratesP)
        setError((e as { message?: string })?.message || 'Could not load lane data')
      }
    } finally {
      if (id === req.current) setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, kind, loadQuote])

  useEffect(() => {
    const t = window.setTimeout(() => { void load() }, 500)
    return () => window.clearTimeout(t)
  }, [load])

  useEffect(() => {
    if (!open || !quoteId) return
    void loadQuote()
    const t = window.setInterval(() => { void loadQuote() }, 12000)
    const onFocus = () => { void loadQuote() }
    window.addEventListener('focus', onFocus)
    return () => { window.clearInterval(t); window.removeEventListener('focus', onFocus) }
  }, [open, quoteId, loadQuote])

  return { intel, rates, otherRates, sailings, credit, option, facts, loading, error, reload: load, reloadOption: loadQuote }
}

export const nzd = (n: number) => `$${Math.round(n).toLocaleString()}`
export const pct1 = (n: number) => `${n.toFixed(1)}%`
