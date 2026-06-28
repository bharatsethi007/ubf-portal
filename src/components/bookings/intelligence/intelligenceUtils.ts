import { fmtShort } from '../../../utils/format'
import type { VolumeRow } from './types'

export const THINKING_LINES = [
  'Reading customer profile…',
  'Aggregating 12-month shipment volume…',
  'Checking open invoices & YTD spend…',
  'Pulling last 5 shipments…',
]

export function fmtMoney(n: number): string {
  return `$${n.toLocaleString('en-NZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export function modeIcon(mode: 'air' | 'sea'): string {
  return mode === 'air' ? '✈' : '🚢'
}

function volumePhrase(row: VolumeRow): string {
  const dirWord = row.dir === 'export' ? 'exports' : 'imports'
  return `${row.count} ${row.mode}freight ${dirWord} to ${row.dest}`
}

export function volumeSentence(volume: VolumeRow[]): string {
  if (!volume.length) return 'No recent volume on file'
  const sorted = [...volume].sort((a, b) => b.count - a.count)
  const top = sorted.slice(0, 4)
  const rest = sorted.length - top.length
  const parts = top.map(volumePhrase)
  if (rest > 0) parts.push(`+${rest} more`)
  return parts.join(', ')
}

export function formatIntelDate(value: string | null): string {
  if (!value) return '—'
  return fmtShort(value)
}

