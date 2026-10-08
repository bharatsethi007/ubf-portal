import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/supabase'

/**
 * Per-user UI preference, saved to staff_ui_prefs (follows the user across devices).
 * localStorage is only a fast cache so the saved value shows on first paint.
 */
export function useStaffPref<T extends string>(
  key: string,
  fallback: T,
  allowed: readonly T[],
): [T, (next: T) => void] {
  const cacheKey = `ubf.pref.${key}`

  const [value, setValue] = useState<T>(() => {
    try {
      const cached = localStorage.getItem(cacheKey)
      if (cached && (allowed as readonly string[]).includes(cached)) return cached as T
    } catch {
      /* ignore */
    }
    return fallback
  })

  // Keep every hook using the same key in step (e.g. the user menu and the page it changes).
  useEffect(() => {
    const onChange = (e: Event) => {
      const d = (e as CustomEvent<{ key: string; value: string }>).detail
      if (d?.key === key && (allowed as readonly string[]).includes(d.value)) setValue(d.value as T)
    }
    window.addEventListener('ubf-pref-change', onChange)
    return () => window.removeEventListener('ubf-pref-change', onChange)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from('staff_ui_prefs')
        .select('value')
        .eq('pref_key', key)
        .maybeSingle()
      const stored = data?.value
      if (cancelled || !stored || !(allowed as readonly string[]).includes(stored)) return
      setValue(stored as T)
      try {
        localStorage.setItem(cacheKey, stored)
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const update = useCallback(
    (next: T) => {
      setValue(next)
      try {
        localStorage.setItem(cacheKey, next)
      } catch {
        /* ignore */
      }
      window.dispatchEvent(new CustomEvent('ubf-pref-change', { detail: { key, value: next } }))
      void (async () => {
        const { data: auth } = await supabase.auth.getUser()
        const userId = auth.user?.id
        if (!userId) return
        await supabase
          .from('staff_ui_prefs')
          .upsert({ user_id: userId, pref_key: key, value: next, updated_at: new Date().toISOString() })
      })()
    },
    [cacheKey, key],
  )

  return [value, update]
}
