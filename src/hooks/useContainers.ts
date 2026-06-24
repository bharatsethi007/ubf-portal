import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import type { Container } from '../types/container'

export function useContainers(consolKey: string | null) {
  const [containers, setContainers] = useState<Container[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!consolKey) {
      setContainers([])
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    ;(async () => {
      const { data, error } = await supabase
        .from('containers')
        .select('c_number, seal, avail_from, avail_to')
        .eq('consol_key', consolKey)
        .order('c_number')

      if (cancelled) return

      if (error) {
        setContainers([])
      } else {
        setContainers((data as Container[]) ?? [])
      }
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [consolKey])

  return { containers, loading }
}
