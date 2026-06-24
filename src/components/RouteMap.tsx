import { useEffect, useMemo, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { Plane, Ship } from 'lucide-react'
import { createRoot, type Root } from 'react-dom/client'
import { supabase } from '../supabase'
import { RouteUnavailableFallback } from './MapErrorBoundary'
import {
  coordsReady,
  isValidPoint,
  pointOnArc,
  routeProgress,
  safeGreatCircleArc,
  toLngLat,
  travelBearing,
  type LngLat,
  type RouteMapPoint,
} from '../utils/routeMapGeo'
import { fitRouteBounds, initRouteMap, updateRouteArc } from '../utils/routeMapLayers'

type Props = {
  originCode: string | null
  destCode: string | null
  mode: string
  etd: string | null
  eta: string | null
  departed: string | null
  arrived: string | null
  status: string
}

type PortRow = { code: string; lat: number | null; lng: number | null }

function rowToPoint(row: PortRow | undefined): RouteMapPoint {
  if (!row || row.lat == null || row.lng == null) return null
  const lat = Number(row.lat)
  const lng = Number(row.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

function findPort(rows: PortRow[], code: string): PortRow | undefined {
  const key = code.trim().toUpperCase()
  return rows.find((p) => p.code.trim().toUpperCase() === key)
}

function unavailableReason(opts: {
  originCode: string | null
  destCode: string | null
  origin: RouteMapPoint
  destination: RouteMapPoint
  portsError: string | null
  portsLoaded: boolean
  hasToken: boolean
  mapError: boolean
}): string | null {
  if (!opts.portsLoaded) return null
  if (!opts.hasToken) return 'Mapbox token missing — set VITE_MAPBOX_TOKEN in .env and Netlify.'
  const origin = opts.originCode?.trim()
  const dest = opts.destCode?.trim()
  if (!origin) return 'Origin port code is missing on this shipment.'
  if (!dest) return 'Destination port code is missing on this shipment.'
  if (opts.portsError) return `Ports lookup failed: ${opts.portsError}.`
  if (!isValidPoint(opts.origin)) return `No ports row with lat/lng for origin "${origin}".`
  if (!isValidPoint(opts.destination)) return `No ports row with lat/lng for destination "${dest}".`
  if (opts.mapError) return 'Mapbox map failed to initialize.'
  return null
}

function VehicleIcon({ mode }: { mode: string }) {
  const Icon = mode === 'air' ? Plane : Ship
  return (
    <div className="route-map__vehicle-inner">
      <Icon size={22} strokeWidth={2} color="#0E1B2D" fill="#F5A623" />
    </div>
  )
}

export default function RouteMap(props: Props) {
  const { originCode, destCode, mode, etd, eta, departed, arrived, status } = props
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markerRef = useRef<mapboxgl.Marker | null>(null)
  const markerRootRef = useRef<Root | null>(null)
  const markerElRef = useRef<HTMLDivElement | null>(null)
  const [origin, setOrigin] = useState<RouteMapPoint>(null)
  const [destination, setDestination] = useState<RouteMapPoint>(null)
  const [portsLoading, setPortsLoading] = useState(false)
  const [portsLoaded, setPortsLoaded] = useState(false)
  const [portsError, setPortsError] = useState<string | null>(null)
  const [mapError, setMapError] = useState(false)
  const hasMapboxToken = !!import.meta.env.VITE_MAPBOX_TOKEN

  useEffect(() => {
    console.log('[RouteMap] token?', hasMapboxToken)
  }, [hasMapboxToken])

  useEffect(() => {
    console.log('[RouteMap] codes', originCode, destCode)

    if (!originCode?.trim() || !destCode?.trim()) {
      setOrigin(null)
      setDestination(null)
      setPortsLoading(false)
      setPortsLoaded(true)
      setPortsError(null)
      return
    }

    let cancelled = false
    setPortsLoading(true)
    setPortsLoaded(false)
    setPortsError(null)
    setOrigin(null)
    setDestination(null)

    ;(async () => {
      const oCode = originCode.trim()
      const dCode = destCode.trim()
      const { data, error } = await supabase
        .from('ports')
        .select('code, lat, lng')
        .in('code', [oCode, dCode])
      console.log('[RouteMap] ports', { data, error })

      if (cancelled) return

      if (error) {
        setPortsError(error.message)
        setOrigin(null)
        setDestination(null)
      } else {
        const rows = (data ?? []) as PortRow[]
        setOrigin(rowToPoint(findPort(rows, oCode)))
        setDestination(rowToPoint(findPort(rows, dCode)))
      }
      setPortsLoading(false)
      setPortsLoaded(true)
    })()

    return () => {
      cancelled = true
    }
  }, [originCode, destCode])

  const ready = coordsReady(origin, destination, originCode, destCode)

  const originLngLat = useMemo<LngLat | null>(() => {
    if (!ready || !origin) return null
    return toLngLat(origin)
  }, [ready, origin])

  const destLngLat = useMemo<LngLat | null>(() => {
    if (!ready || !destination) return null
    return toLngLat(destination)
  }, [ready, destination])

  const arc = useMemo(() => {
    if (!originLngLat || !destLngLat) return []
    return safeGreatCircleArc(originLngLat, destLngLat)
  }, [originLngLat, destLngLat])

  const progress = useMemo(
    () => routeProgress({ etd, eta, departed, arrived, status }),
    [etd, eta, departed, arrived, status],
  )

  const canRenderMap = ready && arc.length >= 2 && !mapError && !portsLoading && hasMapboxToken

  const fallbackReason = unavailableReason({
    originCode,
    destCode,
    origin,
    destination,
    portsError,
    portsLoaded,
    hasToken: hasMapboxToken,
    mapError,
  })

  useEffect(() => {
    setMapError(false)
  }, [originLngLat, destLngLat, originCode, destCode])

  useEffect(() => {
    if (!canRenderMap || !containerRef.current || !originLngLat || !destLngLat || !originCode || !destCode) {
      return
    }

    const token = import.meta.env.VITE_MAPBOX_TOKEN as string
    mapboxgl.accessToken = token

    let map: mapboxgl.Map | null = null
    try {
      map = initRouteMap(
        containerRef.current,
        arc,
        originLngLat,
        destLngLat,
        originCode.trim(),
        destCode.trim(),
      )
      mapRef.current = map

      const el = document.createElement('div')
      el.className = 'route-map__vehicle'
      markerElRef.current = el
      const root = createRoot(el)
      markerRootRef.current = root
      root.render(<VehicleIcon mode={mode} />)
      markerRef.current = new mapboxgl.Marker({ element: el, anchor: 'center' }).addTo(map)
    } catch (err) {
      console.error('[RouteMap] map init failed:', err)
      setMapError(true)
      map?.remove()
      mapRef.current = null
      return
    }

    return () => {
      markerRef.current?.remove()
      markerRef.current = null
      markerRootRef.current?.unmount()
      markerRootRef.current = null
      markerElRef.current = null
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [canRenderMap, originLngLat, destLngLat, originCode, destCode, arc, mode])

  useEffect(() => {
    const map = mapRef.current
    const marker = markerRef.current
    const el = markerElRef.current
    if (!map || !marker || !el || arc.length < 2) return

    const apply = () => {
      try {
        updateRouteArc(map, arc)
        fitRouteBounds(map, arc)
        const pos = pointOnArc(arc, progress)
        const bearing = travelBearing(arc, progress)
        marker.setLngLat(pos)
        el.style.transform = `rotate(${bearing}deg)`
      } catch (err) {
        console.error('[RouteMap] map update failed:', err)
        setMapError(true)
      }
    }

    if (map.isStyleLoaded()) apply()
    else map.once('load', apply)
  }, [arc, progress])

  useEffect(() => {
    markerRootRef.current?.render(<VehicleIcon mode={mode} />)
  }, [mode])

  if (portsLoading) {
    return <div className="route-map route-map--empty muted">Loading route…</div>
  }

  if (fallbackReason) {
    return <RouteUnavailableFallback reason={fallbackReason} />
  }

  return (
    <div className="route-map">
      <div ref={containerRef} className="route-map__canvas" />
    </div>
  )
}
