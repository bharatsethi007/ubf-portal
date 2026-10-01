import { useEffect, useMemo, useRef, useState } from 'react'

/**
 * Row selection for rate-card line grids: checkbox per row, shift-click range,
 * select-all on the rows currently shown, plus a quick text filter to narrow rows first.
 */
export function useLineSelection<T extends { key: string }>(lines: T[], haystack: (l: T) => string) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState('')
  const lastClicked = useRef<string | null>(null)

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return lines
    return lines.filter((l) => haystack(l).toLowerCase().includes(q))
  }, [lines, filter, haystack])

  // Drop selections for rows that were removed.
  useEffect(() => {
    setSelected((prev) => {
      const keys = new Set(lines.map((l) => l.key))
      const next = new Set([...prev].filter((k) => keys.has(k)))
      return next.size === prev.size ? prev : next
    })
  }, [lines])

  function toggle(key: string, shift: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      const turnOn = !prev.has(key)
      if (shift && lastClicked.current) {
        const a = visible.findIndex((l) => l.key === lastClicked.current)
        const b = visible.findIndex((l) => l.key === key)
        if (a >= 0 && b >= 0) {
          const [from, to] = a < b ? [a, b] : [b, a]
          for (let i = from; i <= to; i++) {
            if (turnOn) next.add(visible[i].key)
            else next.delete(visible[i].key)
          }
          return next
        }
      }
      if (turnOn) next.add(key)
      else next.delete(key)
      return next
    })
    lastClicked.current = key
  }

  const visibleSelected = visible.filter((l) => selected.has(l.key)).length
  const allVisible = visible.length > 0 && visibleSelected === visible.length
  const someVisible = visibleSelected > 0 && !allVisible

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allVisible) visible.forEach((l) => next.delete(l.key))
      else visible.forEach((l) => next.add(l.key))
      return next
    })
  }

  return {
    selected, visible, filter, setFilter, toggle, toggleAllVisible, allVisible, someVisible,
    clear: () => setSelected(new Set()),
  }
}
