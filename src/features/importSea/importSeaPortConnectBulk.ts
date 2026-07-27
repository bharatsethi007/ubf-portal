import { refreshPortConnect } from '@/features/bookingRecord/tracking/portconnectSubscriptionApi'
import { runWithConcurrency } from '@/components/board/runWithConcurrency'
import { fetchImportSeaBoardRow } from './importSeaApi'
import { portConnectRefreshIneligibleReason } from './importSeaBoardUtils'
import type { ImportSeaRow } from './types'

export type PortConnectBulkItem = {
  row: ImportSeaRow
  reason: string | null
}

export type PortConnectBulkOutcome =
  | { id: string; status: 'ok'; row: ImportSeaRow }
  | { id: string; status: 'error'; booking_ref: string | null; error: string }
  | { id: string; status: 'skipped'; booking_ref: string | null; reason: string }

export function splitPortConnectBulkItems(rows: ImportSeaRow[]): {
  eligible: ImportSeaRow[]
  ineligible: PortConnectBulkItem[]
} {
  const eligible: ImportSeaRow[] = []
  const ineligible: PortConnectBulkItem[] = []
  for (const row of rows) {
    const reason = portConnectRefreshIneligibleReason(row)
    if (reason) ineligible.push({ row, reason })
    else eligible.push(row)
  }
  return { eligible, ineligible }
}

export async function bulkRefreshPortConnect(
  rows: ImportSeaRow[],
  opts: {
    concurrency?: number
    onProgress?: (done: number, total: number) => void
    onRowComplete?: (outcome: PortConnectBulkOutcome) => void
  },
): Promise<PortConnectBulkOutcome[]> {
  const { concurrency = 4, onProgress, onRowComplete } = opts
  const outcomes: PortConnectBulkOutcome[] = []

  await runWithConcurrency(
    rows,
    concurrency,
    async (row) => {
      try {
        await refreshPortConnect(row.id)
        const updated = await fetchImportSeaBoardRow(row.id)
        if (!updated) {
          const outcome: PortConnectBulkOutcome = {
            id: row.id,
            status: 'error',
            booking_ref: row.booking_ref,
            error: 'Booking not found after refresh',
          }
          outcomes.push(outcome)
          onRowComplete?.(outcome)
          return
        }
        const outcome: PortConnectBulkOutcome = { id: row.id, status: 'ok', row: updated }
        outcomes.push(outcome)
        onRowComplete?.(outcome)
      } catch (err) {
        const outcome: PortConnectBulkOutcome = {
          id: row.id,
          status: 'error',
          booking_ref: row.booking_ref,
          error: err instanceof Error ? err.message : 'Refresh failed',
        }
        outcomes.push(outcome)
        onRowComplete?.(outcome)
      }
    },
    onProgress,
  )

  return outcomes
}
