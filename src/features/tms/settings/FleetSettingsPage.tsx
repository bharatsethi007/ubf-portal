import { useState } from 'react'
import { ArrowLeft, Truck, Users } from 'lucide-react'
import { toast } from 'sonner'
import VehiclesTab from './VehiclesTab'
import DriversTab from './DriversTab'
import type { FleetVehicle } from './fleetApi'

type Tab = 'vehicles' | 'drivers'

export default function FleetSettingsPage({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<Tab>('vehicles')

  // Step 2 will replace these with the edit/add popup.
  const onEdit = (_v: FleetVehicle) => toast('Editing a vehicle lands in the next step.')
  const onAdd = () => toast('Add vehicle lands in the next step.')

  const TABS: { key: Tab; label: string; Icon: typeof Truck }[] = [
    { key: 'vehicles', label: 'Vehicles', Icon: Truck },
    { key: 'drivers', label: 'Drivers', Icon: Users },
  ]

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <button type="button" onClick={onBack} aria-label="Back" title="Back"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-neutral-200 text-neutral-600 hover:bg-neutral-50">
          <ArrowLeft size={16} />
        </button>
        <h1 className="text-lg font-semibold text-[#0A2472]">Fleet settings</h1>
      </div>
      <div className="flex gap-1 border-b border-neutral-200">
        {TABS.map(({ key, label, Icon }) => {
          const on = tab === key
          return (
            <button key={key} type="button" onClick={() => setTab(key)}
              className={`relative inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium ${on ? 'text-[#0A2472]' : 'text-neutral-500 hover:text-neutral-800'}`}>
              <Icon size={14} />{label}
              {on && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[#0A2472]" />}
            </button>
          )
        })}
      </div>
      <div className="pt-3">
        {tab === 'vehicles' ? <VehiclesTab onEdit={onEdit} onAdd={onAdd} /> : <DriversTab />}
      </div>
    </div>
  )
}
