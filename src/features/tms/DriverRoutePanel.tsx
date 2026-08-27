import { useEffect, useState } from 'react'
import { ChevronUp, ChevronDown, RefreshCw, X, Flag, Check, Clock, Plus } from 'lucide-react'
import type { DriverRoute, RouteStop } from './dispatchRouteApi'
import { fetchDriverActivityToday, type DriverActivity } from './driverActivityApi'

type Props = {
  driverId?: string | null
  driverName?: string | null
  route: DriverRoute | null
  loading: boolean
  removed?: RouteStop[]
  returnToDepot?: boolean
  onRefresh: () => void
  onReorder: (keys: string[]) => void
  onRemove?: (stop: RouteStop) => void
  onRestore?: (key: string) => void
  onToggleDepot?: () => void
  onClose: () => void
}

const fmtClock = (input: number | string) =>
  new Date(input).toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Pacific/Auckland' })
const fmtMin = (sec: number) => `${Math.round(sec / 60)} min`
const fmtKm = (m: number) => `${(m / 1000).toFixed(1)} km`

const KIND_DOT: Record<DriverActivity['kind'], string> = {
  assigned: 'bg-[#0A2472]',
  unassigned: 'bg-neutral-400',
  pickup: 'bg-[#0F7A4E]',
  delivery: 'bg-[#B0264A]',
  status: 'bg-amber-500',
  other: 'bg-neutral-400',
}

