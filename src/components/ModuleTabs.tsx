import { MODULE_TABS } from '../types/shipmentFilters'
import { useShipmentFilters } from '../hooks/useShipmentFilters'

export default function ModuleTabs() {
  const { activeModule, setActiveModule } = useShipmentFilters()

  return (
    <div className="seg module-tabs">
      {MODULE_TABS.map(({ tab, label }) => (
        <button
          key={tab}
          type="button"
          className={`seg-btn${activeModule === tab ? ' on' : ''}`}
          onClick={() => setActiveModule(tab)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
