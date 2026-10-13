import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/supabase'
import type { AirConsol, EaRow } from './eaTypes'

const REFRESH_MS = 60_000

/** EA bookings + open air consols. Polls every minute. */
export function useEaBoard() {
  const [rows, setRows] = useState<EaRow[]>([])
  const [consols, setConsols] = useState<AirConsol[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const today = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
    const [b, c] = await Promise.all([
      supabase.from('v_ea_bookings').select('*').order('priority', { ascending: false }),
      supabase
        .from('v_air_consols')
        .select('*')
        .gte('flight_date', today)
        .not('status', 'in', '(exported,departed,cancelled)')
        .order('flight_date'),
    ])
    if (b.error) setError(b.error.message)
    else {
      setError('')
      setRows((b.data ?? []) as EaRow[])
    }
    if (!c.error) setConsols((c.data ?? []) as AirConsol[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
    const t = window.setInterval(() => void load(), REFRESH_MS)
    return () => window.clearInterval(t)
  }, [load])

  return { rows, consols, loading, error, reload: load }
}

/** Allocate (or unallocate with null) bookings to a consol. Lock is enforced in the DB. */
export async function allocateBookings(ids: string[], consolId: string | null) {
  const { error } = await supabase.from('bookings').update({ consol_id: consolId }).in('id', ids)
  if (error) throw new Error(error.message)
}

export async function assignOwner(ids: string[], userId: string | null) {
  const { error } = await supabase.from('bookings').update({ handled_by: userId }).in('id', ids)
  if (error) throw new Error(error.message)
}

export type NewConsol = {
  destination: string
  airline: string | null
  flight_no: string
  flight_date: string
  cutoff_at: string | null
}

export async function planConsol(c: NewConsol) {
  const { data, error } = await supabase.from('air_consols').insert({ ...c, origin: 'AKL' }).select('id').single()
  if (error) throw new Error(error.message)
  return data.id as string
}
