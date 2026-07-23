import { useMemo } from 'react'
import ImportSeaBoardSummary from './ImportSeaBoardSummary'
import ImportSeaBoardTable from './ImportSeaBoardTable'
import ImportSeaFilters from './ImportSeaFilters'
import { applyImportSeaFilters } from './importSeaFilterLogic'
import { exportImportSeaCsv } from './importSeaRowUtils'
import { useImportSeaBoard } from './useImportSeaBoard'
import { useImportSeaFilters } from './useImportSeaFilters'

export default function ImportSeaBoardPage() {
  const { rows, loading, error, reload } = useImportSeaBoard()
  const { filters, setFilter, clearFilters, moreOpen, setMoreOpen } = useImportSeaFilters()

  const filteredRows = useMemo(
    () => applyImportSeaFilters(rows, filters),
    [rows, filters],
  )

  return (
    <div className="shipments-page">
      <header className="card pad-inline import-sea-header">
        <h1 className="import-sea-header__title">Import Sea board</h1>
        <p className="muted import-sea-header__sub">
          Ops board for sea import bookings — release, customs, delivery, and holds.
        </p>
      </header>

      {error ? <div className="error card pad-inline">{error}</div> : null}

      <div className="shipments-table-header">
        <ImportSeaFilters
          rows={rows}
          filters={filters}
          setFilter={setFilter}
          clearFilters={clearFilters}
          moreOpen={moreOpen}
          setMoreOpen={setMoreOpen}
          loading={loading}
          onRefresh={() => void reload()}
          onExport={() => exportImportSeaCsv(filteredRows)}
        />
        <ImportSeaBoardSummary rows={filteredRows} filteredCount={filteredRows.length} />
      </div>

      <ImportSeaBoardTable rows={filteredRows} loading={loading} />
    </div>
  )
}
