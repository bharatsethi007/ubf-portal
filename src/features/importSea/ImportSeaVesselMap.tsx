import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { ChevronDown, Ship } from 'lucide-react'
import { fetchImportSeaVesselPositions, type VesselPosition } from './vesselMapApi'

const NAVY = '#0A2472'
const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string

type FeatureProps = {
  booking_ref: string
  customer: string
  vessel: string
  heading: number
  seen: string
}

function toGeoJSON(
  rows: VesselPosition[],
): GeoJSON.FeatureCollection<GeoJSON.Point, FeatureProps> {
  return {
    type: 'FeatureCollection',
    features: rows.map((r) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [Number(r.longitude), Number(r.latitude)] },
      properties: {
        booking_ref: r.booking_ref ?? '',
        customer: r.customer_name ?? '—',
        vessel: r.vessel ?? '',
        heading: r.heading == null ? 0 : Number(r.heading),
        seen: r.position_timestamp ?? '',
      },
    })),
  }
}

/** Navy triangle pointing north (heading 0); rotated per-feature by icon-rotate. */
function makeArrow(): ImageData {
  const size = 28
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, size, size)
  ctx.translate(size / 2, size / 2)
  ctx.beginPath()
  ctx.moveTo(0, -11)
  ctx.lineTo(7, 9)
  ctx.lineTo(0, 4)
  ctx.lineTo(-7, 9)
  ctx.closePath()
  ctx.fillStyle = NAVY
  ctx.fill()
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 1.5
  ctx.stroke()
  return ctx.getImageData(0, 0, size, size)
}

function fitToData(map: mapboxgl.Map, rows: VesselPosition[]) {
  if (rows.length === 0) return
  const b = new mapboxgl.LngLatBounds()
  rows.forEach((r) => b.extend([Number(r.longitude), Number(r.latitude)]))
  map.fitBounds(b, { padding: 60, maxZoom: 6, duration: 300 })
}

