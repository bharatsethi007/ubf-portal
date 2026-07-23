import { useCallback, useEffect, useState } from 'react'
import { fetchImportSeaBoard } from './importSeaApi'
import type { ImportSeaRow } from './types'

export function useImportSeaBoard() {
  const [rows, setRows] = useState<ImportSeaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchImportSeaBoard()
      setRows(data)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load board')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return { rows, loading, error, reload }
}
