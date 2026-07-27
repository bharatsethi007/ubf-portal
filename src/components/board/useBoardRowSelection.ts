import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

export type BoardHeaderCheckState = false | true | 'indeterminate'

export function useBoardRowSelection() {
  const location = useLocation()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const anchorIndexRef = useRef<number | null>(null)

  useEffect(() => {
    setSelectedIds(new Set())
    anchorIndexRef.current = null
  }, [location.pathname])

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds])

  const toggle = useCallback((
    id: string,
    index: number,
    visibleIds: string[],
    shiftKey: boolean,
  ) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (shiftKey && anchorIndexRef.current !== null) {
        const start = Math.min(anchorIndexRef.current, index)
        const end = Math.max(anchorIndexRef.current, index)
        for (let i = start; i <= end; i += 1) {
          next.add(visibleIds[i])
        }
      } else if (next.has(id)) {
        next.delete(id)
        anchorIndexRef.current = index
      } else {
        next.add(id)
        anchorIndexRef.current = index
      }
      return next
    })
  }, [])

  const selectAllVisible = useCallback((visibleIds: string[], checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) {
        visibleIds.forEach((rowId) => next.add(rowId))
      } else {
        visibleIds.forEach((rowId) => next.delete(rowId))
      }
      return next
    })
    anchorIndexRef.current = null
  }, [])

  const clear = useCallback(() => {
    setSelectedIds(new Set())
    anchorIndexRef.current = null
  }, [])

  const headerCheckState = useCallback((visibleIds: string[]): BoardHeaderCheckState => {
    if (!visibleIds.length) return false
    const selectedVisible = visibleIds.filter((id) => selectedIds.has(id)).length
    if (selectedVisible === 0) return false
    if (selectedVisible === visibleIds.length) return true
    return 'indeterminate'
  }, [selectedIds])

  return {
    selectedIds,
    count: selectedIds.size,
    isSelected,
    toggle,
    selectAllVisible,
    clear,
    headerCheckState,
  }
}
