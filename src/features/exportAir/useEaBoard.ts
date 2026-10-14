import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/supabase'
import type { AirConsol, EaRow } from './eaTypes'

const REFRESH_MS = 60_000

/** EA bookings + live air consols (not departed or cancelled, flight within the last 3 days or later). */
export function useEaBoard() {
  const [rows, setRows] = useState<EaRow[]>([])
  const [consols, setConsols] = useState<AirConsol[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const since = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10)
    const [b, c] = await Promise.all([
      supabase.from('v_ea_bookings').select('*').order('priority', { ascending: false }),
      supabase
        .from('v_air_consols')
        .select('*')
        .gte('flight_date', since)
        .not('status', 'in', '(departed,cancelled)')
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

export type ConsolInput = {
  destination: string
  airline: string | null
  flight_no: string
  flight_date: string
  cutoff_at: string | null
  mawb: string | null
  transit_port: string | null
  flight2_no: string | null
  flight2_date: string | null
  eta_date: string | null
  handled_by: string | null
  notes: string | null
  status: 'planned' | 'confirmed'
}

/** Create (id null) or update a consol. Returns its id. */
export async function saveConsol(id: string | null, c: ConsolInput) {
  if (id) {
    const { error } = await supabase.from('air_consols').update(c).eq('id', id)
    if (error) throw new Error(error.message)
    return id
  }
  const { data, error } = await supabase.from('air_consols').insert({ ...c, origin: 'AKL' }).select('id').single()
  if (error) throw new Error(error.message)
  return data.id as string
}

/** The consol owner; HAWBs no longer carry their own. */
export async function setConsolOwner(consolId: string, userId: string | null) {
  const { error } = await supabase.from('air_consols').update({ handled_by: userId }).eq('id', consolId)
  if (error) throw new Error(error.message)
}
