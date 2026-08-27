import { useEffect, useState } from 'react'
import { User } from 'lucide-react'
import { toast } from 'sonner'
import { listFleetDrivers, type FleetDriver } from './fleetApi'

export default function DriversTab() {
  const [rows, setRows] = useState<FleetDriver[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    listFleetDrivers().then(setRows).catch((e) => { toast.error(e instanceof Error ? e.message : 'Load failed'); setRows([]) }).finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="py-6 text-center text-sm text-neutral-400">Loading…</p>
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-neutral-400">No drivers yet.</p>

  return (
    <div className="space-y-1">
      {rows.map((d) => (
        <div key={d.id} className="flex items-center gap-3 rounded-lg border border-neutral-100 px-3 py-2 hover:bg-neutral-50">
          {d.photo_url
            ? <img src={d.photo_url} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
            : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0A2472]/[0.08] text-[#0A2472]"><User size={16} /></span>}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-[#0A2472]">{d.first_name} {d.last_name}</div>
            <div className="truncate text-xs text-neutral-500">{d.phone ?? 'No phone'}{d.current_registration ? ` · ${d.current_registration}` : ''}</div>
          </div>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${d.active ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}>{d.active ? 'Active' : 'Inactive'}</span>
        </div>
      ))}
    </div>
  )
}
