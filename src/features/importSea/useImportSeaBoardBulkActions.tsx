import { useMemo, useState } from 'react'
import { Download, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import type { BoardBulkAction, BoardSelectionProgress } from '@/components/board/BoardSelectionBar'
import { toastBulkUpdateResult } from '@/components/board/bulkResultToast'
import ImportSeaBulkAssignHandledBy from './bulk/ImportSeaBulkAssignHandledBy'
import ImportSeaBulkSetDeliveryMode from './bulk/ImportSeaBulkSetDeliveryMode'
import ImportSeaBulkSetHold from './bulk/ImportSeaBulkSetHold'
import ImportSeaPortConnectConfirmDialog from './bulk/ImportSeaPortConnectConfirmDialog'
import { exportImportSeaCsv } from './importSeaRowUtils'
import {
  bulkRefreshPortConnect,
  splitPortConnectBulkItems,
  type PortConnectBulkOutcome,
} from './importSeaPortConnectBulk'
import type { ImportSeaRow } from './types'

type Params = {
  selectedRows: ImportSeaRow[]
  busy?: boolean
  onReload: () => Promise<void>
  onReplaceRow: (row: ImportSeaRow) => void
}

export function useImportSeaBoardBulkActions({
  selectedRows,
  busy,
  onReload,
  onReplaceRow,
}: Params) {
  const [pcConfirmOpen, setPcConfirmOpen] = useState(false)
  const [pcBusy, setPcBusy] = useState(false)
  const [progress, setProgress] = useState<BoardSelectionProgress | null>(null)

  const { eligible, ineligible } = useMemo(
    () => splitPortConnectBulkItems(selectedRows),
    [selectedRows],
  )

  async function runPortConnectBulk() {
    setPcBusy(true)
    setProgress({ label: 'Refreshing PortConnect…', done: 0, total: eligible.length })
    try {
      const outcomes = await bulkRefreshPortConnect(eligible, {
        concurrency: 4,
        onProgress: (done, total) => {
          setProgress({ label: 'Refreshing PortConnect…', done, total })
        },
        onRowComplete: (outcome: PortConnectBulkOutcome) => {
          if (outcome.status === 'ok') onReplaceRow(outcome.row)
        },
      })

      const ok = outcomes.filter((o) => o.status === 'ok').length
      const failed = outcomes.filter((o) => o.status === 'error')
      if (failed.length) {
        toastBulkUpdateResult(
          'PortConnect refresh',
          ok,
          failed.map((f) => ({
            id: f.id,
            booking_ref: f.booking_ref,
            error: f.error,
          })),
        )
      } else {
        toast.success(`PortConnect refreshed for ${ok} booking${ok === 1 ? '' : 's'}`)
      }
      if (ineligible.length) {
        toast.info(
          `Skipped ${ineligible.length} ineligible booking${ineligible.length === 1 ? '' : 's'}`,
        )
      }
      setPcConfirmOpen(false)
    } finally {
      setPcBusy(false)
      setProgress(null)
    }
  }

  const actions: BoardBulkAction[] = useMemo(() => [
    {
      id: 'portconnect',
      label: 'Refresh PortConnect',
      icon: <RefreshCw size={14} />,
      disabled: busy || pcBusy || selectedRows.length === 0,
      loading: pcBusy,
      onClick: () => setPcConfirmOpen(true),
    },
    {
      id: 'handled-by',
      label: 'Assign handled by',
      popover: (
        <ImportSeaBulkAssignHandledBy
          rows={selectedRows}
          disabled={busy || pcBusy}
          onApplied={() => void onReload()}
        />
      ),
    },
    {
      id: 'hold',
      label: 'Set hold',
      popover: (
        <ImportSeaBulkSetHold
          rows={selectedRows}
          disabled={busy || pcBusy}
          onApplied={() => void onReload()}
        />
      ),
    },
    {
      id: 'delivery-mode',
      label: 'Set delivery mode',
      popover: (
        <ImportSeaBulkSetDeliveryMode
          rows={selectedRows}
          disabled={busy || pcBusy}
          onApplied={() => void onReload()}
        />
      ),
    },
    {
      id: 'export',
      label: 'Export selected',
      icon: <Download size={14} />,
      disabled: busy || pcBusy || selectedRows.length === 0,
      onClick: () => exportImportSeaCsv(selectedRows),
    },
  ], [busy, pcBusy, eligible.length, ineligible.length, onReload, selectedRows])

  const dialogs = (
    <ImportSeaPortConnectConfirmDialog
      open={pcConfirmOpen}
      eligibleCount={eligible.length}
      ineligible={ineligible}
      busy={pcBusy}
      onClose={() => setPcConfirmOpen(false)}
      onConfirm={() => void runPortConnectBulk()}
    />
  )

  return { actions, progress, dialogs }
}
