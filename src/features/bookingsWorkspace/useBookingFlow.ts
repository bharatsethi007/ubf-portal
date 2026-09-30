import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/supabase'
import type { BookingModule } from '@/types/booking'

export type FlowUrgency = 'none' | 'ok' | 'soon' | 'today' | 'overdue' | 'blocked'
export type FlowStage =
  | 'request' | 'booked' | 'in_transit' | 'arrived' | 'invoicing' | 'closed' | 'declined'

/** One row of v_booking_flow: the deterministic next-action engine. */
export type BookingFlow = {
  booking_id: string
  module: BookingModule
  stage: FlowStage
  next_action: string | null
  action_due: string | null
  urgency: FlowUrgency
  priority: number
  handled_by: string | null
  open_tasks: number
  eta: string | null
  etd: string | null
  departed: string | null
  arrived: string | null
  last_free_day: string | null
  delivered: string | null
  cartage_booked: boolean
  tms_id: string | null
  tms_no: string | null
  tms_status: string | null
  quote_id: string | null
  quote_no: string | null
  shipment_id: number | null
  erp_job: string | null
}

const REFRESH_MS = 60_000

/** Flow rows for one module, keyed by booking id. Re-polls every minute and on `refreshKey` change. */
export function useBookingFlow(module: BookingModule, refreshKey: unknown) {
  const [flow, setFlow] = useState<Map<string, BookingFlow>>(new Map())

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('v_booking_flow').select('*').eq('module', module)
    if (error) return
    const next = new Map<string, BookingFlow>()
    for (const row of (data ?? []) as BookingFlow[]) next.set(row.booking_id, row)
    setFlow(next)
  }, [module])

  useEffect(() => {
    void load()
    const t = window.setInterval(() => void load(), REFRESH_MS)
    return () => window.clearInterval(t)
  }, [load, refreshKey])

  return { flow, reloadFlow: load }
}
