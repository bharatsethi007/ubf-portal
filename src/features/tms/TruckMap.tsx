import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { format } from 'date-fns'
import { Maximize2, Minimize2, X, UserCog, Building2, MapPin, ChevronLeft, User, Clock, Package, Weight, Box } from 'lucide-react'
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
      properties: {
        id: r.id, label: r.consignment_no ?? r.company ?? '', company: r.company ?? '', address: r.address ?? '',
        status: r.status ?? '', driver_id: r.driver_id ?? '', pickup_at: r.pickup_at ?? '',
        units: r.units ?? 0, weight_kg: r.weight_kg ?? 0, cbm: r.cbm ?? 0,
      },
    })),
  }
}

const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }
const STALE_OPACITY: any = ['case', ['<', ['get', 'mins'], 30], 1, ['<', ['get', 'mins'], 180], 0.85, 0.5]
const lineFeature = (coords: [number, number][]): any =>
  coords.length >= 2 ? { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } } : EMPTY_FC

type PickerDriver = { id: string; first_name: string; last_name: string; current_registration: string | null }
type PinPopup = {
  id: string; no: string | null; company: string | null; address: string | null; kind: 'Pickup' | 'Drop-off'
  driverId: string | null; pickupAt: string | null; units: number; weightKg: number; cbm: number; x: number; y: number
}
type Props = {
  routeDriverId?: string | null
  driverName?: string | null
  onTruckClick?: (registration: string) => void
  drivers?: PickerDriver[]
  onAssignJob?: (consignmentId: string, driverId: string) => void
}

