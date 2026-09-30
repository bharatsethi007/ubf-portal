import { useEffect, useState } from 'react'
import { supabase } from '@/supabase'
import type { BookingModule } from '@/types/booking'

export type ModeCount = { open: number; overdue: number }
export type ModeCounts = Partial<Record<BookingModule, ModeCount>>

type FlowRow = { module: BookingModule; urgency: string }

const REFRESH_MS = 60_000

/** Open (not closed/declined) and overdue/blocked counts per module, from v_booking_flow. */
export function useBookingModeCounts(): ModeCounts {
  const [counts, setCounts] = useState<ModeCounts>({})

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data, error } = await supabase
        .from('v_booking_flow')
        .select('module, urgency')
        .not('stage', 'in', '(closed,declined)')
      if (cancelled || error) return
      const next: ModeCounts = {}
      for (const row of (data ?? []) as FlowRow[]) {
        const c = next[row.module] ?? { open: 0, overdue: 0 }
        c.open += 1
        if (row.urgency === 'overdue' || row.urgency === 'blocked') c.overdue += 1
        next[row.module] = c
      }
      setCounts(next)
    }

    void load()
    const timer = window.setInterval(() => void load(), REFRESH_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  return counts
}
