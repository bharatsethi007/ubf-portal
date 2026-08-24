import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { RefreshCw, Ship } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  fetchImportSeaVesselPositions,
  type VesselPosition,
} from '@/features/importSea/vesselMapApi'
import { relativeUpdatedAt } from './trackingFormat'

const NAVY = '#0A2472'
const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string

type Props = { bookingId: string }

function fmtCoord(lat: number, lon: number): string {
  const ns = lat >= 0 ? 'N' : 'S'
  const ew = lon >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(4)}° ${ns}, ${Math.abs(lon).toFixed(4)}° ${ew}`
}

function arrowMarkerEl(heading: number): HTMLDivElement {
  const wrap = document.createElement('div')
  const inner = document.createElement('div')
  inner.style.transform = `rotate(${heading}deg)`
  inner.style.transformOrigin = 'center'
  inner.innerHTML =
    '<svg width="26" height="26" viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg">' +
    `<path d="M13 2 L20 22 L13 18 L6 22 Z" fill="${NAVY}" stroke="#ffffff" stroke-width="1.5"/></svg>`
  wrap.appendChild(inner)
  return wrap
}

export default function BookingLocationPanel({ bookingId }: Props) {
  const [pos, setPos] = useState<VesselPosition | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markerRef = useRef<mapboxgl.Marker | null>(null)

  const load = (initial = false) => {
    if (initial) setLoading(true)
    return fetchImportSeaVesselPositions()
      .then((rows) => {
        setPos(rows.find((r) => r.booking_id === bookingId) ?? null)
        setError('')
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load position'))
      .finally(() => setLoading(false))
  }

  // Fetch this booking's vessel position on mount, then poll every 60s.
  useEffect(() => {
    let cancelled = false
    const tick = () => { if (!cancelled) void load() }
    void load(true)
    const id = setInterval(tick, 60_000)
    return () => { cancelled = true; clearInterval(id) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId])

  // Init the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    if (!TOKEN) {
      setError('Mapbox token missing — set VITE_MAPBOX_TOKEN in .env and Netlify.')
      return
    }
    mapboxgl.accessToken = TOKEN
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [180, -25],
      zoom: 3,
      minZoom: 1,
      maxZoom: 12,
      projection: 'mercator',
      attributionControl: false,
      dragRotate: false,
    })
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
  }, [])

  // Marker follows the latest position.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (markerRef.current) { markerRef.current.remove(); markerRef.current = null }
    if (!pos) return
    const lngLat: [number, number] = [Number(pos.longitude), Number(pos.latitude)]
    const heading = pos.heading == null ? 0 : Number(pos.heading)
    markerRef.current = new mapboxgl.Marker({ element: arrowMarkerEl(heading) })
      .setLngLat(lngLat)
      .addTo(map)
    map.easeTo({ center: lngLat, zoom: Math.max(map.getZoom(), 5), duration: 500 })
  }, [pos])

  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#0A2472]">
          <Ship size={15} /> Vessel location
        </div>
        <Button type="button" size="xs" variant="outline" disabled={loading} onClick={() => void load(true)}>
          <RefreshCw size={13} className={loading ? 'import-sea-spin' : undefined} />
          Refresh
        </Button>
      </div>

      {error ? <p className="px-4 py-3 text-sm text-red-600">{error}</p> : null}

      <div className="relative">
        <div ref={containerRef} className="h-[380px] w-full" />
        {!pos && !loading && !error ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-muted-foreground">
            No live vessel position yet. Enable and refresh shipping-line tracking on the Events tab —
            once the carrier returns an AIS position it shows here.
          </div>
        ) : null}
      </div>

      {pos ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 px-4 py-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">Vessel</dt>
            <dd className="font-medium">{pos.vessel || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Position</dt>
            <dd className="font-mono text-[13px]">{fmtCoord(Number(pos.latitude), Number(pos.longitude))}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Speed</dt>
            <dd className="font-mono text-[13px]">
              {pos.speed_over_ground == null ? '—' : `${Number(pos.speed_over_ground).toFixed(1)} kn`}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Course</dt>
            <dd className="font-mono text-[13px]">
              {pos.heading == null ? '—' : `${Math.round(Number(pos.heading))}°`}
            </dd>
          </div>
          <div className="col-span-2 sm:col-span-4">
            <dt className="text-xs text-muted-foreground">Last seen</dt>
            <dd>{relativeUpdatedAt(pos.position_timestamp)}</dd>
          </div>
        </dl>
      ) : null}
    </section>
  )
}
