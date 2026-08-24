import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { RefreshCw, Ship } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { relativeUpdatedAt } from './trackingFormat'
import { fetchBookingVesselRoute, type BookingVesselRoute } from './vesselRouteApi'

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string
const NAVY = '#0A2472'
const ROUTE = '#B0264A'
const ARROW = '#2563EB'
const PORT = '#F97316'

function makeArrow(): ImageData {
  const s = 18
  const c = document.createElement('canvas')
  c.width = s; c.height = s
  const ctx = c.getContext('2d')!
  ctx.clearRect(0, 0, s, s)
  ctx.strokeStyle = ARROW
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(4, 12); ctx.lineTo(9, 5); ctx.lineTo(14, 12)
  ctx.stroke()
  return ctx.getImageData(0, 0, s, s)
}

function makePulser(map: mapboxgl.Map) {
  const size = 84
  let ctx: CanvasRenderingContext2D | null = null
  const img = {
    width: size,
    height: size,
    data: new Uint8Array(size * size * 4),
    onAdd() {
      const c = document.createElement('canvas')
      c.width = size; c.height = size
      ctx = c.getContext('2d')
    },
    render() {
      if (!ctx) return false
      const t = (performance.now() % 1500) / 1500
      const mid = size / 2
      const core = size * 0.11
      const ring = core + t * size * 0.34
      ctx.clearRect(0, 0, size, size)
      ctx.beginPath()
      ctx.arc(mid, mid, ring, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(10,36,114,${0.32 * (1 - t)})`
      ctx.fill()
      ctx.save()
      ctx.translate(mid, mid)
      ctx.beginPath()
      ctx.moveTo(0, -core * 1.6)
      ctx.lineTo(core, core)
      ctx.lineTo(0, core * 0.35)
      ctx.lineTo(-core, core)
      ctx.closePath()
      ctx.fillStyle = NAVY
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2
      ctx.fill()
      ctx.stroke()
      ctx.restore()
      img.data = new Uint8Array(ctx.getImageData(0, 0, size, size).data.buffer)
      map.triggerRepaint()
      return true
    },
  }
  return img
}

function portMarkerEl(name: string): HTMLDivElement {
  const el = document.createElement('div')
  el.style.cssText = 'display:flex;flex-direction:column;align-items:center;line-height:1'
  el.innerHTML =
    `<div style="background:${PORT};color:#fff;font:600 11px system-ui,sans-serif;` +
    `padding:2px 8px;border-radius:9999px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.25)">${name}</div>` +
    `<div style="width:9px;height:9px;background:${PORT};border:2px solid #fff;border-radius:9999px;` +
    `margin-top:2px;box-shadow:0 1px 2px rgba(0,0,0,.3)"></div>`
  return el
}

export default function BookingVesselMap({ bookingId }: { bookingId: string }) {
  const [data, setData] = useState<BookingVesselRoute | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const loadedRef = useRef(false)
  const dataRef = useRef<BookingVesselRoute | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])
  dataRef.current = data

  const load = () => {
    setLoading(true)
    fetchBookingVesselRoute(bookingId)
      .then((d) => { setData(d); setError('') })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load route'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [bookingId])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    if (!TOKEN) { setError('Mapbox token missing — set VITE_MAPBOX_TOKEN in .env and Netlify.'); return }
    mapboxgl.accessToken = TOKEN
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [150, -10], zoom: 2, minZoom: 1, maxZoom: 12,
      projection: 'mercator', attributionControl: false, dragRotate: false,
    })
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
    map.on('load', () => { loadedRef.current = true; draw(map, dataRef.current) })
    mapRef.current = map
    return () => { map.remove(); mapRef.current = null; loadedRef.current = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (mapRef.current && loadedRef.current) draw(mapRef.current, data)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  function draw(map: mapboxgl.Map, d: BookingVesselRoute | null) {
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []
    if (!d) return

    const routeFc: GeoJSON.Feature<GeoJSON.LineString> = {
      type: 'Feature', properties: {},
      geometry: { type: 'LineString', coordinates: d.route ?? [] },
    }
    const routeSrc = map.getSource('bvm-route') as mapboxgl.GeoJSONSource | undefined
    if (routeSrc) routeSrc.setData(routeFc)
    else {
      map.addSource('bvm-route', { type: 'geojson', data: routeFc })
      map.addLayer({
        id: 'bvm-route-line', type: 'line', source: 'bvm-route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': ROUTE, 'line-width': 3, 'line-opacity': 0.9 },
      })
      if (!map.hasImage('bvm-arrow')) map.addImage('bvm-arrow', makeArrow())
      map.addLayer({
        id: 'bvm-route-arrows', type: 'symbol', source: 'bvm-route',
        layout: {
          'symbol-placement': 'line', 'symbol-spacing': 80,
          'icon-image': 'bvm-arrow', 'icon-size': 0.9,
          'icon-rotation-alignment': 'map', 'icon-allow-overlap': true, 'icon-ignore-placement': true,
        },
      })
    }

    const cur = d.current
    const liveFc: GeoJSON.FeatureCollection<GeoJSON.Point> = {
      type: 'FeatureCollection',
      features: cur ? [{
        type: 'Feature',
        properties: { heading: cur.heading == null ? 0 : Number(cur.heading) },
        geometry: { type: 'Point', coordinates: [Number(cur.longitude), Number(cur.latitude)] },
      }] : [],
    }
    const liveSrc = map.getSource('bvm-live') as mapboxgl.GeoJSONSource | undefined
    if (liveSrc) liveSrc.setData(liveFc)
    else {
      if (!map.hasImage('bvm-vessel')) {
        map.addImage('bvm-vessel', makePulser(map) as unknown as mapboxgl.StyleImageInterface, { pixelRatio: 2 })
      }
      map.addSource('bvm-live', { type: 'geojson', data: liveFc })
      map.addLayer({
        id: 'bvm-live-layer', type: 'symbol', source: 'bvm-live',
        layout: {
          'icon-image': 'bvm-vessel', 'icon-size': 0.55,
          'icon-rotate': ['get', 'heading'],
          'icon-rotation-alignment': 'map', 'icon-allow-overlap': true, 'icon-ignore-placement': true,
        },
      })
    }

    for (const cp of d.checkpoints ?? []) {
      const m = new mapboxgl.Marker({ element: portMarkerEl(cp.name), anchor: 'bottom' })
        .setLngLat([Number(cp.lng), Number(cp.lat)])
        .addTo(map)
      markersRef.current.push(m)
    }

    const b = new mapboxgl.LngLatBounds()
    let any = false
    for (const c of d.route ?? []) { b.extend(c as [number, number]); any = true }
    for (const cp of d.checkpoints ?? []) { b.extend([Number(cp.lng), Number(cp.lat)]); any = true }
    if (cur) { b.extend([Number(cur.longitude), Number(cur.latitude)]); any = true }
    if (any) map.fitBounds(b, { padding: 48, maxZoom: 6, duration: 400 })
  }

  const cur = data?.current
  const hasAny = Boolean(data && ((data.route?.length ?? 0) > 0 || data.current))

  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#0A2472]">
          <Ship size={15} /> Live route
          {data?.vessel ? <span className="font-normal text-muted-foreground">· {data.vessel}</span> : null}
        </div>
        <Button type="button" size="xs" variant="outline" disabled={loading} onClick={load}>
          <RefreshCw size={13} className={loading ? 'import-sea-spin' : undefined} />
          Refresh
        </Button>
      </div>

      {error ? <p className="px-4 py-3 text-sm text-red-600">{error}</p> : null}

      <div className="relative">
        <div ref={containerRef} className="h-[460px] w-full lg:h-[720px]" />
        {!hasAny && !loading && !error ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-muted-foreground">
            No live route yet. Refresh shipping-line tracking above — once the carrier returns AIS positions, the route and vessel appear here.
          </div>
        ) : null}
      </div>

      {cur ? (
        <div className="flex flex-wrap gap-x-6 gap-y-1 px-4 py-2.5 text-[13px] text-muted-foreground">
          <span>Speed <span className="font-mono text-foreground">{cur.speed_over_ground == null ? '—' : `${Number(cur.speed_over_ground).toFixed(1)} kn`}</span></span>
          <span>Course <span className="font-mono text-foreground">{cur.heading == null ? '—' : `${Math.round(Number(cur.heading))}°`}</span></span>
          <span>Last seen <span className="text-foreground">{relativeUpdatedAt(cur.position_timestamp)}</span></span>
        </div>
      ) : null}
    </section>
  )
}
