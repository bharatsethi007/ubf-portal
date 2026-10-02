import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchCurrentOption, fetchLaneIntel, type IntelOption, type IntelQuery, type LaneIntel } from './laneIntelApi'

/** Loads lane intel on mount (debounced) so the launcher badge is live before the drawer opens. */
export function useLaneIntel(q: IntelQuery | null, quoteId: string | null, open: boolean) {
  const [intel, setIntel] = useState<LaneIntel | null>(null)
  const [option, setOption] = useState<IntelOption | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const req = useRef(0)
  const key = q ? JSON.stringify(q) : ''

  const loadOption = useCallback(async () => {
    if (!quoteId) { setOption(null); return }
    try { setOption(await fetchCurrentOption(quoteId)) } catch { /* keep last */ }
  }, [quoteId])

  const load = useCallback(async () => {
    if (!q) { setIntel(null); return }
    const id = ++req.current
    setLoading(true); setError('')
    try {
      const [i] = await Promise.all([fetchLaneIntel(q), loadOption()])
      if (id === req.current) setIntel(i)
    } catch (e) {
      if (id === req.current) { setIntel(null); setError(e instanceof Error ? e.message : 'Could not load lane data') }
    } finally {
      if (id === req.current) setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, loadOption])

  useEffect(() => {
    const t = window.setTimeout(() => { void load() }, 500)
    return () => window.clearTimeout(t)
  }, [load])

  // While open, keep the option's lines fresh as staff edit the responses editor.
  useEffect(() => {
    if (!open || !quoteId) return
    void loadOption()
    const t = window.setInterval(() => { void loadOption() }, 12000)
    const onFocus = () => { void loadOption() }
    window.addEventListener('focus', onFocus)
    return () => { window.clearInterval(t); window.removeEventListener('focus', onFocus) }
  }, [open, quoteId, loadOption])

  return { intel, option, loading, error, reload: load, reloadOption: loadOption }
}

export const nzd = (n: number) => `$${Math.round(n).toLocaleString()}`
export const pct1 = (n: number) => `${n.toFixed(1)}%`
