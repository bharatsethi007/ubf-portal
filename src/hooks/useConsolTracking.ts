import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabase'

export type ConsolTrackingInfo = {
  enabled: boolean
  last_polled_at: string | null
  last_status: string | null
}

const SELECT = 'consol_key, enabled, last_polled_at, last_status'

export function useConsolTracking(consolKeys: string[]) {
  const keysKey = consolKeys.join('|')
  const [map, setMap] = useState<Record<string, ConsolTrackingInfo>>({})
  const [loading, setLoading] = useState(false)
  const [version, setVersion] = useState(0)
  const refetch = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    if (!consolKeys.length) {
      setMap({})
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    ;(async () => {
      const { data, error } = await supabase
        .from('consol_tracking')
        .select(SELECT)
        .in('consol_key', consolKeys)

      if (cancelled) return

      if (error) {
        setMap({})
      } else {
        const next: Record<string, ConsolTrackingInfo> = {}
        for (const row of data ?? []) {
          next[row.consol_key as string] = {
            enabled: Boolean(row.enabled),
            last_polled_at: (row.last_polled_at as string | null) ?? null,
            last_status: (row.last_status as string | null) ?? null,
          }
        }
        setMap(next)
      }
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [keysKey, version])

  return { map, loading, refetch }
}

export async function toggleTracking(consolKey: string, module: string, enabled: boolean): Promise<void> {
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr) throw new Error(authErr.message)
  if (!auth.user) throw new Error('Not authenticated')

  const { error } = await supabase.from('consol_tracking').upsert(
    {
      consol_key: consolKey,
      module,
      enabled,
      enabled_by: auth.user.id,
      enabled_at: enabled ? new Date().toISOString() : null,
    },
    { onConflict: 'consol_key' },
  )

  if (error) throw new Error(error.message)
}
