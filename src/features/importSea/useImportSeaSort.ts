import { useCallback, useMemo, useState } from 'react'
import type { ImportSeaRow } from './types'

export type ImportSeaSortDir = 'asc' | 'desc'

const DATE_KEYS = new Set<keyof ImportSeaRow>([
  'eta',
  'atf',
  'last_free_day',
  'delivery_date',
  'container_return_date',
])

const STRING_KEYS = new Set<keyof ImportSeaRow>(['booking_ref', 'customer_name'])

function isNullish(value: unknown): boolean {
  return value == null || value === ''
}

function compareNullsLast(a: unknown, b: unknown): number {
  const aNull = isNullish(a)
  const bNull = isNullish(b)
  if (aNull && bNull) return 0
  if (aNull) return 1
  if (bNull) return -1
  return 0
}

function compareValues(
  key: keyof ImportSeaRow,
  a: ImportSeaRow,
  b: ImportSeaRow,
  dir: ImportSeaSortDir,
): number {
  const av = a[key]
  const bv = b[key]

  const nullCmp = compareNullsLast(av, bv)
  if (nullCmp !== 0) return nullCmp

  let cmp = 0
  if (key === 'hold_code') {
    cmp = Number(Boolean(av)) - Number(Boolean(bv))
  } else if (DATE_KEYS.has(key)) {
    cmp = String(av).localeCompare(String(bv))
  } else if (STRING_KEYS.has(key)) {
    cmp = String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' })
  } else {
    cmp = String(av).localeCompare(String(bv))
  }

  return dir === 'asc' ? cmp : -cmp
}

export function useImportSeaSort(rows: ImportSeaRow[]) {
  const [sortKey, setSortKey] = useState<keyof ImportSeaRow | null>(null)
  const [sortDir, setSortDir] = useState<ImportSeaSortDir>('asc')

  const toggleSort = useCallback((key: keyof ImportSeaRow) => {
    setSortKey((current) => {
      if (current === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
        return key
      }
      setSortDir('asc')
      return key
    })
  }, [])

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows
    return [...rows].sort((a, b) => compareValues(sortKey, a, b, sortDir))
  }, [rows, sortKey, sortDir])

  return { sortedRows, sortKey, sortDir, toggleSort }
}
