import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string
mapboxgl.accessToken = TOKEN

type Pt = { lng: number; lat: number }
type Props = {
  originAddress?: string | null; originLat?: number | null; originLng?: number | null
  destAddress?: string | null; destLat?: number | null; destLng?: number | null
}

async function geocode(q: string): Promise<Pt | null> {
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${TOKEN}&limit=1&country=nz,fj,au`
    const r = await fetch(url); const j = await r.json()
    const c = j?.features?.[0]?.center
    return Array.isArray(c) ? { lng: c[0], lat: c[1] } : null
  } catch { return null }
}

function pin(color: string, title: string): HTMLDivElement {
  const el = document.createElement('div')
  el.style.cssText = `width:14px;height:14px;border-radius:9999px;background:${color};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.3)`
  el.title = title
  return el
}

export default function ConsignmentMiniMap(p: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const [empty, setEmpty] = useState(false)

  useEffect(() => {
    if (!ref.current || mapRef.current) return
    const map = new mapboxgl.Map({ container: ref.current, style: 'mapbox://styles/mapbox/light-v11', center: [174.79, -36.94], zoom: 8, attributionControl: false, dragRotate: false })
    mapRef.current = map
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
    return () => { map.remove(); mapRef.current = null }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const map = mapRef.current
      if (!map) return
      const o = (p.originLat != null && p.originLng != null) ? { lat: p.originLat, lng: p.originLng } : (p.originAddress ? await geocode(p.originAddress) : null)
      const d = (p.destLat != null && p.destLng != null) ? { lat: p.destLat, lng: p.destLng } : (p.destAddress ? await geocode(p.destAddress) : null)
      if (cancelled) return
      const pts = [o, d].filter(Boolean) as Pt[]
      if (pts.length === 0) { setEmpty(true); return }
      setEmpty(false)
      const draw = () => {
        if (o) new mapboxgl.Marker({ element: pin('#0A2472', 'Origin') }).setLngLat([o.lng, o.lat]).addTo(map)
        if (d) new mapboxgl.Marker({ element: pin('#B0264A', 'Destination') }).setLngLat([d.lng, d.lat]).addTo(map)
        if (o && d) {
          const gj: GeoJSON.Feature = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[o.lng, o.lat], [d.lng, d.lat]] } }
          if (map.getSource('leg')) (map.getSource('leg') as mapboxgl.GeoJSONSource).setData(gj as any)
          else { map.addSource('leg', { type: 'geojson', data: gj as any }); map.addLayer({ id: 'leg', type: 'line', source: 'leg', paint: { 'line-color': '#0A2472', 'line-width': 2, 'line-dasharray': [2, 2] } }) }
        }
        const b = new mapboxgl.LngLatBounds(); pts.forEach((pt) => b.extend([pt.lng, pt.lat]))
        map.fitBounds(b, { padding: 60, maxZoom: 12, duration: 0 })
      }
      if (map.loaded()) draw(); else map.on('load', draw)
    })()
    return () => { cancelled = true }
  }, [p.originAddress, p.destAddress, p.originLat, p.originLng, p.destLat, p.destLng])

  return (
    <div className="relative h-full w-full">
      <div ref={ref} className="h-full w-full" />
      {empty && <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-neutral-400">No location to map</div>}
    </div>
  )
}
