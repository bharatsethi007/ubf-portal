import { useEffect, useMemo, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { PortMap } from '../../../hooks/usePorts'
import type { AnalyticsLane, HomeShipment, LivePosition } from './usePortalHome'
import ShipmentPeek from './ShipmentPeek'
import {
  fmtDay, greatCircle, legFraction, placeName, pointAt, portCoord, shipmentNo, shortCode, stageLabel, stageTone, type LngLat,
} from './homeModel'

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string
const NAVY = '#0B1A3A'
const ORANGE = '#F7941D'
const BLUE = '#2563EB'
const FONT = ['DIN Pro Medium', 'Arial Unicode MS Regular']

type View = 'active' | 'lanes'
type Selection = { title: string; sub?: string; ids: number[]; focus: number | null } | null

type Props = {
  active: HomeShipment[]
  pool: HomeShipment[]
  lanes: AnalyticsLane[]
  ports: PortMap
  /** Live AIS fixes by job_unique; shipments without one show an estimated position. */
  positions?: Map<number, LivePosition>
}

type Line = GeoJSON.Feature<GeoJSON.LineString>
type Point = GeoJSON.Feature<GeoJSON.Point>
const fc = <T extends GeoJSON.Geometry>(features: GeoJSON.Feature<T>[]): GeoJSON.FeatureCollection<T> => ({ type: 'FeatureCollection', features })

// Mapbox "ant line" dash sequence.
const DASHES: number[][] = [
  [0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0],
  [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5],
]

export default function GlobalMap({ active, pool, lanes, ports, positions }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const vesselMarkers = useRef<mapboxgl.Marker[]>([])
  const [ready, setReady] = useState(false)
  const [view, setView] = useState<View>('lanes')
  const [sel, setSel] = useState<Selection>(null)

  useEffect(() => { setView(active.length >= 3 ? 'active' : 'lanes') }, [active.length])
  useEffect(() => { setSel(null) }, [view])

  const byId = useMemo(() => {
    const m = new Map<number, HomeShipment>()
    for (const s of pool) m.set(s.job_unique, s)
    for (const s of active) m.set(s.job_unique, s)
    return m
  }, [pool, active])

  const data = useMemo(() => {
    const laneMax = Math.max(1, ...lanes.map((l) => l.n))
    const laneLines: Line[] = []
    for (const l of lanes) {
      const a = portCoord(l.origin, ports)
      const b = portCoord(l.destination, ports)
      if (!a || !b) continue
      laneLines.push({ type: 'Feature', properties: { o: l.origin, d: l.destination, n: l.n, w: l.n / laneMax, days: l.transit_days ?? l.sched_days }, geometry: { type: 'LineString', coordinates: greatCircle(a, b) } })
    }

    const activeLines: Line[] = []
    const vessels: { s: HomeShipment; at: LngLat; live: LivePosition | null }[] = []
    for (const s of active) {
      const a = portCoord(s.origin, ports)
      const b = portCoord(s.destination, ports)
      if (!a || !b) continue
      const line = greatCircle(a, b)
      activeLines.push({ type: 'Feature', properties: { id: s.job_unique, stage: s.stage, o: s.origin, d: s.destination }, geometry: { type: 'LineString', coordinates: line } })
      const fix = positions?.get(s.job_unique) ?? null
      if (fix) vessels.push({ s, at: [fix.lng, fix.lat], live: fix })
      else if (s.stage === 2) vessels.push({ s, at: pointAt(line, legFraction(s)), live: null })
    }

    const portPoints = (lines: Line[], weight: (f: Line) => number) => {
      const m = new Map<string, { coord: LngLat; name: string; codes: Set<string>; n: number }>()
      for (const f of lines) {
        const cs = f.geometry.coordinates as LngLat[]
        const ends: [string, LngLat][] = [[String(f.properties?.o), cs[0]], [String(f.properties?.d), cs[cs.length - 1]]]
        for (const [code, coord] of ends) {
          const name = placeName(code, ports)
          const cur = m.get(name) ?? { coord, name, codes: new Set<string>(), n: 0 }
          cur.codes.add(code)
          cur.n += weight(f)
          m.set(name, cur)
        }
      }
      return [...m.values()].map<Point>((p) => ({
        type: 'Feature',
        properties: { name: p.name, n: p.n, codes: [...p.codes].join(','), label: `${p.name}  ${p.n}` },
        geometry: { type: 'Point', coordinates: p.coord },
      }))
    }

    return {
      laneLines,
      activeLines,
      vessels,
      lanePorts: portPoints(laneLines, (f) => Number(f.properties?.n ?? 1)),
      activePorts: portPoints(activeLines, () => 1),
    }
  }, [active, lanes, ports, positions])

  // Latest state for map event handlers registered once.
  const live = useRef({ view, active, pool, ports })
  live.current = { view, active, pool, ports }

  useEffect(() => {
    if (!box.current || !TOKEN) return
    mapboxgl.accessToken = TOKEN
    const map = new mapboxgl.Map({
      container: box.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [160, -15],
      zoom: 1.6,
      projection: 'mercator',
      renderWorldCopies: true,
      attributionControl: false,
      cooperativeGestures: true,
    })
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-left')
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-left')
    mapRef.current = map
    let raf = 0
    let step = -1

    map.on('load', () => {
      map.addSource('lanes', { type: 'geojson', data: fc([]) })
      map.addSource('active', { type: 'geojson', data: fc([]) })
      map.addSource('ports', { type: 'geojson', data: fc([]) })

      map.addLayer({ id: 'lanes', type: 'line', source: 'lanes', layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': NAVY, 'line-opacity': 0.3, 'line-width': ['interpolate', ['linear'], ['get', 'w'], 0, 1.5, 1, 7] } })
      map.addLayer({ id: 'lanes-hover', type: 'line', source: 'lanes', filter: ['==', ['get', 'o'], '__none__'], layout: { 'line-cap': 'round' },
        paint: { 'line-color': ORANGE, 'line-opacity': 0.9, 'line-width': ['interpolate', ['linear'], ['get', 'w'], 0, 3, 1, 8] } })
      map.addLayer({ id: 'lanes-hit', type: 'line', source: 'lanes', paint: { 'line-color': '#000', 'line-opacity': 0, 'line-width': 16 } })

      map.addLayer({ id: 'active-base', type: 'line', source: 'active', layout: { 'line-cap': 'round' },
        paint: { 'line-color': ['case', ['==', ['get', 'stage'], 2], BLUE, NAVY], 'line-opacity': 0.18, 'line-width': 6 } })
      map.addLayer({ id: 'active-ants', type: 'line', source: 'active',
        paint: { 'line-color': ['case', ['==', ['get', 'stage'], 2], BLUE, ORANGE], 'line-width': 2.5, 'line-dasharray': [0, 4, 3] } })
      map.addLayer({ id: 'active-hover', type: 'line', source: 'active', filter: ['==', ['get', 'id'], -1], layout: { 'line-cap': 'round' },
        paint: { 'line-color': ORANGE, 'line-width': 5 } })
      map.addLayer({ id: 'active-hit', type: 'line', source: 'active', paint: { 'line-color': '#000', 'line-opacity': 0, 'line-width': 16 } })

      map.addLayer({ id: 'ports-halo', type: 'circle', source: 'ports',
        paint: { 'circle-radius': ['interpolate', ['linear'], ['sqrt', ['get', 'n']], 1, 9, 14, 20], 'circle-color': NAVY, 'circle-opacity': 0.12 } })
      map.addLayer({ id: 'ports-dot', type: 'circle', source: 'ports',
        paint: { 'circle-radius': 5, 'circle-color': '#FFFFFF', 'circle-stroke-color': NAVY, 'circle-stroke-width': 2.5 } })
      map.addLayer({ id: 'ports-label', type: 'symbol', source: 'ports',
        layout: {
          'text-field': ['get', 'label'], 'text-font': FONT, 'text-size': 12, 'text-anchor': 'left', 'text-offset': [0.9, 0],
          'text-allow-overlap': false, 'text-optional': true, 'symbol-sort-key': ['-', 0, ['get', 'n']],
        },
        paint: { 'text-color': NAVY, 'text-halo-color': '#FFFFFF', 'text-halo-width': 2 } })

      const pointer = (on: boolean) => { map.getCanvas().style.cursor = on ? 'pointer' : '' }
      for (const id of ['active-hit', 'lanes-hit', 'ports-dot', 'ports-halo']) {
        map.on('mouseenter', id, () => pointer(true))
        map.on('mouseleave', id, () => pointer(false))
      }
      map.on('mousemove', 'active-hit', (e) => {
        const id = Number(e.features?.[0]?.properties?.id)
        map.setFilter('active-hover', ['==', ['get', 'id'], Number.isFinite(id) ? id : -1])
      })
      map.on('mouseleave', 'active-hit', () => map.setFilter('active-hover', ['==', ['get', 'id'], -1]))
      map.on('mousemove', 'lanes-hit', (e) => {
        const p = e.features?.[0]?.properties
        map.setFilter('lanes-hover', ['all', ['==', ['get', 'o'], p?.o ?? ''], ['==', ['get', 'd'], p?.d ?? '']])
      })
      map.on('mouseleave', 'lanes-hit', () => map.setFilter('lanes-hover', ['==', ['get', 'o'], '__none__']))

      map.on('click', (e) => {
        const L = live.current
        const hits = map.queryRenderedFeatures(e.point, { layers: ['ports-dot', 'ports-halo', 'active-hit', 'lanes-hit'] })
        if (!hits.length) return
        const f = hits[0]
        const p = f.properties ?? {}
        const layer = f.layer?.id ?? ''
        if (layer.startsWith('ports')) {
          const codes = String(p.codes ?? '').split(',')
          const list = (L.view === 'active' ? L.active : L.pool).filter((s) => codes.includes(s.origin ?? '') || codes.includes(s.destination ?? ''))
          setSel({ title: String(p.name), sub: `${list.length} ${L.view === 'active' ? 'active' : 'recent'} ${list.length === 1 ? 'shipment' : 'shipments'}`, ids: list.slice(0, 40).map((s) => s.job_unique), focus: list.length === 1 ? list[0].job_unique : null })
        } else if (layer === 'active-hit') {
          const id = Number(p.id)
          setSel({ title: 'Shipment', ids: [id], focus: id })
        } else if (layer === 'lanes-hit') {
          const list = L.pool.filter((s) => s.origin === p.o && s.destination === p.d)
          const days = p.days != null && p.days !== 'null' ? `${Math.round(Number(p.days))} d avg transit` : ''
          setSel({
            title: `${placeName(String(p.o), L.ports)} to ${placeName(String(p.d), L.ports)}`,
            sub: [`${p.n} shipments in 12 months`, days].filter(Boolean).join(' · '),
            ids: list.slice(0, 40).map((s) => s.job_unique),
            focus: null,
          })
        }
      })

      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      const animate = (t: number) => {
        const s = Math.floor((t / 60) % DASHES.length)
        if (s !== step && map.getLayer('active-ants')) {
          map.setPaintProperty('active-ants', 'line-dasharray', DASHES[s])
          step = s
        }
        raf = requestAnimationFrame(animate)
      }
      if (!reduce) raf = requestAnimationFrame(animate)
      setReady(true)
    })

    return () => {
      cancelAnimationFrame(raf)
      vesselMarkers.current.forEach((m) => m.remove())
      map.remove()
      mapRef.current = null
      setReady(false)
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const lanesView = view === 'lanes'
    ;(map.getSource('lanes') as mapboxgl.GeoJSONSource).setData(fc(lanesView ? data.laneLines : []))
    ;(map.getSource('active') as mapboxgl.GeoJSONSource).setData(fc(lanesView ? [] : data.activeLines))
    ;(map.getSource('ports') as mapboxgl.GeoJSONSource).setData(fc(lanesView ? data.lanePorts : data.activePorts))

    vesselMarkers.current.forEach((m) => m.remove())
    vesselMarkers.current = []
    if (!lanesView) {
      for (const v of data.vessels) {
        const el = document.createElement('button')
        el.type = 'button'
        el.className = v.live ? 'pv3-vessel pv3-vessel--live' : 'pv3-vessel'
        el.title = v.live
          ? `${shipmentNo(v.s)} · ${v.live.ship_name ?? 'vessel'}${v.live.speed_kn != null ? ` · ${Math.round(v.live.speed_kn * 10) / 10} kn` : ''} · live AIS`
          : `${shipmentNo(v.s)} · estimated position`
        if (v.live?.heading != null) el.style.setProperty('--hdg', `${v.live.heading}deg`)
        el.setAttribute('aria-label', `Shipment ${shipmentNo(v.s)}`)
        el.addEventListener('click', (ev) => {
          ev.stopPropagation()
          setSel({ title: 'Shipment', ids: [v.s.job_unique], focus: v.s.job_unique })
        })
        vesselMarkers.current.push(new mapboxgl.Marker({ element: el }).setLngLat(v.at).addTo(map))
      }
    }

    const lines = lanesView ? data.laneLines : data.activeLines
    const pts = lines.flatMap((f) => f.geometry.coordinates as LngLat[])
    if (pts.length) {
      const b = new mapboxgl.LngLatBounds(pts[0], pts[0])
      for (const p of pts) b.extend(p)
      map.fitBounds(b, { padding: { top: 70, bottom: 50, left: 290, right: 70 }, maxZoom: 5, duration: 1100 })
    }
  }, [ready, view, data])

  if (!TOKEN) return <div className="pv3-map pv3-map--empty">Map unavailable. Mapbox token missing on this site.</div>

  const count = view === 'lanes'
    ? `${lanes.reduce((n, l) => n + l.n, 0)} shipments on ${lanes.length} lanes · 12 months`
    : `${active.length} active · ${data.vessels.length} in transit`

  const shipsInSel = sel ? sel.ids.map((id) => byId.get(id)).filter((s): s is HomeShipment => Boolean(s)) : []
  const focused = sel?.focus != null ? byId.get(sel.focus) ?? null : null

  return (
    <div className="pv3-map">
      <div ref={box} className="pv3-map__canvas" />
      <div className="pv3-map__panel">
        <div className="pv3-map__title">Your network</div>
        <div className="pv3-seg" role="group" aria-label="Map view">
          <button type="button" className={view === 'active' ? 'pv3-seg__on' : ''} onClick={() => setView('active')}>Active now</button>
          <button type="button" className={view === 'lanes' ? 'pv3-seg__on' : ''} onClick={() => setView('lanes')}>Trade lanes</button>
        </div>
        <div className="pv3-map__meta">{count}</div>
        <div className="pv3-legend">
          {view === 'active' ? (
            <>
              <span><i className="pv3-legend__line pv3-legend__line--blue" />In transit</span>
              <span><i className="pv3-legend__line pv3-legend__line--orange" />Booked or arrived</span>
              {data.vessels.some((v) => v.live) && <span><i className="pv3-legend__dot pv3-legend__dot--live" />Live vessel (AIS)</span>}
              <span><i className="pv3-legend__dot" />Estimated position</span>
            </>
          ) : (
            <span><i className="pv3-legend__line pv3-legend__line--navy" />Line weight = volume</span>
          )}
        </div>
        <div className="pv3-map__hint">Click a route or port for details</div>
      </div>

      {sel && (
        <aside className="pv3-drawer" aria-label="Map selection">
          {focused ? (
            <div className="pv3-drawer__body">
              {sel.ids.length > 1 && (
                <button type="button" className="pv3-textbtn pv3-drawer__back" onClick={() => setSel({ ...sel, focus: null })}>
                  <ChevronLeft size={14} /> {sel.title}
                </button>
              )}
              <ShipmentPeek s={focused} ports={ports} onClose={() => setSel(null)} />
            </div>
          ) : (
            <>
              <header className="pv3-drawer__head">
                <div>
                  <div className="pv3-drawer__title">{sel.title}</div>
                  {sel.sub && <div className="pv3-drawer__sub">{sel.sub}</div>}
                </div>
                <button type="button" className="pv3-iconbtn" aria-label="Close" onClick={() => setSel(null)}><X size={16} /></button>
              </header>
              <ul className="pv3-drawer__list">
                {shipsInSel.length === 0 && <li className="pv3-muted pv3-drawer__empty">No shipments on this lane in the last 5 months.</li>}
                {shipsInSel.map((s, i) => (
                  <li key={s.job_unique} style={{ animationDelay: `${i * 0.03}s` }}>
                    <button type="button" className="pv3-drawer__row" onClick={() => setSel({ ...sel, focus: s.job_unique })}>
                      <span className="pv3-drawer__rowmain">
                        <span className="pv3-mono pv3-strong">{shipmentNo(s)}</span>
                        <span className="pv3-drawer__rowsub">{shortCode(s.origin)} → {shortCode(s.destination)} · ETA {fmtDay(s.arrived ?? s.eta)}</span>
                      </span>
                      <span className={`pv3-pill pv3-pill--${stageTone(s)}`}>{stageLabel(s)}</span>
                      <ChevronRight size={14} className="pv3-drawer__chev" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>
      )}
    </div>
  )
}
