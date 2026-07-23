import { fmtDate } from '@/utils/format'
import type { BookingHistoryRow } from '../bookingRecordTypes'
import {
  BOOLEAN_BOOKING_FIELDS,
  DATE_BOOKING_FIELDS,
  bookingFieldLabel,
} from './bookingHistoryLabels'

export type HistoryFilter = 'all' | 'fields' | 'tasks' | 'documents'

export type HistoryDayGroup = {
  key: string
  label: string
  rows: BookingHistoryRow[]
}

export function historyActorName(row: BookingHistoryRow): string {
  if (!row.actor_name) return 'System'
  const local = row.actor_name.split('@')[0]?.replace(/[._]/g, ' ').trim()
  if (!local) return row.actor_name
  return local.charAt(0).toUpperCase() + local.slice(1)
}

export function matchesHistoryFilter(row: BookingHistoryRow, filter: HistoryFilter): boolean {
  if (filter === 'all') return true
  const action = row.action.toLowerCase()
  const field = row.field?.toLowerCase() ?? ''
  const isTask = action.startsWith('task') || field.startsWith('task')
  const isDoc = action.startsWith('document') || field.startsWith('document')
  if (filter === 'tasks') return isTask
  if (filter === 'documents') return isDoc
  return !isTask && !isDoc
}

function fmtHistoryDate(value: string | null): string {
  if (!value) return 'empty'
  const iso = value.includes('T') ? value : `${value}T00:00:00`
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return value
  const now = new Date()
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  if (date.getFullYear() !== now.getFullYear()) opts.year = 'numeric'
  return date.toLocaleDateString('en-NZ', opts)
}

function fmtHistoryValue(field: string | null, value: string | null): string {
  if (value == null || value === '') return 'empty'
  if (field && BOOLEAN_BOOKING_FIELDS.has(field)) {
    if (value === 'true') return 'Yes'
    if (value === 'false') return 'No'
  }
  if (field && DATE_BOOKING_FIELDS.has(field)) return fmtHistoryDate(value)
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return fmtHistoryDate(value)
  return value
}

function formatFieldChange(row: BookingHistoryRow, actor: string): string {
  const field = row.field!
  const label = bookingFieldLabel(field)
  const oldV = fmtHistoryValue(field, row.old_value)
  const newV = fmtHistoryValue(field, row.new_value)
  const isBool = BOOLEAN_BOOKING_FIELDS.has(field)

  if (field === 'shipment_id' && row.new_value) {
    return `Sync matched booking to job ${row.new_value}`
  }

  if (isBool && (row.old_value == null || row.old_value === '')) {
    return `${actor} set ${label} to ${newV}`
  }
  if (oldV === 'empty') return `${actor} set ${label} to ${newV}`
  return `${actor} changed ${label} from ${oldV} to ${newV}`
}

function formatTaskChange(row: BookingHistoryRow, actor: string): string {
  const detail = row.new_value ?? row.old_value ?? 'task'
  switch (row.action) {
    case 'task_created':
      return `${actor} added task "${detail}"`
    case 'task_completed':
      return `${actor} completed task "${detail}"`
    case 'task_reopened':
      return `${actor} reopened task "${detail}"`
    case 'task_assigned':
      return `${actor} assigned task "${detail}"`
    case 'task_deleted':
      return `${actor} removed task "${detail}"`
    default:
      return `${actor} updated task "${detail}"`
  }
}

const CONFLICT_LABELS: Record<string, string> = {
  manual_only: 'not in ERP',
  erp_only: 'ERP only',
  type_mismatch: 'type mismatch',
}

const RESOLUTION_LABELS: Record<string, string> = {
  kept_manual: 'kept manual entry',
  kept_erp: 'used ERP values',
  both_valid: 'marked both as correct',
}

function formatContainerConflict(row: BookingHistoryRow, actor: string): string {
  const containerNo = row.field?.replace(/^container:/, '') ?? 'container'
  const conflict = CONFLICT_LABELS[row.old_value ?? ''] ?? row.old_value ?? 'conflict'
  const resolution = RESOLUTION_LABELS[row.new_value ?? ''] ?? row.new_value ?? 'resolved'
  return `${actor} resolved container ${containerNo} (${conflict}) — ${resolution}`
}

function formatDocumentChange(row: BookingHistoryRow, actor: string): string {
  const name = row.new_value ?? row.old_value ?? 'document'
  switch (row.action) {
    case 'document_uploaded':
      return `${actor} uploaded ${name}`
    case 'document_deleted':
      return `${actor} deleted ${name}`
    case 'document_tagged':
      return `${actor} tagged ${name}`
    default:
      return `${actor} updated document ${name}`
  }
}

export function describeHistoryEntry(row: BookingHistoryRow): string {
  const actor = historyActorName(row)
  const action = row.action.toLowerCase()

  if (action === 'created') return `${actor} created the booking`
  if (action === 'sync_matched') {
    return `Sync matched booking to job ${row.new_value ?? 'unknown'}`
  }
  if (action === 'container_conflict_resolved') {
    return formatContainerConflict(row, actor)
  }
  if (action.startsWith('task') || row.field?.startsWith('task')) {
    return formatTaskChange(row, actor)
  }
  if (action.startsWith('document') || row.field?.startsWith('document')) {
    return formatDocumentChange(row, actor)
  }
  if (row.field && action === 'updated') return formatFieldChange(row, actor)
  return `${actor} ${row.action.replace(/_/g, ' ')}`
}

export function dayDividerLabel(iso: string): string {
  const key = iso.slice(0, 10)
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
  if (key === today) return 'Today'
  if (key === yesterday) return 'Yesterday'
  return fmtDate(iso, false)
}

export function groupHistoryByDay(rows: BookingHistoryRow[]): HistoryDayGroup[] {
  const map = new Map<string, BookingHistoryRow[]>()
  for (const row of rows) {
    const key = row.created_at.slice(0, 10)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(row)
  }
  return [...map.entries()].map(([key, groupRows]) => ({
    key,
    label: dayDividerLabel(groupRows[0]!.created_at),
    rows: groupRows,
  }))
}
