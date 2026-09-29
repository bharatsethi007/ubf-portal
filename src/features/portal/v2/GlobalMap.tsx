import { useEffect, useMemo, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { PortMap } from '../../../hooks/usePorts'
import type { AnalyticsLane, HomeShipment } from './usePortalHome'
import { greatCircle, legFraction, placeName, pointAt, portCoord, shipmentNo, type LngLat } from './homeModel'

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string
const NAVY = '#0B1A3A'
const ORANGE = '#F7941D'
const BLUE = '#2563EB'

type View = 'active' | 'lanes'

type Props = {
  active: HomeShipment[]
  lanes: AnalyticsLane[]
  ports: PortMap
  onOpen: (s: HomeShipment) => void
}

type FC = GeoJSON.FeatureCollection<GeoJSON.LineString>

function fc(features: GeoJSON.Feature<GeoJSON.LineString>[]): FC {
  return { type: 'FeatureCollection', features }
}

// Mapbox "ant line" dash sequence.
const DASHES: number[][] = [
  [0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0],
  [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5],
]

export default function GlobalMap({ active, lanes, ports, onOpen }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markers = useRef<mapboxgl.Marker[]>([])
  const [ready, setReady] = useState(false)
  const [view, setView] = useState<View>('lanes')

  // Busy accounts open on live shipments; quieter ones open on their trade lanes.
  useEffect(() => { setView(active.length >= 3 ? 'active' : 'lanes') }, [active.length])

  const data = useMemo(() => {
    const laneMax = Math.max(1, ...lanes.map((l) => l.n))
    const laneFeatures = lanes.flatMap((l) => {
      const a = portCoord(l.origin, ports)
      const b = portCoord(l.destination, ports)
      if (!a || !b) return []
      return [{ type: 'Feature' as const, properties: { w: l.n / laneMax, n: l.n, o: placeName(l.origin, ports), d: placeName(l.destination, ports) }, geometry: { type: 'LineString' as const, coordinates: greatCircle(a, b) } }]
    })

    const activeFeatures: GeoJSON.Feature<GeoJSON.LineString>[] = []
    const vessels: { s: HomeShipment; at: LngLat }[] = []
    const portCounts = new Map<string, { coord: LngLat; name: string; out: number; in: number }>()
    for (const s of active) {
      const a = portCoord(s.origin, ports)
      const b = portCoord(s.destination, ports)
      if (!a || !b) continue
      const line = greatCircle(a, b)
      activeFeatures.push({ type: 'Feature', properties: { stage: s.stage }, geometry: { type: 'LineString', coordinates: line } })
      if (s.stage === 2) vessels.push({ s, at: pointAt(line, legFraction(s)) })
      for (const [code, coord, dir] of [[s.origin, line[0], 'out'], [s.destination, line[line.length - 1], 'in']] as const) {
        const key = placeName(code, ports)
        const cur = portCounts.get(key) ?? { coord: coord as LngLat, name: key, out: 0, in: 0 }
        cur[dir]++
        portCounts.set(key, cur)
      }
    }

    const lanePorts = new Map<string, { coord: LngLat; name: string; n: number }>()
    for (const f of laneFeatures) {
      const cs = f.geometry.coordinates as LngLat[]
      const ends: [string, LngLat][] = [[f.properties.o, cs[0]], [f.properties.d, cs[cs.length - 1]]]
      for (const [name, coord] of ends) {
        const cur = lanePorts.get(name) ?? { coord, name, n: 0 }
        cur.n += f.properties.n
        lanePorts.set(name, cur)
      }
    }

    return { laneFeatures, activeFeatures, vessels, portCounts: [...portCounts.values()], lanePorts: [...lanePorts.values()] }
  }, [active, lanes, ports])

  // init
  useEffect(() => {
    if (!box.current || !TOKEN) return
    mapboxgl.accessToken = TOKEN
    const map = new mapboxgl.Map({
      container: box.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [160, -20],
      zoom: 1.6,
      projection: 'mercator',
      renderWorldCopies: true,
      attributionControl: false,
      cooperativeGestures: true,
    })
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right')
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right')
    mapRef.current = map
    let raf = 0
    let step = -1
    map.on('load', () => {
      map.addSource('lanes', { type: 'geojson', data: fc([]) })
      map.addSource('active', { type: 'geojson', data: fc([]) })
      map.addLayer({
        id: 'lanes', type: 'line', source: 'lanes',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': NAVY, 'line-opacity': 0.28, 'line-width': ['interpolate', ['linear'], ['get', 'w'], 0, 1.2, 1, 6] },
      })
      map.addLayer({
        id: 'active-base', type: 'line', source: 'active',
        layout: { 'line-cap': 'round' },
        paint: { 'line-color': ['case', ['==', ['get', 'stage'], 2], BLUE, NAVY], 'line-opacity': 0.25, 'line-width': 5 },
      })
      map.addLayer({
        id: 'active-ants', type: 'line', source: 'active',
        paint: { 'line-color': ['case', ['==', ['get', 'stage'], 2], BLUE, ORANGE], 'line-width': 2.5, 'line-dasharray': [0, 4, 3] },
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
      markers.current.forEach((m) => m.remove())
      map.remove()
      mapRef.current = null
      setReady(false)
    }
  }, [])

  // data + view
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const showLanes = view === 'lanes'
    ;(map.getSource('lanes') as mapboxgl.GeoJSONSource).setData(fc(showLanes ? data.laneFeatures : []))
    ;(map.getSource('active') as mapboxgl.GeoJSONSource).setData(fc(showLanes ? [] : data.activeFeatures))

    markers.current.forEach((m) => m.remove())
    markers.current = []

    const pts: LngLat[] = []
    const portList = showLanes
      ? data.lanePorts.map((p) => ({ coord: p.coord, name: p.name, label: `${p.n}` }))
      : data.portCounts.map((p) => ({ coord: p.coord, name: p.name, label: `${p.in + p.out}` }))
    for (const p of portList) {
      const el = document.createElement('div')
      el.className = 'pv3-port'
      el.innerHTML = `<span class="pv3-port__dot"></span><span class="pv3-port__label"><b></b><i></i></span>`
      ;(el.querySelector('b') as HTMLElement).textContent = p.name
      ;(el.querySelector('i') as HTMLElement).textContent = p.label
      markers.current.push(new mapboxgl.Marker({ element: el, anchor: 'left', offset: [-6, 0] }).setLngLat(p.coord).addTo(map))
      pts.push(p.coord)
    }
    if (!showLanes) {
      for (const v of data.vessels) {
        const el = document.createElement('button')
        el.type = 'button'
        el.className = 'pv3-vessel'
        el.title = `${shipmentNo(v.s)} · estimated position`
        el.setAttribute('aria-label', `Open shipment ${shipmentNo(v.s)}`)
        el.addEventListener('click', () => onOpen(v.s))
        markers.current.push(new mapboxgl.Marker({ element: el }).setLngLat(v.at).addTo(map))
      }
      for (const f of data.activeFeatures) pts.push(...(f.geometry.coordinates as LngLat[]))
    } else {
      for (const f of data.laneFeatures) pts.push(...(f.geometry.coordinates as LngLat[]))
    }
    if (pts.length) {
      const b = new mapboxgl.LngLatBounds(pts[0], pts[0])
      for (const p of pts) b.extend(p)
      map.fitBounds(b, { padding: { top: 80, bottom: 50, left: 300, right: 80 }, maxZoom: 5, duration: 1200 })
    }
  }, [ready, view, data, onOpen])

  if (!TOKEN) {
    return <div className="pv3-map pv3-map--empty">Map unavailable. Mapbox token missing on this site.</div>
  }

  const counts = view === 'lanes'
    ? `${lanes.reduce((n, l) => n + l.n, 0)} shipments on ${lanes.length} lanes · last 12 months`
    : `${active.length} active · ${data.vessels.length} in transit`

  return (
    <div className="pv3-map">
      <div ref={box} className="pv3-map__canvas" />
      <div className="pv3-map__panel">
        <div className="pv3-map__title">Your network</div>
        <div className="pv3-seg" role="group" aria-label="Map view">
          <button type="button" className={view === 'active' ? 'pv3-seg__on' : ''} onClick={() => setView('active')}>Active now</button>
          <button type="button" className={view === 'lanes' ? 'pv3-seg__on' : ''} onClick={() => setView('lanes')}>Trade lanes</button>
        </div>
        <div className="pv3-map__meta">{counts}</div>
        <div className="pv3-legend">
          {view === 'active' ? (
            <>
              <span><i className="pv3-legend__line pv3-legend__line--blue" />In transit</span>
              <span><i className="pv3-legend__line pv3-legend__line--orange" />Booked / arrived</span>
              <span><i className="pv3-legend__dot" />Estimated position</span>
            </>
          ) : (
            <span><i className="pv3-legend__line pv3-legend__line--navy" />Line weight = volume</span>
          )}
        </div>
      </div>
    </div>
  )
}
