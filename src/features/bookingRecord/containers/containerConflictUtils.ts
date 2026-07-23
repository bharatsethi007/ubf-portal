import type { BookingContainerRow, ContainerConflictStatus } from './bookingContainerTypes'

export function isUnresolvedContainerConflict(
  row: Pick<BookingContainerRow, 'conflict_status' | 'resolved_at'>,
): boolean {
  return row.conflict_status !== 'none' && !row.resolved_at
}

export function containerConflictMessage(
  row: Pick<BookingContainerRow, 'conflict_status' | 'erp_container_type'>,
): string | null {
  switch (row.conflict_status) {
    case 'manual_only':
      return 'Not found in ERP'
    case 'erp_only':
      return 'In ERP but not entered here'
    case 'type_mismatch':
      return row.erp_container_type
        ? `Type differs — ERP says ${row.erp_container_type}`
        : 'Type differs from ERP'
    default:
      return null
  }
}

export function boardContainerConflictTooltip(
  containers: Array<Pick<BookingContainerRow, 'conflict_status' | 'resolved_at' | 'container_no'>> | null | undefined,
): string | null {
  const list = containers ?? []
  const unresolved = list.filter(isUnresolvedContainerConflict)
  if (!unresolved.length) return null

  const labels = new Map<ContainerConflictStatus, string>([
    ['manual_only', 'not in ERP'],
    ['erp_only', 'ERP only'],
    ['type_mismatch', 'type mismatch'],
  ])

  const parts = [...new Set(unresolved.map((c) => c.conflict_status))]
    .map((status) => labels.get(status) ?? status)
  return `Container conflict: ${parts.join(', ')}`
}

export function countUnresolvedBookingConflicts(
  rows: Array<{ containers?: Array<Pick<BookingContainerRow, 'conflict_status' | 'resolved_at'>> | null }>,
): number {
  return rows.filter((row) =>
    (row.containers ?? []).some(isUnresolvedContainerConflict),
  ).length
}

export function countUnresolvedContainerConflicts(
  containers: Array<Pick<BookingContainerRow, 'conflict_status' | 'resolved_at'>> | null | undefined,
): number {
  return (containers ?? []).filter(isUnresolvedContainerConflict).length
}