export default function TruckMap({ routeDriverId = null, driverName = null, onTruckClick, drivers = [], onAssignJob }: Props) {
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
  const [pinPopup, setPinPopup] = useState<PinPopup | null>(null)
  const [pinMode, setPinMode] = useState<'details' | 'assign'>('details')

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

      const pinClick = (e: mapboxgl.MapLayerMouseEvent, kind: 'Pickup' | 'Drop-off') => {
        const f = e.features?.[0] as any
        if (!f?.properties?.id) return
        const p = f.properties
        setPinMode('details')
        setPinPopup({
          id: String(p.id),
          no: p.label ? String(p.label) : null,
          company: p.company ? String(p.company) : null,
          address: p.address ? String(p.address) : null,
          kind,
          driverId: p.driver_id ? String(p.driver_id) : null,
          pickupAt: p.pickup_at ? String(p.pickup_at) : null,
          units: Number(p.units ?? 0),
          weightKg: Number(p.weight_kg ?? 0),
          cbm: Number(p.cbm ?? 0),
          x: e.point.x, y: e.point.y,
        })
      }
      map.on('click', 'pickups-dot', (e) => pinClick(e, 'Pickup'))
      map.on('click', 'dropoffs-dot', (e) => pinClick(e, 'Drop-off'))
      map.on('movestart', () => setPinPopup(null))

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
  const popupDriver = pinPopup?.driverId ? drivers.find((d) => d.id === pinPopup.driverId) ?? null : null

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
        className="absolute right-2.5 top-[84px] z-10 inline-flex h-8 w-8 items-center justify-center rounded-md border border-neutral-200 bg-white/95 text-neutral-600 shadow-sm hover:bg-neutral-50">
        {full ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
      </button>
      {pinPopup && (
        <div className="absolute z-20 w-64 -translate-x-1/2 rounded-lg border border-neutral-200 bg-white p-2.5 shadow-xl"
          style={{ left: pinPopup.x, top: pinPopup.y + 12 }}>
          {pinMode === 'details' ? (
            <>
              <div className="mb-2 flex items-center gap-1.5">
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#0A2472]">{pinPopup.no ?? 'Job'}</span>
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide ${pinPopup.kind === 'Pickup' ? 'bg-[#0F7A4E]/10 text-[#0F7A4E]' : 'bg-[#B0264A]/10 text-[#B0264A]'}`}>{pinPopup.kind === 'Pickup' ? 'PICK-UP' : 'DROP-OFF'}</span>
                {onAssignJob && (
                  <button type="button" title="Change driver" onClick={() => setPinMode('assign')}
                    className="shrink-0 rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-[#0A2472]"><UserCog size={14} /></button>
                )}
                <button type="button" aria-label="Close" onClick={() => setPinPopup(null)}
                  className="shrink-0 rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"><X size={13} /></button>
              </div>
              <div className="space-y-1.5 text-xs text-neutral-600">
                {pinPopup.company && <div className="flex items-start gap-1.5"><Building2 size={13} className="mt-0.5 shrink-0 text-neutral-400" /><span className="min-w-0 flex-1">{pinPopup.company}</span></div>}
                {pinPopup.address && <div className="flex items-start gap-1.5"><MapPin size={13} className="mt-0.5 shrink-0 text-neutral-400" /><span className="min-w-0 flex-1">{pinPopup.address}</span></div>}
                <div className="flex items-center gap-1.5">
                  <User size={13} className="shrink-0 text-neutral-400" />
                  <span className="min-w-0 flex-1 truncate">
                    {popupDriver
                      ? `${popupDriver.first_name} ${popupDriver.last_name[0] ?? ''}.${popupDriver.current_registration ? ' · ' + popupDriver.current_registration : ''}`
                      : pinPopup.driverId ? 'Assigned' : 'Unassigned'}
                  </span>
                </div>
                {pinPopup.pickupAt && (
                  <div className="flex items-center gap-1.5">
                    <Clock size={13} className="shrink-0 text-neutral-400" />
                    <span className="min-w-0 flex-1 truncate">Pickup {format(new Date(pinPopup.pickupAt), 'd MMM, h:mm a')}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 border-t border-neutral-100 pt-1.5 text-[11px] text-neutral-500">
                  <span className="inline-flex items-center gap-1"><Package size={12} className="text-neutral-400" />{pinPopup.units}</span>
                  <span className="inline-flex items-center gap-1"><Weight size={12} className="text-neutral-400" />{pinPopup.weightKg} kg</span>
                  <span className="inline-flex items-center gap-1"><Box size={12} className="text-neutral-400" />{pinPopup.cbm} CBM</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="mb-1 flex items-center justify-between gap-2 px-0.5">
                <button type="button" onClick={() => setPinMode('details')} className="flex min-w-0 items-center gap-1 text-xs font-semibold text-[#0A2472] hover:underline">
                  <ChevronLeft size={13} className="shrink-0" /><span className="truncate">Assign {pinPopup.no ?? 'job'}</span>
                </button>
                <button type="button" aria-label="Close" onClick={() => setPinPopup(null)} className="shrink-0 text-neutral-400 hover:text-neutral-700"><X size={13} /></button>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {drivers.length === 0 && <p className="px-1 py-1 text-xs text-neutral-400">No active drivers.</p>}
                {drivers.map((d) => (
                  <button key={d.id} type="button" onClick={() => { onAssignJob?.(pinPopup.id, d.id); setPinPopup(null) }}
                    className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-neutral-50">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0A2472] text-[10px] font-semibold text-white">{(d.first_name[0] ?? '') + (d.last_name[0] ?? '')}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">{d.first_name} {d.last_name[0]}.</span>
                    <span className="shrink-0 truncate text-[11px] text-neutral-500">{d.current_registration ?? ''}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      {showPanel && (
        <DriverRoutePanel driverId={routeDriverId} driverName={driverName} route={route} loading={routeLoading}
          removed={removed} returnToDepot={returnToDepot}
          onRefresh={onRefresh} onReorder={onReorder} onRemove={onRemoveStop} onRestore={onRestoreStop} onToggleDepot={onToggleDepot} onClose={onClosePanel} />
      )}
      <div ref={containerRef} className="h-full w-full overflow-hidden rounded-lg border border-neutral-200" style={{ minHeight: full ? '100%' : 560 }} />
    </div>
  )
}
