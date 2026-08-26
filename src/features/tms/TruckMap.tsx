import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { fetchTruckPositions, type TruckPosition } from './vehicleMapApi'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN as string

function toGeoJSON(rows: TruckPosition[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: rows.map((r) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [Number(r.lng), Number(r.lat)] },
      properties: { rego: r.registration_number },
    })),
  }
}

export default function TruckMap() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [174.79, -36.94],
      zoom: 9,
      minZoom: 3,
      attributionControl: false,
      dragRotate: false,
    })
    mapRef.current = map
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
    map.on('load', () => {
      map.addSource('trucks', { type: 'geojson', data: toGeoJSON([]) })
      map.addLayer({ id: 'trucks-dot', type: 'circle', source: 'trucks', paint: { 'circle-radius': 7, 'circle-color': '#0A2472', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } })
      map.addLayer({ id: 'trucks-label', type: 'symbol', source: 'trucks', layout: { 'text-field': ['get', 'rego'], 'text-size': 11, 'text-offset': [0, 1.2], 'text-anchor': 'top' }, paint: { 'text-color': '#0A2472', 'text-halo-color': '#fff', 'text-halo-width': 1.5 } })
      setReady(true)
    })
    return () => { map.remove(); mapRef.current = null }
  }, [])

  useEffect(() => {
    if (!ready) return
    let active = true
    const load = async () => {
      try {
        const rows = await fetchTruckPositions()
        const map = mapRef.current
        if (!active || !map) return
        const src = map.getSource('trucks') as mapboxgl.GeoJSONSource | undefined
        src?.setData(toGeoJSON(rows) as any)
        if (rows.length) {
          const b = new mapboxgl.LngLatBounds()
          rows.forEach((r) => b.extend([Number(r.lng), Number(r.lat)]))
          map.fitBounds(b, { padding: 60, maxZoom: 11, duration: 0 })
        }
      } catch { /* ignore */ }
    }
    load()
    const t = setInterval(load, 60000)
    return () => { active = false; clearInterval(t) }
  }, [ready])

  return <div ref={containerRef} className="h-full w-full overflow-hidden rounded-lg border border-neutral-200" style={{ minHeight: 420 }} />
}
