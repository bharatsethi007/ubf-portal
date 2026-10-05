import { useCallback, useEffect, useState } from 'react'
import { fetchEffectiveRates } from '../pages/setup/fxRatesApi'

export function useEffectiveRates(base: string): {
  rates: Map<string, { buy: number; sell: number }>
  loading: boolean
  /** Base currency the current `rates` belong to (lags `base` until loaded). */
  base: string
  reload: () => void
} {
  const [rates, setRates] = useState<Map<string, { buy: number; sell: number }>>(new Map())
  const [loading, setLoading] = useState(!!base)
  const [loadedBase, setLoadedBase] = useState('')

  const load = useCallback(async () => {
    if (!base) {
      setRates(new Map())
      setLoadedBase('')
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      setRates(await fetchEffectiveRates(base))
    } catch {
      setRates(new Map())
    } finally {
      setLoadedBase(base)
      setLoading(false)
    }
  }, [base])

  useEffect(() => {
    void load()
  }, [load])

  const reload = useCallback(() => {
    void load()
  }, [load])

  return { rates, loading, base: loadedBase, reload }
}
