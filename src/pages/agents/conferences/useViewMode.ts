import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../supabase'
import { getViewPref, setViewPref, type ViewMode } from './conferencesApi'

function deviceDefault(): ViewMode {
  return window.innerWidth < 768 ? 'mobile' : 'desktop'
}

export function useViewMode(): {
  viewMode: ViewMode
  setMode: (m: ViewMode) => void
  ready: boolean
} {
  const [viewMode, setViewMode] = useState<ViewMode>('desktop')
  const [ready, setReady] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id ?? null
      if (cancelled) return
      setUserId(uid)
      if (!uid) {
        setViewMode(deviceDefault())
        setReady(true)
        return
      }
      getViewPref(uid)
        .then((saved) => {
          if (cancelled) return
          setViewMode(saved ?? deviceDefault())
          setReady(true)
        })
        .catch(() => {
          if (!cancelled) {
            setViewMode(deviceDefault())
            setReady(true)
          }
        })
    })
    return () => {
      cancelled = true
    }
  }, [])

  const setMode = useCallback(
    (m: ViewMode) => {
      setViewMode(m)
      if (userId) setViewPref(userId, m).catch(() => {})
    },
    [userId],
  )

  return { viewMode, setMode, ready }
}
