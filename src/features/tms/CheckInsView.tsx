import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Package, Truck, Plus } from 'lucide-react'
import { listCheckinQueue, listVariance, listCompletedSheets, type CheckinQueueRow, type VarianceRow, type CompletedSheet } from './checkinApi'
import CheckInSheetForm from './CheckInSheetForm'

type Top = 'queue' | 'completed' | 'variance'

export default function CheckInsView() {
  const [tab, setTab] = useState<Top>('queue')
  const [bucket, setBucket] = useState<'ubf' | 'third'>('ubf')
  const [queue, setQueue] = useState<CheckinQueueRow[]>([])
  const [variance, setVariance] = useState<VarianceRow[]>([])
  const [completed, setCompleted] = useState<CompletedSheet[]>([])
  const [loading, setLoading] = useState(true)
  const [sheet, setSheet] = useState<{ open: boolean; consignmentId: string | null; sheetId: string | null }>({ open: false, consignmentId: null, sheetId: null })

  const load = () => {
    setLoading(true)
    Promise.all([listCheckinQueue(), listVariance(), listCompletedSheets(bucket)])
      .then(([q, v, c]) => { setQueue(q); setVariance(v); setCompleted(c) })
      .catch(() => {}).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [bucket])

  const topTabs: { key: Top; label: string; count: number }[] = [
    { key: 'queue', label: 'Awaiting check-in', count: queue.length },
    { key: 'completed', label: 'Completed', count: completed.length },
    { key: 'variance', label: 'Variance', count: variance.length },
  ]

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 border-b border-neutral-200">
          {topTabs.map(({ key, label, count }) => {
            const on = tab === key
            return (
              <button key={key} type="button" onClick={() => setTab(key)}
                className={`relative px-3 py-2 text-[13px] font-medium ${on ? 'text-[#0A2472]' : 'text-neutral-500 hover:text-neutral-800'}`}>
                {label} ({count}){on && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[#0A2472]" />}
              </button>
            )
          })}
        </div>
        <button type="button" onClick={() => setSheet({ open: true, consignmentId: null, sheetId: null })} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0A2472] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0A2472]/90"><Plus size={16} /> New check-in</button>
      </div>

      {tab === 'queue' && (
        <div className="overflow-x-auto">
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
                    <td className="px-3 py-2.5 text-right"><button type="button" onClick={() => setSheet({ open: true, consignmentId: r.id, sheetId: null })} className="rounded-lg border border-[#0A2472] px-3 py-1 text-xs font-medium text-[#0A2472] hover:bg-[#0A2472]/[0.04]">Check in</button></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'completed' && (
        <div>
          <div className="my-3 inline-flex rounded-lg border border-neutral-200 p-0.5">
            {([['ubf', 'UBF', Truck], ['third', '3rd Party', Package]] as const).map(([k, label, Icon]) => {
              const on = bucket === k
              return (
                <button key={k} type="button" onClick={() => setBucket(k)}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-[13px] font-medium ${on ? 'bg-[#0A2472]/[0.06] text-[#0A2472]' : 'text-neutral-500 hover:text-neutral-800'}`}>
                  <Icon size={14} /> {label}
                </button>
              )
            })}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-[13px]">
              <thead><tr className="border-b border-neutral-200 text-left text-[10px] uppercase tracking-wide text-neutral-400">
                <th className="px-3 py-2">Sheet</th><th className="px-3 py-2">Consignment</th><th className="px-3 py-2">Shipper</th><th className="px-3 py-2">Consignee</th><th className="px-3 py-2">Checked in</th>
              </tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={5} className="px-3 py-6 text-neutral-400">Loading…</td></tr>
                  : completed.length === 0 ? <tr><td colSpan={5} className="px-3 py-6 text-neutral-400">No {bucket === 'ubf' ? 'UBF' : '3rd-party'} check-ins yet.</td></tr>
                  : completed.map((s) => (
                    <tr key={s.id} onClick={() => setSheet({ open: true, consignmentId: null, sheetId: s.id })} className="cursor-pointer border-b border-neutral-100 hover:bg-neutral-50">
                      <td className="px-3 py-2.5 font-medium tabular-nums">{s.sheet_no}</td>
                      <td className="px-3 py-2.5 tabular-nums">{s.consignment?.consignment_no ?? <span className="text-neutral-300">—</span>}</td>
                      <td className="px-3 py-2.5">{s.shipper_company ?? '—'}</td>
                      <td className="px-3 py-2.5">{s.consignee_company ?? '—'}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">{s.checked_in_at ? format(new Date(s.checked_in_at), 'd MMM, h:mm a') : '—'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'variance' && (
        <div className="overflow-x-auto">
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
        </div>
      )}

      <CheckInSheetForm open={sheet.open} consignmentId={sheet.consignmentId} sheetId={sheet.sheetId} onClose={() => setSheet({ open: false, consignmentId: null, sheetId: null })} onDone={() => { setSheet({ open: false, consignmentId: null, sheetId: null }); load() }} />
    </div>
  )
}
