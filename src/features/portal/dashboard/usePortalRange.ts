import { useCallback, useState } from 'react'
import type { PortalRange } from './portalFormat'

const STORAGE_KEY = 'portal-dashboard-range'

const VALID_RANGES: PortalRange[] = ['year', 'month', 'week', 'today', 'custom']

function readStoredRange(fallback: PortalRange): PortalRange {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && VALID_RANGES.includes(stored as PortalRange)) {
      return stored as PortalRange
    }
  } catch {
    /* private mode / blocked storage */
  }
  return fallback
}

/** Persists dashboard date-range selection in localStorage (survives refresh + navigation). */
export function usePortalRange(fallback: PortalRange = 'week') {
  const [range, setRangeState] = useState<PortalRange>(() => readStoredRange(fallback))

  const setRange = useCallback((next: PortalRange) => {
    setRangeState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
  }, [])

  return [range, setRange] as const
}
