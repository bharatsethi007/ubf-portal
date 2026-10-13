import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/supabase'
import type { AirConsol, EaRow } from './eaTypes'

/** One consol, its allocated houses, and open bookings on the same lane that could join it. */
export function useEaConsol(id: string | undefined) {
  const [consol, setConsol] = useState<AirConsol | null>(null)
  const [houses, setHouses] = useState<EaRow[]>([])
  const [candidates, setCandidates] = useState<EaRow[]>([])
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    const c = await supabase.from('v_air_consols').select('*').eq('id', id).maybeSingle()
    if (c.error || !c.data) { setError(c.error?.message ?? 'Consol not found'); return }
    const con = c.data as AirConsol
    setConsol(con)
    const [h, cand] = await Promise.all([
      supabase.from('v_ea_bookings').select('*').eq('consol_id', id).order('booking_ref'),
      supabase.from('v_ea_bookings').select('*').is('consol_id', null)
        .eq('destination', con.destination).gte('stage', 0).order('stage', { ascending: false }),
    ])
    setHouses((h.data ?? []) as EaRow[])
    setCandidates((cand.data ?? []) as EaRow[])
  }, [id])

  useEffect(() => { void load() }, [load])

  return { consol, houses, candidates, error, reload: load }
}

export async function patchConsol(id: string, patch: Record<string, unknown>) {
  const { error } = await supabase.from('air_consols').update(patch).eq('id', id)
  if (error) throw new Error(error.message)
}
