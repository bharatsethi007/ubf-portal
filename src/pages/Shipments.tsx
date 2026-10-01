import { useState } from 'react'
import { Map as MapIcon, MapPinOff } from 'lucide-react'
import ConsolsTable from '../components/ConsolsTable'
import ShipmentStatsStrip from '../components/shipments/ShipmentStatsStrip'
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

const MAP_PREF_KEY = 'shipments.mapHidden'

function readMapHidden(): boolean {
  try {
    return localStorage.getItem(MAP_PREF_KEY) === '1'
  } catch {
    return false
  }
}

function ShipmentsContent() {
  const { view, activePort, togglePort, setActivePort, jobDrawer, closeJobDrawer } = useShipmentFilters()
  const { mapPorts, loading } = useMapPortData()
  const [mapHidden, setMapHidden] = useState(readMapHidden)

  const toggleMap = () => {
    setMapHidden((prev) => {
      const next = !prev
      if (next) setActivePort(null) // a hidden map can't show or clear its port filter
      try {
        localStorage.setItem(MAP_PREF_KEY, next ? '1' : '0')
      } catch {
        /* storage unavailable: keep in-memory only */
      }
      return next
    })
  }

  return (
    <div className="shipments-page">
      <div className="shipments-map-header card">
        <ModuleTabs />
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <ShipmentsDateRange />
          <button
            type="button"
            className="icon-btn"
            title={mapHidden ? 'Show map' : 'Hide map'}
            aria-label={mapHidden ? 'Show map' : 'Hide map'}
            aria-pressed={!mapHidden}
            onClick={toggleMap}
          >
            {mapHidden ? <MapIcon size={16} /> : <MapPinOff size={16} />}
          </button>
        </div>
      </div>

      <ShipmentStatsStrip />

      {mapHidden ? null : (
        <ShipmentMap
          ports={mapPorts}
          selectedPort={activePort}
          loading={loading}
          onPortClick={togglePort}
          onClear={() => setActivePort(null)}
        />
      )}

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
