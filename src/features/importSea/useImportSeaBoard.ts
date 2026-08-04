import { useCallback, useEffect, useState } from 'react'
import { fetchImportSeaBoard } from './importSeaApi'
import type { ImportSeaRow } from './types'

export function useImportSeaBoard(includeArchived = false) {
  const [rows, setRows] = useState<ImportSeaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchImportSeaBoard(includeArchived)
      setRows(data)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load board')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [includeArchived])

  const patchRow = useCallback((id: string, patch: Partial<ImportSeaRow>) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }, [])

  const replaceRow = useCallback((row: ImportSeaRow) => {
    setRows((prev) => prev.map((existing) => (existing.id === row.id ? row : existing)))
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return { rows, loading, error, reload, patchRow, replaceRow }
}