export default function ImportSeaVesselMap() {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<VesselPosition[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const dataRef = useRef<VesselPosition[]>([])
  dataRef.current = rows

  // Load positions on open, then poll every 60s while the panel stays open.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    const load = () => {
      fetchImportSeaVesselPositions()
        .then((d) => {
          if (!cancelled) {
            setRows(d)
            setError('')
          }
        })
        .catch((e) => {
          if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load vessels')
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }
    setLoading(true)
    load()
    const id = setInterval(load, 60_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [open])

  // Init the map when the panel opens; tear it down when it closes.
  useEffect(() => {
    if (!open || !containerRef.current || mapRef.current) return
    if (!TOKEN) {
      setError('Mapbox token missing — set VITE_MAPBOX_TOKEN in .env and Netlify.')
      return
    }
    mapboxgl.accessToken = TOKEN
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [174, -30],
      zoom: 2.2,
      minZoom: 1,
      maxZoom: 12,
      projection: 'mercator',
      attributionControl: false,
      dragRotate: false,
    })
    mapRef.current = map
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')

    map.on('load', () => {
      if (!map.hasImage('ubf-vessel')) map.addImage('ubf-vessel', makeArrow())

      map.addSource('vessels', {
        type: 'geojson',
        data: toGeoJSON(dataRef.current),
        cluster: true,
        clusterRadius: 46,
        clusterMaxZoom: 8,
      })

      map.addLayer({
        id: 'vessel-clusters',
        type: 'circle',
        source: 'vessels',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': NAVY,
          'circle-opacity': 0.9,
          'circle-radius': ['step', ['get', 'point_count'], 16, 10, 20, 50, 26],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      })

      map.addLayer({
        id: 'vessel-cluster-count',
        type: 'symbol',
        source: 'vessels',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 13,
        },
        paint: { 'text-color': '#ffffff' },
      })

      map.addLayer({
        id: 'vessel-points',
        type: 'symbol',
        source: 'vessels',
        filter: ['!', ['has', 'point_count']],
        layout: {
          'icon-image': 'ubf-vessel',
          'icon-size': 0.9,
          'icon-rotate': ['get', 'heading'],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'text-field': ['get', 'customer'],
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 11,
          'text-anchor': 'top',
          'text-offset': [0, 1.1],
        },
        paint: {
          'text-color': NAVY,
          'text-halo-color': '#ffffff',
          'text-halo-width': 2,
        },
      })

      map.on('click', 'vessel-clusters', (e) => {
        const f = map.queryRenderedFeatures(e.point, { layers: ['vessel-clusters'] })[0]
        const clusterId = f?.properties?.cluster_id
        const src = map.getSource('vessels') as mapboxgl.GeoJSONSource
        src.getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err) return
          map.easeTo({
            center: (f.geometry as GeoJSON.Point).coordinates as [number, number],
            zoom,
          })
        })
      })

      map.on('click', 'vessel-points', (e) => {
        const f = e.features?.[0]
        if (!f) return
        const p = f.properties as FeatureProps
        const coords = (f.geometry as GeoJSON.Point).coordinates as [number, number]
        const seen = p.seen ? new Date(p.seen).toLocaleString() : 'unknown'
        new mapboxgl.Popup({ offset: 14, closeButton: false })
          .setLngLat(coords)
          .setHTML(
            `<div style="font:12px/1.4 system-ui,sans-serif"><strong>${p.customer}</strong><br/>${
              p.vessel || '—'
            }<br/><span style="color:#64748b">${p.booking_ref} · ${seen}</span></div>`,
          )
          .addTo(map)
      })

      for (const layer of ['vessel-clusters', 'vessel-points']) {
        map.on('mouseenter', layer, () => {
          map.getCanvas().style.cursor = 'pointer'
        })
        map.on('mouseleave', layer, () => {
          map.getCanvas().style.cursor = ''
        })
      }

      fitToData(map, dataRef.current)
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [open])

  // Push refreshed data into the live source.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const apply = () => {
      const src = map.getSource('vessels') as mapboxgl.GeoJSONSource | undefined
      if (!src) return
      src.setData(toGeoJSON(rows))
      fitToData(map, rows)
    }
    if (map.isStyleLoaded()) apply()
    else map.once('idle', apply)
  }, [rows])

  const count = rows.length

  return (
    <div className="card" style={{ marginBottom: 12, overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5"
        style={{ background: 'transparent' }}
      >
        <Ship size={16} style={{ color: NAVY }} />
        <span style={{ fontWeight: 600, color: NAVY }}>Vessel map</span>
        <span className="text-muted-foreground" style={{ fontSize: 12 }}>
          {open
            ? `${count} live ${count === 1 ? 'vessel' : 'vessels'}`
            : 'Show live positions for active jobs'}
        </span>
        <ChevronDown
          size={16}
          style={{
            marginLeft: 'auto',
            transition: 'transform .15s',
            transform: open ? 'rotate(180deg)' : 'none',
          }}
        />
      </button>

      {open && (
        <div style={{ position: 'relative', height: 420, borderTop: '1px solid #e5e7eb' }}>
          <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
          {loading && (
            <div style={overlayStyle} aria-live="polite">
              Loading vessel positions…
            </div>
          )}
          {!loading && !error && count === 0 && (
            <div style={overlayStyle}>
              No live vessel positions for active jobs yet. A pin appears once a booking has a vessel
              name that matches a SeaVantage/AIS feed.
            </div>
          )}
          {error && <div style={{ ...overlayStyle, color: '#b91c1c' }}>{error}</div>}
        </div>
      )}
    </div>
  )
}

const overlayStyle: CSSProperties = {
  position: 'absolute',
  left: 12,
  bottom: 12,
  zIndex: 2,
  background: 'rgba(255,255,255,.92)',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 12,
  color: '#334155',
  maxWidth: 320,
}
