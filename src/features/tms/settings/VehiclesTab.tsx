import { useEffect, useState } from 'react'
import { format, differenceInCalendarDays } from 'date-fns'
import { Truck, Plus, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import { listFleetVehicles, type FleetVehicle, type VehicleIssue } from './fleetApi'

function ExpiryPill({ date }: { date: string | null }) {
  if (!date) return <span className="text-xs text-neutral-400">—</span>
  const d = new Date(date)
  const days = differenceInCalendarDays(d, new Date())
  const tone = days < 0 ? 'bg-red-50 text-red-700 border-red-200'
    : days <= 30 ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-neutral-50 text-neutral-600 border-neutral-200'
  return <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${tone}`}>{format(d, 'd MMM yyyy')}</span>
}

function IssueTag({ issue }: { issue: VehicleIssue }) {
  const tone = issue.severity === 'critical' ? 'bg-red-50 text-red-700 border-red-200'
    : issue.severity === 'warn' ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-neutral-50 text-neutral-600 border-neutral-200'
  return <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${tone}`}>{issue.label}</span>
}

function PhotoBubble({ url, rego }: { url: string | null; rego: string }) {
  if (url) return <img src={url} alt={rego} className="h-9 w-9 shrink-0 rounded-full object-cover" />
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0A2472]/[0.08] text-[#0A2472]">
      <Truck size={16} />
    </span>
  )
}

export default function VehiclesTab({ onEdit, onAdd }: { onEdit: (v: FleetVehicle) => void; onAdd: () => void }) {
  const [rows, setRows] = useState<FleetVehicle[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    listFleetVehicles().then(setRows).catch((e) => { toast.error(e instanceof Error ? e.message : 'Load failed'); setRows([]) }).finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <button type="button" onClick={onAdd} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0A2472] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0A2472]/90">
          <Plus size={15} /> Add vehicle
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              <th className="py-2 pr-2">Vehicle</th>
              <th className="px-2 py-2">Model</th>
              <th className="px-2 py-2">Current driver</th>
              <th className="px-2 py-2">COF</th>
              <th className="px-2 py-2">Service</th>
              <th className="px-2 py-2">Issues</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="py-6 text-center text-neutral-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="py-6 text-center text-neutral-400">No vehicles yet.</td></tr>
            ) : rows.map((v) => (
              <tr key={v.id} onClick={() => onEdit(v)} className="cursor-pointer border-b border-neutral-100 hover:bg-neutral-50">
                <td className="py-2 pr-2">
                  <div className="flex items-center gap-2">
                    <PhotoBubble url={v.photo_url} rego={v.registration_number} />
                    <div className="min-w-0">
                      <div className="font-semibold text-[#0A2472]">{v.registration_number}</div>
                      <div className="mt-0.5"><ExpiryPill date={v.rego_expiry} /></div>
                    </div>
                  </div>
                </td>
                <td className="px-2 py-2 text-neutral-700">{v.model ?? <span className="text-neutral-400">—</span>}</td>
                <td className="px-2 py-2 text-neutral-700">{v.current_driver ?? <span className="text-neutral-400">Unassigned</span>}</td>
                <td className="px-2 py-2"><ExpiryPill date={v.cof_expiry} /></td>
                <td className="px-2 py-2">
                  <div className="flex flex-col gap-0.5 text-[11px] text-neutral-500">
                    <span className="inline-flex items-center gap-1"><Wrench size={11} className="text-neutral-400" />Last {v.last_service_at ? format(new Date(v.last_service_at), 'd MMM yyyy') : '—'}</span>
                    <span>Next <ExpiryPill date={v.next_service_at} /></span>
                  </div>
                </td>
                <td className="px-2 py-2">
                  {v.issues.length === 0 ? <span className="text-xs text-neutral-400">None</span>
                    : <div className="flex flex-wrap gap-1">{v.issues.map((i) => <IssueTag key={i.id} issue={i} />)}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
