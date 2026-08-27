import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { Maximize2, Minimize2 } from 'lucide-react'
import {
  fetchTruckPositions, fetchDispatchJobPins, fetchCompletedJobPins,
  type TruckPosition, type JobPin,
} from './vehicleMapApi'

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

const STALE_OPACITY: any = ['case', ['<', ['get', 'mins'], 30], 1, ['<', ['get', 'mins'], 180], 0.85, 0.5]

export default function TruckMap() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const [ready, setReady] = useState(false)
  const [full, setFull] = useState(false)
  const [layers, setLayers] = useState<LayerState>({ trucks: true, pickups: true, dropoffs: true, completed: false, traffic: false })

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
      map.addSource('mapbox-traffic', { type: 'vector', url: 'mapbox://mapbox.mapbox-traffic-v1' })

      // traffic (hidden by default), under everything else
      map.addLayer({
        id: 'traffic', type: 'line', source: 'mapbox-traffic', 'source-layer': 'traffic',
        layout: { visibility: 'none' },
        paint: { 'line-width': 2.5, 'line-color': ['match', ['get', 'congestion'], 'low', '#37A24A', 'moderate', '#F2A93B', 'heavy', '#E24A3B', 'severe', '#A11423', '#9CA3AF'] },
      })

      // completed (grey dot + check)
      map.addLayer({ id: 'completed-dot', type: 'circle', source: 'completed', layout: { visibility: 'none' }, paint: { 'circle-radius': 8, 'circle-color': '#9CA3AF', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } })
      map.addLayer({ id: 'completed-mark', type: 'symbol', source: 'completed', layout: { visibility: 'none', 'text-field': '✓', 'text-size': 11, 'text-allow-overlap': true, 'text-ignore-placement': true }, paint: { 'text-color': '#ffffff' } })

      // pickups (green circle + up arrow)
      map.addLayer({ id: 'pickups-dot', type: 'circle', source: 'pickups', paint: { 'circle-radius': 8, 'circle-color': '#0F7A4E', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } })
      map.addLayer({ id: 'pickups-arrow', type: 'symbol', source: 'pickups', layout: { 'text-field': '↑', 'text-size': 13, 'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'], 'text-allow-overlap': true, 'text-ignore-placement': true }, paint: { 'text-color': '#ffffff' } })

      // drop-offs (rose circle + down arrow)
      map.addLayer({ id: 'dropoffs-dot', type: 'circle', source: 'dropoffs', paint: { 'circle-radius': 8, 'circle-color': '#B0264A', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } })
      map.addLayer({ id: 'dropoffs-arrow', type: 'symbol', source: 'dropoffs', layout: { 'text-field': '↓', 'text-size': 13, 'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'], 'text-allow-overlap': true, 'text-ignore-placement': true }, paint: { 'text-color': '#ffffff' } })

      // truck label
      map.addLayer({ id: 'trucks-label', type: 'symbol', source: 'trucks', layout: { 'text-field': ['get', 'label'], 'text-size': 11, 'text-offset': [0, 1.8], 'text-anchor': 'top' }, paint: { 'text-color': '#0A2472', 'text-halo-color': '#fff', 'text-halo-width': 1.5 } })

      // truck icon (async)
      const img = new Image(64, 96)
      img.onload = () => {
        const m = mapRef.current
        if (!m) return
        if (!m.hasImage('ubf-truck')) m.addImage('ubf-truck', img, { pixelRatio: 2 })
        if (!m.getLayer('trucks-icon')) {
          m.addLayer({ id: 'trucks-icon', type: 'symbol', source: 'trucks', layout: { 'icon-image': 'ubf-truck', 'icon-size': 1.1, 'icon-rotate': ['get', 'heading'], 'icon-rotation-alignment': 'map', 'icon-allow-overlap': true }, paint: { 'icon-opacity': STALE_OPACITY } }, 'trucks-label')
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
      setReady(true)
    })
    return () => { map.remove(); mapRef.current = null }
  }, [])

  // poll data
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
    const t = setInterval(load, 60000)
    return () => { active = false; clearInterval(t) }
  }, [ready])

  // apply layer toggles
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
      <div ref={containerRef} className="h-full w-full overflow-hidden rounded-lg border border-neutral-200" style={{ minHeight: full ? '100%' : 560 }} />
    </div>
  )
}