export default function DriverRoutePanel({
  driverId, driverName, route, loading, removed = [], returnToDepot = true,
  onRefresh, onReorder, onRemove, onRestore, onToggleDepot, onClose,
}: Props) {
  const [tab, setTab] = useState<'route' | 'history'>('route')
  const [activity, setActivity] = useState<DriverActivity[]>([])
  const [actLoading, setActLoading] = useState(false)
  const [actNonce, setActNonce] = useState(0)

  const stops = route?.stops ?? []
  const doneCount = route?.doneCount ?? 0

  useEffect(() => {
    if (tab !== 'history' || !driverId) return
    let alive = true
    setActLoading(true)
    fetchDriverActivityToday(driverId)
      .then((rows) => { if (alive) setActivity(rows) })
      .catch(() => { if (alive) setActivity([]) })
      .finally(() => { if (alive) setActLoading(false) })
    return () => { alive = false }
  }, [tab, driverId, actNonce])

  // reorder is restricted to pending stops (completed ones stay fixed, first)
  function move(i: number, dir: -1 | 1) {
    const j = i + dir
    if (i < doneCount || j < doneCount || j >= stops.length) return
    const next = [...stops]
    ;[next[i], next[j]] = [next[j], next[i]]
    onReorder(next.map((s) => s.key))
  }

  function refresh() {
    if (tab === 'history') setActNonce((n) => n + 1)
    else onRefresh()
  }

  return (
    <div className="absolute bottom-3 left-3 z-10 flex max-h-[70%] w-72 flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white/95 shadow-lg backdrop-blur">
      <div className="flex items-center justify-between border-b border-neutral-100 px-3 py-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-[#0A2472]">{driverName || 'Driver'}</div>
          {tab === 'route' && route && stops.length > 0 && (
            <div className="text-[11px] text-neutral-500">
              {fmtKm(route.totalM)} · {fmtMin(route.totalSec)}{route.backToDepot ? ` · back ${fmtClock(route.backToDepot.etaMs)}` : ''}
            </div>
          )}
          {tab === 'history' && <div className="text-[11px] text-neutral-500">Today’s activity</div>}
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={refresh} title="Refresh" disabled={loading || actLoading}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 disabled:opacity-40">
            <RefreshCw size={14} className={(tab === 'history' ? actLoading : loading) ? 'animate-spin' : ''} />
          </button>
          <button type="button" onClick={onClose} title="Close" className="inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100">
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-neutral-100 px-2 py-1.5">
        {(['route', 'history'] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${tab === t ? 'bg-[#0A2472]/[0.08] text-[#0A2472]' : 'text-neutral-500 hover:text-neutral-800'}`}>
            {t === 'route' ? 'Route' : 'History'}
          </button>
        ))}
      </div>

      {tab === 'route' ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {loading && stops.length === 0 && <p className="px-2 py-3 text-sm text-neutral-400">Calculating route…</p>}
          {!loading && stops.length === 0 && <p className="px-2 py-3 text-sm text-neutral-400">No mapped stops for this driver.</p>}

          {stops.map((s, i) => {
            const firstPending = i === doneCount
            const hasConnector = i < stops.length - 1 || returnToDepot
            return (
              <div key={s.key} className={`flex gap-2.5 ${s.done ? 'opacity-60' : ''}`}>
                <div className="flex flex-col items-center">
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white ${s.done ? 'bg-neutral-400' : s.type === 'pickup' ? 'bg-[#0F7A4E]' : 'bg-[#B0264A]'}`}>
                    {s.done ? <Check size={13} /> : s.seq}
                  </span>
                  {hasConnector && <span className="my-0.5 w-px flex-1 bg-neutral-200" />}
                </div>
                <div className="min-w-0 flex-1 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{s.consignmentNo ?? s.company ?? '—'}</div>
                      <div className="truncate text-[11px] text-neutral-500">{s.type === 'pickup' ? 'Pickup' : 'Delivery'} · {s.company ?? ''}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <span className="text-[11px] font-medium text-neutral-600">{s.done ? 'Done' : s.etaMs ? fmtClock(s.etaMs) : '—'}</span>
                      {!s.done && (
                        <>
                          <span className="flex flex-col">
                            <button type="button" onClick={() => move(i, -1)} disabled={firstPending} className="text-neutral-400 hover:text-[#0A2472] disabled:opacity-30"><ChevronUp size={14} /></button>
                            <button type="button" onClick={() => move(i, 1)} disabled={i === stops.length - 1} className="text-neutral-400 hover:text-[#0A2472] disabled:opacity-30"><ChevronDown size={14} /></button>
                          </span>
                          <button type="button" onClick={() => onRemove?.(s)} title="Remove from plan" className="text-neutral-300 hover:text-[#B0264A]"><X size={14} /></button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          {stops.length > 0 && returnToDepot && route?.backToDepot && (
            <div className="flex gap-2.5">
              <div className="flex flex-col items-center">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-300 text-white"><Flag size={12} /></span>
              </div>
              <div className="min-w-0 flex-1 pb-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-neutral-600">Depot</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] font-medium text-neutral-600">{fmtClock(route.backToDepot.etaMs)}</span>
                    <button type="button" onClick={() => onToggleDepot?.()} title="Don’t return to depot" className="text-neutral-300 hover:text-[#B0264A]"><X size={14} /></button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {stops.length > 0 && !returnToDepot && (
            <div className="mt-1 flex items-center justify-between border-t border-neutral-100 px-1.5 pt-2 text-[11px] text-neutral-400">
              <span>Ends at last stop</span>
              <button type="button" onClick={() => onToggleDepot?.()} className="inline-flex items-center gap-1 font-medium text-[#0A2472] hover:underline"><Plus size={12} />Return to depot</button>
            </div>
          )}

          {removed.length > 0 && (
            <div className="mt-2 border-t border-neutral-100 pt-2">
              <div className="px-1.5 pb-1 text-[10px] font-medium uppercase tracking-wide text-neutral-400">Removed</div>
              {removed.map((s) => (
                <div key={s.key} className="flex items-center justify-between px-1.5 py-1">
                  <span className="min-w-0 truncate text-[11px] text-neutral-400 line-through">{s.consignmentNo ?? s.company ?? '—'} · {s.type === 'pickup' ? 'Pickup' : 'Delivery'}</span>
                  <button type="button" onClick={() => onRestore?.(s.key)} title="Add back to plan" className="shrink-0 text-neutral-400 hover:text-[#0F7A4E]"><Plus size={14} /></button>
                </div>
              ))}
            </div>
          )}

          {route && stops.length > 0 && (
            <div className="mt-2 border-t border-neutral-100 px-1.5 pt-2 text-[10px] text-neutral-400">
              {route.fixedOrder ? 'Manual order' : route.optimized ? 'Optimised order' : 'Nearest-first order'} · solid = done, dotted = to do
            </div>
          )}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {actLoading && activity.length === 0 && <p className="px-2 py-3 text-sm text-neutral-400">Loading activity…</p>}
          {!actLoading && activity.length === 0 && <p className="px-2 py-3 text-sm text-neutral-400">No activity logged today.</p>}
          {activity.map((a, i) => (
            <div key={a.key} className="flex gap-2.5 px-1.5 py-1.5">
              <div className="flex flex-col items-center">
                <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${KIND_DOT[a.kind]}`} />
                {i < activity.length - 1 && <span className="mt-0.5 w-px flex-1 bg-neutral-200" />}
              </div>
              <div className="min-w-0 flex-1 pb-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-medium">{a.label}</span>
                  <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-neutral-500"><Clock size={11} />{fmtClock(a.at)}</span>
                </div>
                <div className="truncate text-[11px] text-neutral-500">
                  {a.consignmentNo ?? ''}{a.consignmentNo && a.client ? ' · ' : ''}{a.client ?? ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
