import { useEffect, useState } from 'react'
import { fetchAirFlightRoutes, type AirFlightRoute } from './airFlightRoutesApi'

export function useAirFlightSuggestions(
  origin: string,
  destination: string,
  enabled: boolean,
) {
  const [suggestions, setSuggestions] = useState<AirFlightRoute[]>([])

  const originKey = origin.trim().toUpperCase()
  const destKey = destination.trim().toUpperCase()
  const ready = enabled && Boolean(originKey && destKey)

  useEffect(() => {
    if (!ready) {
      setSuggestions([])
      return
    }

    let cancelled = false
    fetchAirFlightRoutes(originKey, destKey)
      .then((rows) => { if (!cancelled) setSuggestions(rows) })
      .catch((err) => {
        if (!cancelled) {
          console.error('[useAirFlightSuggestions] fetch failed', err)
          setSuggestions([])
        }
      })

    return () => { cancelled = true }
  }, [originKey, destKey, ready])

  return { suggestions, ready }
}
