import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { Maximize2, Minimize2 } from 'lucide-react'
import {
  fetchTruckPositions, fetchDispatchJobPins, fetchCompletedJobPins,
  type TruckPosition, type JobPin,
} from './vehicleMapApi'
import { computeDriverRoute, decodePolyline, type DriverRoute, type RouteStop } from './dispatchRouteApi'
import DriverRoutePanel from './DriverRoutePanel'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN as string

type LayerState = { trucks: boolean; pickups: boolean; dropoffs: boolean; completed: boolean; traffic: boolean }
const CHIPS: { key: keyof LayerState; label: string }[] = [
  { key: 'trucks', label: 'Trucks' },
  { key: 'pickups', label: 'Pickups' },
  { key: 'dropoffs', label: 'Drop-offs' },
  { key: 'completed', label: 'Completed' },
  { key: 'traffic', label: 'Traffic' },
]

const TRUCK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="96" viewBox="0 0 64 96">
<ellipse cx="34" cy="52" rx="20" ry="30" fill="#000000" opacity="0.12"/>
<rect x="19" y="29" width="28" height="60" rx="8" fill="#ffffff"/>
<rect x="20" y="30" width="26" height="58" rx="7" fill="#0A2472"/>
<rect x="24" y="35" width="18" height="22" rx="4" fill="#173a8f"/>
<rect x="17" y="6" width="32" height="30" rx="9" fill="#ffffff"/>
<rect x="18" y="7" width="30" height="28" rx="8" fill="#F26A21"/>
<rect x="23" y="10" width="20" height="7" rx="3" fill="#0A2472" opacity="0.85"/>
<rect x="14" y="40" width="5" height="12" rx="2.5" fill="#1f2937"/>
<rect x="47" y="40" width="5" height="12" rx="2.5" fill="#1f2937"/>
<rect x="14" y="66" width="5" height="12" rx="2.5" fill="#1f2937"/>
<rect x="47" y="66" width="5" height="12" rx="2.5" fill="#1f2937"/>
</svg>`
const TRUCK_URL = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(TRUCK_SVG)

function trucksGeo(rows: TruckPosition[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: rows.filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng)).map((r) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        label: r.driver_name ? `${r.registration_number} · ${r.driver_name}` : r.registration_number,
        registration: r.registration_number,
        heading: r.heading ?? 0,
        mins: r.minutes_since ?? 9999,
      },
    })),
  }
}

function pinsGeo(rows: JobPin[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: rows.filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng)).map((r) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: { label: r.consignment_no ?? r.company ?? '', company: r.company ?? '' },
    })),
  }
}

const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }
const STALE_OPACITY: any = ['case', ['<', ['get', 'mins'], 30], 1, ['<', ['get', 'mins'], 180], 0.85, 0.5]
const lineFeature = (coords: [number, number][]): any =>
  coords.length >= 2 ? { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } } : EMPTY_FC

type Props = { routeDriverId?: string | null; driverName?: string | null; onTruckClick?: (registration: string) => void }

export default function TruckMap({ routeDriverId = null, driverName = null, onTruckClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const routeActiveRef = useRef(false)
  const onTruckClickRef = useRef(onTruckClick)
  onTruckClickRef.current = onTruckClick
  const [ready, setReady] = useState(false)
  const [full, setFull] = useState(false)
  const [layers, setLayers] = useState<LayerState>({ trucks: true, pickups: true, dropoffs: true, completed: false, traffic: false })
  const [route, setRoute] = useState<DriverRoute | null>(null)
  const [routeLoading, setRouteLoading] = useState(false)
  const manualOrderRef = useRef<string[] | null>(null)
  const [removed, setRemoved] = useState<RouteStop[]>([])
  const [returnToDepot, setReturnToDepot] = useState(true)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [174.79, -36.94], zoom: 9, minZoom: 3,
      attributionControl: false, dragRotate: false,
    })
    mapRef.current = map
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
    map.on('load', () => {
      map.addSource('trucks', { type: 'geojson', data: trucksGeo([]) })
      map.addSource('pickups', { type: 'geojson', data: pinsGeo([]) })
      map.addSource('dropoffs', { type: 'geojson', data: pinsGeo([]) })
      map.addSource('completed', { type: 'geojson', data: pinsGeo([]) })
      map.addSource('route-done', { type: 'geojson', data: EMPTY_FC })
      map.addSource('route-todo', { type: 'geojson', data: EMPTY_FC })
      map.addSource('route-stops', { type: 'geojson', data: EMPTY_FC })
      map.addSource('mapbox-traffic', { type: 'vector', url: 'mapbox://mapbox.mapbox-traffic-v1' })

      map.addLayer({
        id: 'traffic', type: 'line', source: 'mapbox-traffic', 'source-layer': 'traffic',
        layout: { visibility: 'none' },
        paint: { 'line-width': 2.5, 'line-color': ['match', ['get', 'congestion'], 'low', '#37A24A', 'moderate', '#F2A93B', 'heavy', '#E24A3B', 'severe', '#A11423', '#9CA3AF'] },
      })

      // done run = solid orange (white casing); to-do run = dotted red
      map.addLayer({ id: 'route-done-casing', type: 'line', source: 'route-done', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 7 } })
      map.addLayer({ id: 'route-done', type: 'line', source: 'route-done', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#F26A21', 'line-width': 4, 'line-opacity': 0.95 } })
      map.addLayer({ id: 'route-todo', type: 'line', source: 'route-todo', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#DC2626', 'line-width': 3, 'line-opacity': 0.9, 'line-dasharray': [1.5, 1.5] } })

      map.addLayer({ id: 'completed-dot', type: 'circle', source: 'completed', layout: { visibility: 'none' }, paint: { 'circle-radius': 8, 'circle-color': '#9CA3AF', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } })
      map.addLayer({ id: 'completed-mark', type: 'symbol', source: 'completed', layout: { visibility: 'none', 'text-field': '✓', 'text-size': 11, 'text-allow-overlap': true, 'text-ignore-placement': true }, paint: { 'text-color': '#ffffff' } })

      map.addLayer({ id: 'pickups-dot', type: 'circle', source: 'pickups', paint: { 'circle-radius': 8, 'circle-color': '#0F7A4E', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } })
      map.addLayer({ id: 'pickups-arrow', type: 'symbol', source: 'pickups', layout: { 'text-field': '↑', 'text-size': 13, 'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'], 'text-allow-overlap': true, 'text-ignore-placement': true }, paint: { 'text-color': '#ffffff' } })

      map.addLayer({ id: 'dropoffs-dot', type: 'circle', source: 'dropoffs', paint: { 'circle-radius': 8, 'circle-color': '#B0264A', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } })
      map.addLayer({ id: 'dropoffs-arrow', type: 'symbol', source: 'dropoffs', layout: { 'text-field': '↓', 'text-size': 13, 'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'], 'text-allow-overlap': true, 'text-ignore-placement': true }, paint: { 'text-color': '#ffffff' } })

      map.addLayer({ id: 'route-stops-dot', type: 'circle', source: 'route-stops', paint: { 'circle-radius': 11, 'circle-color': ['case', ['get', 'done'], '#9CA3AF', ['match', ['get', 'type'], 'pickup', '#0F7A4E', '#B0264A']], 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } })
      map.addLayer({ id: 'route-stops-num', type: 'symbol', source: 'route-stops', layout: { 'text-field': ['get', 'seq'], 'text-size': 12, 'text-allow-overlap': true, 'text-ignore-placement': true }, paint: { 'text-color': '#ffffff' } })

      map.addLayer({ id: 'trucks-label', type: 'symbol', source: 'trucks', layout: { 'text-field': ['get', 'label'], 'text-size': 11, 'text-offset': [0, 1.8], 'text-anchor': 'top' }, paint: { 'text-color': '#0A2472', 'text-halo-color': '#fff', 'text-halo-width': 1.5 } })

      const img = new Image(64, 96)
      img.onload = () => {
        const m = mapRef.current
        if (!m) return
        if (!m.hasImage('ubf-truck')) m.addImage('ubf-truck', img, { pixelRatio: 2 })
        if (!m.getLayer('trucks-icon')) {
          m.addLayer({ id: 'trucks-icon', type: 'symbol', source: 'trucks', layout: { 'icon-image': 'ubf-truck', 'icon-size': 1.1, 'icon-rotate': ['get', 'heading'], 'icon-rotation-alignment': 'map', 'icon-allow-overlap': true }, paint: { 'icon-opacity': STALE_OPACITY } }, 'trucks-label')
          m.on('mouseenter', 'trucks-icon', () => { m.getCanvas().style.cursor = 'pointer' })
          m.on('mouseleave', 'trucks-icon', () => { m.getCanvas().style.cursor = '' })
          m.on('click', 'trucks-icon', (e) => {
            const reg = (e.features?.[0]?.properties as any)?.registration
            if (reg) onTruckClickRef.current?.(String(reg))
          })
        }
      }
      img.src = TRUCK_URL

      const popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false })
      for (const [id, kind] of [['pickups-dot', 'Pickup'], ['dropoffs-dot', 'Drop-off'], ['completed-dot', 'Completed']] as const) {
        map.on('mouseenter', id, (e) => {
          map.getCanvas().style.cursor = 'pointer'
          const f: any = e.features?.[0]
          if (f) popup.setLngLat(e.lngLat).setHTML(`<div style="font:12px system-ui"><b>${kind}</b><br/>${f.properties.label || ''}<br/>${f.properties.company || ''}</div>`).addTo(map)
        })
        map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; popup.remove() })
      }

      const handleTruckClick = (e: mapboxgl.MapLayerMouseEvent) => {
        const reg = (e.features?.[0]?.properties as any)?.registration
        if (reg) onTruckClickRef.current?.(String(reg))
      }
      map.on('click', 'trucks-label', handleTruckClick)
      map.on('mouseenter', 'trucks-label', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'trucks-label', () => { map.getCanvas().style.cursor = '' })

      setReady(true)
    })
    return () => { map.remove(); mapRef.current = null }
  }, [])

  useEffect(() => {
    if (!ready) return
    let active = true
    const load = async () => {
      const map = mapRef.current
      if (!map) return
      try {
        const [trucks, pins, completed] = await Promise.all([fetchTruckPositions(), fetchDispatchJobPins(), fetchCompletedJobPins()])
        if (!active || !map) return
        ;(map.getSource('trucks') as mapboxgl.GeoJSONSource | undefined)?.setData(trucksGeo(trucks) as any)
        ;(map.getSource('pickups') as mapboxgl.GeoJSONSource | undefined)?.setData(pinsGeo(pins.pickups) as any)
        ;(map.getSource('dropoffs') as mapboxgl.GeoJSONSource | undefined)?.setData(pinsGeo(pins.dropoffs) as any)
        ;(map.getSource('completed') as mapboxgl.GeoJSONSource | undefined)?.setData(pinsGeo(completed) as any)
        if (routeActiveRef.current) return
        const inNZ = (lat: number, lng: number) => lat > -48 && lat < -33 && lng > 165 && lng < 180
        const all = [
          ...trucks.filter((t) => Number.isFinite(t.lat)).map((t) => [t.lng, t.lat] as [number, number]),
          ...pins.pickups.filter((p) => inNZ(p.lat, p.lng)).map((p) => [p.lng, p.lat] as [number, number]),
          ...pins.dropoffs.filter((p) => inNZ(p.lat, p.lng)).map((p) => [p.lng, p.lat] as [number, number]),
        ]
        if (all.length) {
          const b = new mapboxgl.LngLatBounds()
          all.forEach((c) => b.extend(c))
          map.fitBounds(b, { padding: 70, maxZoom: 12, duration: 0 })
        }
      } catch { /* ignore */ }
    }
    load()
    return () => { active = false }
  }, [ready])

  function paintRoute(r: DriverRoute | null) {
    const map = mapRef.current
    if (!map) return
    const doneSrc = map.getSource('route-done') as mapboxgl.GeoJSONSource | undefined
    const todoSrc = map.getSource('route-todo') as mapboxgl.GeoJSONSource | undefined
    const stopSrc = map.getSource('route-stops') as mapboxgl.GeoJSONSource | undefined
    if (!r || !r.stops.length) {
      doneSrc?.setData(EMPTY_FC as any)
      todoSrc?.setData(EMPTY_FC as any)
      stopSrc?.setData(EMPTY_FC as any)
      routeActiveRef.current = false
      return
    }
    const doneCoords: [number, number][] = []
    const todoCoords: [number, number][] = []
    for (const lg of r.legs ?? []) {
      if (!lg.polyline) continue
      const seg = decodePolyline(lg.polyline)
      const target = lg.done ? doneCoords : todoCoords
      if (target.length) target.push(...seg.slice(1)); else target.push(...seg)
    }
    if (!doneCoords.length && !todoCoords.length && r.polyline) todoCoords.push(...decodePolyline(r.polyline))

    doneSrc?.setData(lineFeature(doneCoords))
    todoSrc?.setData(lineFeature(todoCoords))
    stopSrc?.setData({
      type: 'FeatureCollection',
      features: r.stops.map((s) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [s.lng, s.lat] }, properties: { seq: String(s.seq), type: s.type, done: !!s.done } })),
    } as any)
    routeActiveRef.current = true

    const b = new mapboxgl.LngLatBounds()
    const all = [...doneCoords, ...todoCoords]
    if (all.length) all.forEach((c) => b.extend(c))
    else r.stops.forEach((s) => b.extend([s.lng, s.lat] as [number, number]))
    b.extend([r.depot.lng, r.depot.lat])
    map.fitBounds(b, { padding: { top: 60, right: 60, bottom: 60, left: 300 }, maxZoom: 13, duration: 400 })
  }

  async function runRoute(driverId: string, opts: { order?: string[]; exclude?: string[]; returnToDepot?: boolean } = {}) {
    setRouteLoading(true)
    try {
      const r = await computeDriverRoute(driverId, opts)
      setRoute(r)
      paintRoute(r)
    } catch {
      setRoute(null)
      paintRoute(null)
    } finally {
      setRouteLoading(false)
    }
  }

  useEffect(() => {
    if (!ready) return
    manualOrderRef.current = null
    setRemoved([])
    setReturnToDepot(true)
    if (routeDriverId) {
      runRoute(routeDriverId, { returnToDepot: true })
    } else {
      setRoute(null)
      paintRoute(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeDriverId, ready])

  function currentOpts(over: { order?: string[]; exclude?: string[]; returnToDepot?: boolean } = {}) {
    return { order: manualOrderRef.current ?? undefined, exclude: removed.map((s) => s.key), returnToDepot, ...over }
  }
  function onRefresh() {
    if (routeDriverId) runRoute(routeDriverId, currentOpts())
  }
  function onReorder(keys: string[]) {
    manualOrderRef.current = keys
    if (routeDriverId) runRoute(routeDriverId, currentOpts({ order: keys }))
  }
  function onRemoveStop(stop: RouteStop) {
    const next = [...removed, stop]
    setRemoved(next)
    if (routeDriverId) runRoute(routeDriverId, currentOpts({ exclude: next.map((s) => s.key) }))
  }
  function onRestoreStop(key: string) {
    const next = removed.filter((s) => s.key !== key)
    setRemoved(next)
    if (routeDriverId) runRoute(routeDriverId, currentOpts({ exclude: next.map((s) => s.key) }))
  }
  function onToggleDepot() {
    const next = !returnToDepot
    setReturnToDepot(next)
    if (routeDriverId) runRoute(routeDriverId, currentOpts({ returnToDepot: next }))
  }
  function onClosePanel() {
    setRoute(null)
    paintRoute(null)
  }

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const vis = (ids: string[], on: boolean) => ids.forEach((id) => map.getLayer(id) && map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none'))
    vis(['trucks-icon', 'trucks-label'], layers.trucks)
    vis(['pickups-dot', 'pickups-arrow'], layers.pickups)
    vis(['dropoffs-dot', 'dropoffs-arrow'], layers.dropoffs)
    vis(['completed-dot', 'completed-mark'], layers.completed)
    vis(['traffic'], layers.traffic)
  }, [layers, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const t = setTimeout(() => map.resize(), 60)
    return () => clearTimeout(t)
  }, [full])

  const showPanel = !!routeDriverId

  return (
    <div className={full ? 'fixed inset-0 z-[60] bg-white p-3' : 'relative h-full w-full'}>
      <div className="absolute left-3 top-3 z-10 inline-flex flex-wrap gap-1 rounded-lg border border-neutral-200 bg-white/95 p-0.5 shadow-sm">
        {CHIPS.map(({ key, label }) => (
          <button key={key} type="button" onClick={() => setLayers((s) => ({ ...s, [key]: !s[key] }))}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${layers[key] ? 'bg-[#0A2472]/[0.08] text-[#0A2472]' : 'text-neutral-500 hover:text-neutral-800'}`}>
            {label}
          </button>
        ))}
      </div>
      <button type="button" onClick={() => setFull((v) => !v)} title={full ? 'Exit full screen' : 'Full screen'}
        className="absolute right-3 top-14 z-10 inline-flex h-8 w-8 items-center justify-center rounded-md border border-neutral-200 bg-white/95 text-neutral-600 shadow-sm hover:bg-neutral-50">
        {full ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
      </button>
      {showPanel && (
        <DriverRoutePanel driverId={routeDriverId} driverName={driverName} route={route} loading={routeLoading}
          removed={removed} returnToDepot={returnToDepot}
          onRefresh={onRefresh} onReorder={onReorder} onRemove={onRemoveStop} onRestore={onRestoreStop} onToggleDepot={onToggleDepot} onClose={onClosePanel} />
      )}
      <div ref={containerRef} className="h-full w-full overflow-hidden rounded-lg border border-neutral-200" style={{ minHeight: full ? '100%' : 560 }} />
    </div>
  )
}
