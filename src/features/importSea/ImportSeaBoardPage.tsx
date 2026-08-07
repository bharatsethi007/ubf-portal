import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { TooltipProvider } from '@/components/ui/tooltip'

import BoardSelectionBar from '@/components/board/BoardSelectionBar'

import { useBoardRowSelection } from '@/components/board/useBoardRowSelection'

import ImportSeaBoardSummary from './ImportSeaBoardSummary'

import ImportSeaBoardTable from './ImportSeaBoardTable'

import CreateImportSeaBookingDialog from './CreateImportSeaBookingDialog'

import ImportSeaFilters from './ImportSeaFilters'

import { applyImportSeaFilters } from './importSeaFilterLogic'

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

  const { rows, loading, error, reload, replaceRow, patchRow } = useImportSeaBoard(showArchived)

  const { filters, setFilter, clearFilters, moreOpen, setMoreOpen } = useImportSeaFilters()

  const selection = useBoardRowSelection()



  const filteredRows = useMemo(

    () => applyImportSeaFilters(rows, filters),

    [rows, filters],

  )

  const { sortedRows, sortKey, sortDir, toggleSort } = useImportSeaSort(filteredRows)

  const visibleIds = useMemo(() => sortedRows.map((row) => row.id), [sortedRows])



  const selectedRows = useMemo(

    () => rows.filter((row) => selection.selectedIds.has(row.id)),

    [rows, selection.selectedIds],

  )



  const { refreshRow, isRefreshing, isFlashing, refreshCooldownSec } = useImportSeaRowRefresh(replaceRow)

  async function handleToggleInvoice(
    id: string,
    key: 'inv_approved' | 'inv_sent',
    value: boolean,
  ) {
    patchRow(id, { [key]: value })
    try {
      await updateImportSeaBooking(id, { [key]: value })
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



  return (

    <TooltipProvider delay={300}>

      <div className="shipments-page">

      {error ? <div className="error card pad-inline">{error}</div> : null}



      <div className="shipments-table-header import-sea-board-toolbar [&_.shipment-filters]:items-center [&_.shipment-filters__input]:h-9 [&_.shipment-filters__input]:min-h-9 [&_.shipment-filters__more-toggle]:h-9 [&_.shipment-filters__more-toggle]:min-h-9 [&_.pagination__btn]:h-9 [&_.pagination__btn]:min-h-9 [&_.pagination__btn]:inline-flex [&_.pagination__btn]:items-center [&_.import-sea-new-booking]:!h-9 [&_.import-sea-new-booking]:!min-h-9 [&_.import-sea-new-booking]:!bg-ub-navy [&_.import-sea-new-booking]:!text-white [&_.import-sea-new-booking]:!border-ub-navy [&_.import-sea-new-booking:hover:not(:disabled)]:!bg-ub-navy/90">

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

        />

        <ImportSeaBoardSummary rows={filteredRows} filteredCount={filteredRows.length} />

      </div>



      <BoardSelectionBar

        count={selection.count}

        onClear={selection.clear}

        actions={actions}

        progress={progress}

      />



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

      />



      <CreateImportSeaBookingDialog

        open={createOpen}

        onOpenChange={setCreateOpen}

        onCreated={() => void reload()}

      />

      {dialogs}

      </div>

    </TooltipProvider>

  )

}


