import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

export type CustomerQuoteStats = { thisMonth: number; converted: number; total: number }

const ZERO: CustomerQuoteStats = { thisMonth: 0, converted: 0, total: 0 }

export function useCustomerQuoteStats(accountId: string | null | undefined) {
  const [stats, setStats] = useState<CustomerQuoteStats>(ZERO)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!accountId) { setStats(ZERO); return }
    let cancelled = false
    setLoading(true)
    ;(async () => {
      const { data, error } = await supabase
        .from('quotes')
        .select('status, created_at')
        .eq('customer_account_id', accountId)
      if (cancelled) return
      if (error || !data) { setStats(ZERO); setLoading(false); return }

      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
      let thisMonth = 0
      let converted = 0
      for (const row of data) {
        const t = new Date(row.created_at as string).getTime()
        if (!Number.isNaN(t) && t >= monthStart) thisMonth += 1
        if (row.status === 'won' || row.status === 'crosswin') converted += 1
      }
      setStats({ thisMonth, converted, total: data.length })
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [accountId])

  return { stats, loading }
}
