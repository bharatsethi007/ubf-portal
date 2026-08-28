import { useEffect, useState } from 'react'
import { format, differenceInCalendarDays } from 'date-fns'
import { User, LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { listFleetDrivers, logOffDriver, ENDORSEMENTS, type FleetDriver } from './fleetApi'

function ExpiryPill({ date }: { date: string | null }) {
  if (!date) return <span className="text-xs text-neutral-400">—</span>
  const d = new Date(date)
  const days = differenceInCalendarDays(d, new Date())
  const tone = days < 0 ? 'bg-red-50 text-red-700 border-red-200'
    : days <= 30 ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-neutral-50 text-neutral-600 border-neutral-200'
  return <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${tone}`}>{format(d, 'd MMM yyyy')}</span>
}

export default function DriversTab({ onEdit, reloadKey = 0 }: { onEdit: (d: FleetDriver) => void; reloadKey?: number }) {
  const [rows, setRows] = useState<FleetDriver[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const load = () => { setLoading(true); listFleetDrivers().then(setRows).catch((e) => { toast.error(e instanceof Error ? e.message : 'Load failed'); setRows([]) }).finally(() => setLoading(false)) }
  useEffect(load, [reloadKey])

  async function logOff(id: string, name: string) {
    setBusy(id)
    try { await logOffDriver(id); toast.success(`${name} logged off`); load() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
    finally { setBusy(null) }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            <th className="py-2 pr-2">Driver</th>
            <th className="px-2 py-2">License</th>
            <th className="px-2 py-2">Endorsements</th>
            <th className="px-2 py-2">Current vehicle</th>
            <th className="px-2 py-2">Mobile</th>
            <th className="px-2 py-2">App</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={6} className="py-6 text-center text-neutral-400">Loading…</td></tr>
          ) : rows.length === 0 ? (
            <tr><td colSpan={6} className="py-6 text-center text-neutral-400">No drivers yet.</td></tr>
          ) : rows.map((d) => (
            <tr key={d.id} onClick={() => onEdit(d)} className="cursor-pointer border-b border-neutral-100 hover:bg-neutral-50">
              <td className="py-2 pr-2">
                <div className="flex items-center gap-2">
                  {d.photo_url
                    ? <img src={d.photo_url} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                    : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0A2472]/[0.08] text-[#0A2472]"><User size={16} /></span>}
                  <div className="min-w-0">
                    <div className="font-semibold text-[#0A2472]">{d.first_name} {d.last_name}</div>
                    {!d.active && <span className="text-[10px] text-neutral-400">Inactive</span>}
                  </div>
                </div>
              </td>
              <td className="px-2 py-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-neutral-700">{d.license_number ?? <span className="text-neutral-400">—</span>}</span>
                  <div><ExpiryPill date={d.license_expiry} /></div>
                </div>
              </td>
              <td className="px-2 py-2">
                {d.endorsements.length === 0 ? <span className="text-xs text-neutral-400">—</span>
                  : <div className="flex flex-wrap gap-1">
                      {ENDORSEMENTS.filter((e) => d.endorsements.includes(e.key)).map((e) => (
                        <span key={e.key} className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${e.key === 'DG' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-[#0A2472]/20 bg-[#0A2472]/[0.06] text-[#0A2472]'}`}>{e.short}</span>
                      ))}
                    </div>}
              </td>
              <td className="px-2 py-2 text-neutral-700">{d.current_registration ?? <span className="text-neutral-400">—</span>}</td>
              <td className="px-2 py-2 text-neutral-700">{d.phone ?? <span className="text-neutral-400">—</span>}</td>
              <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                {d.online ? (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Online</span>
                    <button type="button" disabled={busy === d.id} onClick={() => logOff(d.id, `${d.first_name} ${d.last_name}`)}
                      className="inline-flex items-center gap-1 rounded-md border border-neutral-200 px-2 py-1 text-[11px] font-medium text-neutral-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600">
                      <LogOut size={12} />Log off
                    </button>
                  </div>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-500"><span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />Offline</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
