import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  EMPTY_IMPORT_SEA_FILTERS,
  type ImportSeaFilterState,
} from './importSeaFilterLogic'
import { filtersFromSearchParams, filtersToSearchParams } from './importSeaFilterUrl'

export function useImportSeaFilters() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [moreOpen, setMoreOpen] = useState(false)

  const filters = useMemo(
    () => filtersFromSearchParams(searchParams),
    [searchParams],
  )

  const setFilter = useCallback(<K extends keyof ImportSeaFilterState>(
    key: K,
    value: ImportSeaFilterState[K],
  ) => {
    setSearchParams((prev) => {
      const next = filtersFromSearchParams(prev)
      next[key] = value
      const params = filtersToSearchParams(next)
      return params
    }, { replace: true })
  }, [setSearchParams])

  const clearFilters = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true })
    setMoreOpen(false)
  }, [setSearchParams])

  return { filters, setFilter, clearFilters, moreOpen, setMoreOpen }
}

export { EMPTY_IMPORT_SEA_FILTERS }
