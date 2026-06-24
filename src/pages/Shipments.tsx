import ConsolsTable from '../components/ConsolsTable'
import JobDetailDrawer from '../components/JobDetailDrawer'
import JobsTable from '../components/JobsTable'
import ModuleTabs from '../components/ModuleTabs'
import ShipmentFilters from '../components/ShipmentFilters'
import ShipmentMap from '../components/ShipmentMap'
import ShipmentsDateRange from '../components/ShipmentsDateRange'
import ShipmentAccountFilterSync from '../components/ShipmentAccountFilterSync'
import { ShipmentFiltersProvider, useShipmentFilters } from '../hooks/useShipmentFilters'
import { useMapPortData } from '../hooks/useMapPortData'

type Props = { globalSearch: string }

function ShipmentsContent() {
  const { view, activePort, togglePort, setActivePort, jobDrawer, closeJobDrawer } = useShipmentFilters()
  const { mapPorts, loading } = useMapPortData()

  return (
    <div className="shipments-page">
      <div className="shipments-map-header card">
        <ModuleTabs />
        <ShipmentsDateRange />
      </div>

      <ShipmentMap
        ports={mapPorts}
        selectedPort={activePort}
        loading={loading}
        onPortClick={togglePort}
        onClear={() => setActivePort(null)}
      />

      <div className="shipments-table-header">
        <ShipmentFilters />
      </div>

      {view === 'consols' ? <ConsolsTable /> : <JobsTable />}

      <JobDetailDrawer
        jobUnique={jobDrawer?.jobUnique ?? null}
        consolKey={jobDrawer?.consolKey ?? null}
        onClose={closeJobDrawer}
      />
    </div>
  )
}

export default function Shipments(_props: Props) {
  return (
    <ShipmentFiltersProvider>
      <ShipmentAccountFilterSync />
      <ShipmentsContent />
    </ShipmentFiltersProvider>
  )
}
