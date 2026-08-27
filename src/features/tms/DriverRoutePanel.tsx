import { ChevronUp, ChevronDown, RefreshCw, X, Flag, Check } from 'lucide-react'
import type { DriverRoute } from './dispatchRouteApi'

type Props = {
  driverName?: string | null
  route: DriverRoute | null
  loading: boolean
  onRefresh: () => void
  onReorder: (keys: string[]) => void
  onClose: () => void
}

const fmtTime = (ms: number) =>
  new Date(ms).toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Pacific/Auckland' })
const fmtMin = (sec: number) => `${Math.round(sec / 60)} min`
const fmtKm = (m: number) => `${(m / 1000).toFixed(1)} km`

export default function DriverRoutePanel({ driverName, route, loading, onRefresh, onReorder, onClose }: Props) {
  const stops = route?.stops ?? []
  const doneCount = route?.doneCount ?? 0

  // reorder is restricted to pending stops (completed ones stay fixed, first)
  function move(i: number, dir: -1 | 1) {
    const j = i + dir
    if (i < doneCount || j < doneCount || j >= stops.length) return
    const next = [...stops]
    ;[next[i], next[j]] = [next[j], next[i]]
    onReorder(next.map((s) => s.key))
  }

  return (
    <div className="absolute bottom-3 left-3 z-10 flex max-h-[70%] w-72 flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white/95 shadow-lg backdrop-blur">
      <div className="flex items-center justify-between border-b border-neutral-100 px-3 py-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-[#0A2472]">{driverName || 'Driver route'}</div>
          {route && stops.length > 0 && (
            <div className="text-[11px] text-neutral-500">
              {fmtKm(route.totalM)} · {fmtMin(route.totalSec)} · back {fmtTime(route.backToDepot.etaMs)}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={onRefresh} title="Refresh ETA" disabled={loading}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 disabled:opacity-40">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button type="button" onClick={onClose} title="Close" className="inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100">
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {loading && stops.length === 0 && <p className="px-2 py-3 text-sm text-neutral-400">Calculating route…</p>}
        {!loading && stops.length === 0 && <p className="px-2 py-3 text-sm text-neutral-400">No mapped stops for this driver.</p>}

        {stops.map((s, i) => {
          const firstPending = i === doneCount
          return (
            <div key={s.key} className={`flex items-center gap-2 rounded-lg px-1.5 py-1.5 ${s.done ? 'opacity-60' : 'hover:bg-neutral-50'}`}>
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white ${s.done ? 'bg-neutral-400' : s.type === 'pickup' ? 'bg-[#0F7A4E]' : 'bg-[#B0264A]'}`}>
                {s.done ? <Check size={13} /> : s.seq}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{s.consignmentNo ?? s.company ?? '—'}</span>
                <span className="block truncate text-[11px] text-neutral-500">{s.type === 'pickup' ? 'Pickup' : 'Delivery'} · {s.company ?? ''}</span>
              </span>
              <span className="shrink-0 text-[11px] font-medium text-neutral-600">{s.done ? 'Done' : s.etaMs ? fmtTime(s.etaMs) : '—'}</span>
              {!s.done && (
                <span className="flex shrink-0 flex-col">
                  <button type="button" onClick={() => move(i, -1)} disabled={firstPending} className="text-neutral-400 hover:text-[#0A2472] disabled:opacity-30"><ChevronUp size={14} /></button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === stops.length - 1} className="text-neutral-400 hover:text-[#0A2472] disabled:opacity-30"><ChevronDown size={14} /></button>
                </span>
              )}
            </div>
          )
        })}

        {route && stops.length > 0 && (
          <div className="mt-1 flex items-center gap-2 border-t border-neutral-100 px-1.5 pt-2 text-[11px] text-neutral-500">
            <Flag size={13} className="shrink-0 text-neutral-400" />
            Depot · {fmtTime(route.backToDepot.etaMs)}
          </div>
        )}
      </div>

      {route && stops.length > 0 && (
        <div className="border-t border-neutral-100 px-3 py-1.5 text-[10px] text-neutral-400">
          {route.fixedOrder ? 'Manual order' : route.optimized ? 'Optimised order' : 'Nearest-first order'} · solid = done, dotted = to do
        </div>
      )}
    </div>
  )
}
