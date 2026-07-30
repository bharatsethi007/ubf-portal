import { useCallback, useEffect, useState } from 'react'
import { fetchEffectiveRates } from '../pages/setup/fxRatesApi'

export function useEffectiveRates(base: string): {
  rates: Map<string, { buy: number; sell: number }>
  loading: boolean
  reload: () => void
} {
  const [rates, setRates] = useState<Map<string, { buy: number; sell: number }>>(new Map())
  const [loading, setLoading] = useState(!!base)

  const load = useCallback(async () => {
    if (!base) {
      setRates(new Map())
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      setRates(await fetchEffectiveRates(base))
    } catch {
      setRates(new Map())
    } finally {
      setLoading(false)
    }
  }, [base])

  useEffect(() => {
    void load()
  }, [load])

  const reload = useCallback(() => {
    void load()
  }, [load])

  return { rates, loading, reload }
}
