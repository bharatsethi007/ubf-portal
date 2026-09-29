import { useEffect, useState } from 'react'
import { supabase } from '../../../../supabase'
import type { PortMap } from '../../../../hooks/usePorts'
import { fetchTrack, type LngLat, type Milestone, type PublicTrack } from '../../../publicTrack/trackApi'
import { greatCircle, placeName } from '../homeModel'
import type { PortalShipmentDetail } from '../../shipment/portalShipmentDetailTypes'

export type PortalTrack = { track: PublicTrack; live: boolean; token: string | null }

const POLL_MS = 60_000

function stageOf(s: PortalShipmentDetail): number {
  const st = (s.status ?? '').toLowerCase()
  if (st.startsWith('arrived')) return 3
  if (st === 'in transit') return 2
  return 1
}

/** Schedule-based view for shipments without live carrier / AIS data yet. */
export function scheduleTrack(s: PortalShipmentDetail, ports: PortMap): PublicTrack {
  const coord = (code: string | null): LngLat | null => {
    const p = code ? ports.get(code) : undefined
    return p ? [p.lng, p.lat] : null
  }
  const o = coord(s.origin)
  const d = coord(s.destination)
  const oName = placeName(s.origin, ports)
  const dName = placeName(s.destination, ports)
  const stage = stageOf(s)
  const dep = s.departed ?? s.etd
  const arr = s.arrived ?? s.eta
  const ms: Milestone[] = [
    { key: 'booked', title: 'Booked with UB Freight', place: null, at: s.doc_date, estimated: false, done: true, current: false, details: [] },
    { key: 'departed', title: 'Departed', place: oName, at: dep, estimated: !s.departed, done: stage >= 2 || Boolean(s.departed), current: false, details: [] },
    { key: 'arrived', title: 'Arrived', place: dName, at: arr, estimated: !s.arrived, done: stage >= 3 || Boolean(s.arrived), current: false, details: [] },
    { key: 'delivered', title: 'Delivered', place: null, at: null, estimated: true, done: false, current: false, details: [] },
  ]
  const next = ms.find((m) => !m.done)
  if (next) next.current = true
  return {
    ref: s.house_bill,
    status: stage >= 3 ? 'arrived' : stage === 2 ? 'sailing' : 'booked',
    origin: { code: s.origin, name: oName, coord: o },
    destination: { code: s.destination, name: dName, coord: d },
    eta: { predicted: s.eta, actual: s.arrived, scheduled: s.eta, delay_hours: null },
    vessel: { name: s.vessel_flight, voyage: null, position: null, speed_kn: null, heading: null, position_at: null, nm_to_go: null },
    containers: [],
    milestones: ms,
    stops: [
      { code: s.origin, name: oName, coord: o, role: 'origin' },
      { code: s.destination, name: dName, coord: d, role: 'destination' },
    ],
    track: [],
    remaining: [],
    planned: o && d ? greatCircle(o, d) : [],
    updated_at: null,
    expires_at: '2099-12-31T00:00:00Z',
  }
}

/** Live tracker data (sea: per ERP consol; else a tracked booking), otherwise the schedule view. */
export function usePortalTrack(s: PortalShipmentDetail | null, ports: PortMap): PortalTrack | null {
  const [state, setState] = useState<PortalTrack | null>(null)

  useEffect(() => {
    if (!s) { setState(null); return }
    let alive = true
    let timer = 0
    const fallback = () => ({ track: scheduleTrack(s, ports), live: false, token: null })
    setState(fallback())

    void (async () => {
      const { data: token } = await supabase.rpc('portal_track_token_v2', { p_job_unique: s.job_unique })
      if (!alive || !token) return
      const load = async (poll: boolean) => {
        const r = await fetchTrack(String(token), poll)
        if (!alive || r.kind !== 'ok') return
        // Consol with nothing live yet: keep the ERP schedule view, but the share link still works.
        if (r.data.live === false) setState({ ...fallback(), token: String(token) })
        else setState({ track: r.data, live: true, token: String(token) })
      }
      await load(false)
      timer = window.setInterval(() => {
        if (document.visibilityState === 'visible') void load(true)
      }, POLL_MS)
    })()

    return () => { alive = false; window.clearInterval(timer) }
  }, [s, ports])

  return state
}
