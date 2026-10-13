import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/supabase'

/**
 * Per-user set of ids (stars, collapsed groups), saved to staff_ui_prefs as a comma list.
 * localStorage caches it so the board paints right on first load.
 */
export function useStaffIdSet(key: string): [Set<string>, (id: string) => void] {
  const cacheKey = `ubf.pref.${key}`
  const parse = (v: string | null | undefined) => new Set((v ?? '').split(',').filter(Boolean))

  const [ids, setIds] = useState<Set<string>>(() => {
    try { return parse(localStorage.getItem(cacheKey)) } catch { return new Set() }
  })

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data } = await supabase.from('staff_ui_prefs').select('value').eq('pref_key', key).maybeSingle()
      if (cancelled || data?.value == null) return
      setIds(parse(data.value))
      try { localStorage.setItem(cacheKey, data.value) } catch { /* ignore */ }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const toggle = useCallback((id: string) => {
    setIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      const value = [...next].join(',')
      try { localStorage.setItem(cacheKey, value) } catch { /* ignore */ }
      void (async () => {
        const { data: auth } = await supabase.auth.getUser()
        if (!auth.user?.id) return
        await supabase.from('staff_ui_prefs')
          .upsert({ user_id: auth.user.id, pref_key: key, value, updated_at: new Date().toISOString() })
      })()
      return next
    })
  }, [cacheKey, key])

  return [ids, toggle]
}
