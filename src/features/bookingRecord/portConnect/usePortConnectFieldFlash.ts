import { useCallback, useEffect, useState } from 'react'
import type { PortConnectFieldKey } from './portConnectProvenance'

const FLASH_MS = 2000

export function usePortConnectFieldFlash() {
  const [flashing, setFlashing] = useState<Set<PortConnectFieldKey>>(() => new Set())

  const flashFields = useCallback((keys: PortConnectFieldKey[]) => {
    if (!keys.length) return
    setFlashing(new Set(keys))
  }, [])

  useEffect(() => {
    if (!flashing.size) return
    const timer = window.setTimeout(() => setFlashing(new Set()), FLASH_MS)
    return () => window.clearTimeout(timer)
  }, [flashing])

  const isFlashing = useCallback(
    (key: PortConnectFieldKey) => flashing.has(key),
    [flashing],
  )

  return { flashFields, isFlashing }
}
