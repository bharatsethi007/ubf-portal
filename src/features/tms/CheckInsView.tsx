import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { listCheckinQueue, listVariance, type CheckinQueueRow, type VarianceRow } from './checkinApi'
import CheckinVerifyDialog from './CheckinVerifyDialog'

export default function CheckInsView() {
  const [tab, setTab] = useState<'queue' | 'variance'>('queue')
  const [queue, setQueue] = useState<CheckinQueueRow[]>([])
  const [variance, setVariance] = useState<VarianceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [verify, setVerify] = useState<{ id: string; no: string | null } | null>(null)

  const load = () => {
    setLoading(true)
    Promise.all([listCheckinQueue(), listVariance()])
      .then(([q, v]) => { setQueue(q); setVariance(v) })
      .catch(() => {}).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  return (
    <div>
      <div className="mb-1 flex gap-1 border-b border-neutral-200">
        {([['queue', 'Awaiting check-in'], ['variance', 'Variance']] as const).map(([k, label]) => {
          const on = tab === k
          return (
            <button key={k} type="button" onClick={() => setTab(k)}
              className={`relative px-3 py-2 text-[13px] font-medium ${on ? 'text-[#0A2472]' : 'text-neutral-500 hover:text-neutral-800'}`}>
              {label} ({k === 'queue' ? queue.length : variance.length})
              {on && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[#0A2472]" />}
            </button>
          )
        })}
      </div>

      <div className="overflow-x-auto">
        {tab === 'queue' ? (
          <table className="w-full min-w-[720px] text-[13px]">
            <thead><tr className="border-b border-neutral-200 text-left text-[10px] uppercase tracking-wide text-neutral-400">
              <th className="px-3 py-2">Consignment</th><th className="px-3 py-2">Company</th><th className="px-3 py-2">Origin</th><th className="px-3 py-2">Pickup</th><th className="px-3 py-2"></th>
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={5} className="px-3 py-6 text-neutral-400">Loading…</td></tr>
                : queue.length === 0 ? <tr><td colSpan={5} className="px-3 py-6 text-neutral-400">Nothing awaiting check-in.</td></tr>
                : queue.map((r) => (
                  <tr key={r.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                    <td className="px-3 py-2.5 font-medium tabular-nums">{r.consignment_no}</td>
                    <td className="px-3 py-2.5">{r.sender_company ?? '—'}</td>
                    <td className="px-3 py-2.5 text-neutral-600">{r.sender_address ?? '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">{r.preferred_pickup_at ? format(new Date(r.preferred_pickup_at), 'd MMM, h:mm a') : '—'}</td>
                    <td className="px-3 py-2.5 text-right"><button type="button" onClick={() => setVerify({ id: r.id, no: r.consignment_no })} className="rounded-lg border border-[#0A2472] px-3 py-1 text-xs font-medium text-[#0A2472] hover:bg-[#0A2472]/[0.04]">Check in</button></td>
                  </tr>
                ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full min-w-[620px] text-[13px]">
            <thead><tr className="border-b border-neutral-200 text-left text-[10px] uppercase tracking-wide text-neutral-400">
              <th className="px-3 py-2">Consignment</th><th className="px-3 py-2">Checked in</th><th className="px-3 py-2 text-right">Old CBM</th><th className="px-3 py-2 text-right">New CBM</th><th className="px-3 py-2 text-right">Δ</th>
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={5} className="px-3 py-6 text-neutral-400">Loading…</td></tr>
                : variance.length === 0 ? <tr><td colSpan={5} className="px-3 py-6 text-neutral-400">No checked-in pickups yet.</td></tr>
                : variance.map((r) => {
                  const delta = +(r.new_cbm - r.old_cbm).toFixed(4)
                  const pct = r.old_cbm ? Math.round((delta / r.old_cbm) * 100) : 0
                  const cls = delta > 0 ? 'text-red-600' : delta < 0 ? 'text-emerald-600' : 'text-neutral-400'
                  return (
                    <tr key={r.consignment_id} className="border-b border-neutral-100 hover:bg-neutral-50">
                      <td className="px-3 py-2.5 font-medium tabular-nums">{r.consignment_no}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">{format(new Date(r.wms_checkin_at), 'd MMM, h:mm a')}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{r.old_cbm.toFixed(4)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{r.new_cbm.toFixed(4)}</td>
                      <td className={`px-3 py-2.5 text-right font-medium tabular-nums ${cls}`}>{delta > 0 ? '+' : ''}{delta.toFixed(4)}{delta !== 0 ? ` (${pct > 0 ? '+' : ''}${pct}%)` : ''}</td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        )}
      </div>

      <CheckinVerifyDialog consignmentId={verify?.id ?? null} consignmentNo={verify?.no ?? null} onClose={() => setVerify(null)} onDone={() => { setVerify(null); load() }} />
    </div>
  )
}
