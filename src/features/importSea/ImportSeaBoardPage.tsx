import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { TooltipProvider } from '@/components/ui/tooltip'
import BoardSelectionBar from '@/components/board/BoardSelectionBar'
import { useBoardRowSelection } from '@/components/board/useBoardRowSelection'
import { useStaffPref } from '@/hooks/useStaffPref'
import BookingPeekDrawer from '@/features/bookingsWorkspace/BookingPeekDrawer'
import { useBookingFlow } from '@/features/bookingsWorkspace/useBookingFlow'

import ImportSeaBoardSummary from './ImportSeaBoardSummary'
import ImportSeaBoardTable from './ImportSeaBoardTable'
import ImportSeaVesselMap from './ImportSeaVesselMap'
import CreateImportSeaBookingDialog from './CreateImportSeaBookingDialog'
import ImportSeaFilters from './ImportSeaFilters'
import ImportSeaLoadTabs, { LOAD_TABS, matchesLoadTab, type LoadTab } from './ImportSeaLoadTabs'
import { applyImportSeaFilters } from './importSeaFilterLogic'
import { bookingRecordHref } from './importSeaFilterUrl'
import { exportImportSeaCsv } from './importSeaRowUtils'
import { useImportSeaBoardBulkActions } from './useImportSeaBoardBulkActions'
import { useImportSeaRowRefresh } from './useImportSeaRowRefresh'
import { updateImportSeaBooking } from './importSeaApi'
import { useImportSeaBoard } from './useImportSeaBoard'
import { useImportSeaFilters } from './useImportSeaFilters'
import { useImportSeaSort } from './useImportSeaSort'

export default function ImportSeaBoardPage() {
  const [createOpen, setCreateOpen] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  const [peekId, setPeekId] = useState<string | null>(null)
  const [searchParams] = useSearchParams()

  const { rows, loading, error, reload, replaceRow, patchRow } = useImportSeaBoard(showArchived)
  const { flow, reloadFlow } = useBookingFlow('IS', rows)
  const { filters, setFilter, clearFilters, moreOpen, setMoreOpen } = useImportSeaFilters()
  const selection = useBoardRowSelection()

  const [loadTab, setLoadTab] = useStaffPref<LoadTab>('import_sea_board.load_tab', 'all', LOAD_TABS)
  const tabRows = useMemo(() => rows.filter((row) => matchesLoadTab(row, loadTab)), [rows, loadTab])
  const filteredRows = useMemo(() => applyImportSeaFilters(tabRows, filters), [tabRows, filters])
  const { sortedRows, sortKey, sortDir, toggleSort } = useImportSeaSort(filteredRows)
  const visibleIds = useMemo(() => sortedRows.map((row) => row.id), [sortedRows])
  const selectedRows = useMemo(
    () => rows.filter((row) => selection.selectedIds.has(row.id)),
    [rows, selection.selectedIds],
  )

  const { refreshRow, isRefreshing, isFlashing, refreshCooldownSec } = useImportSeaRowRefresh(replaceRow)

  async function handleToggleInvoice(id: string, key: 'inv_approved' | 'inv_sent', value: boolean) {
    patchRow(id, { [key]: value })
    try {
      await updateImportSeaBooking(id, { [key]: value })
      void reloadFlow()
    } catch {
      patchRow(id, { [key]: !value })
      toast.error('Could not update invoice status')
    }
  }

  const { actions, progress, dialogs } = useImportSeaBoardBulkActions({
    selectedRows,
    busy: loading,
    onReload: reload,
    onReplaceRow: replaceRow,
  })

  const closePeek = useCallback(() => setPeekId(null), [])
  const peekRow = peekId ? rows.find((r) => r.id === peekId) : undefined

  return (
    <TooltipProvider delay={300}>
      <div className="bk-is">
        {error ? <div className="error card pad-inline">{error}</div> : null}

        <ImportSeaVesselMap open={mapOpen} />

        <section className="bk-card">
          <div className="bk-card__tabs">
            <ImportSeaLoadTabs rows={rows} value={loadTab} onChange={setLoadTab} />
            <ImportSeaBoardSummary rows={filteredRows} filteredCount={filteredRows.length} />
          </div>

          {selection.count > 0 ? (
            <BoardSelectionBar
              count={selection.count}
              onClear={selection.clear}
              actions={actions}
              progress={progress}
            />
          ) : (
            <div className="bk-card__toolbar">
              <ImportSeaFilters
                rows={rows}
                filters={filters}
                setFilter={setFilter}
                clearFilters={clearFilters}
                moreOpen={moreOpen}
                setMoreOpen={setMoreOpen}
                loading={loading}
                onExport={() => exportImportSeaCsv(filteredRows)}
                onNewBooking={() => setCreateOpen(true)}
                showArchived={showArchived}
                onToggleArchived={() => setShowArchived((v) => !v)}
                mapOpen={mapOpen}
                onToggleMap={() => setMapOpen((v) => !v)}
              />
            </div>
          )}

          <ImportSeaBoardTable
            rows={sortedRows}
            loading={loading}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={toggleSort}
            selectedIds={selection.selectedIds}
            headerCheckState={selection.headerCheckState(visibleIds)}
            onToggleRow={(id, index, shiftKey) => selection.toggle(id, index, visibleIds, shiftKey)}
            onToggleAllVisible={(checked) => selection.selectAllVisible(visibleIds, checked)}
            onRefreshRow={(row) => void refreshRow(row)}
            isRowRefreshing={isRefreshing}
            rowRefreshCooldownSec={refreshCooldownSec}
            isCellFlashing={isFlashing}
            onToggleInvoice={handleToggleInvoice}
            flow={flow}
            onOpenPeek={setPeekId}
            peekId={peekId}
          />
        </section>

        <BookingPeekDrawer
          row={peekRow}
          flow={peekId ? flow.get(peekId) : undefined}
          recordHref={peekId ? bookingRecordHref(peekId, searchParams) : '#'}
          onClose={closePeek}
        />

        <CreateImportSeaBookingDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          defaultLoadType={loadTab === 'FCL' || loadTab === 'LCL' ? loadTab : null}
          onCreated={() => void reload()}
        />
        {dialogs}
      </div>
    </TooltipProvider>
  )
}
