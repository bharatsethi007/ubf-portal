import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { Crosshair, Layers } from 'lucide-react'
import type { LngLat, PublicTrack } from './trackApi'

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string
const STYLES = {
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  map: 'mapbox://styles/mapbox/light-v11',
} as const
type StyleKey = keyof typeof STYLES
const ORANGE = '#F7941D'

type Props = { track: PublicTrack; padding: mapboxgl.PaddingOptions }

function line(coords: LngLat[]): GeoJSON.Feature<GeoJSON.LineString> {
  return { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } }
}

function allCoords(t: PublicTrack): LngLat[] {
  const pts: LngLat[] = [...t.track, ...t.remaining]
  if (!pts.length) pts.push(...t.planned)
  for (const s of t.stops) if (s.coord) pts.push(s.coord)
  if (t.vessel?.position) pts.push(t.vessel.position)
  return pts
}

function addLayers(map: mapboxgl.Map, t: PublicTrack) {
  const sailedOrPlanned = t.track.length > 1 ? [] : t.remaining.length > 1 ? [] : t.planned
  const sources: [string, LngLat[]][] = [['planned', sailedOrPlanned], ['sailed', t.track], ['ahead', t.remaining]]
  for (const [id, coords] of sources) {
    if (map.getSource(id)) (map.getSource(id) as mapboxgl.GeoJSONSource).setData(line(coords))
    else map.addSource(id, { type: 'geojson', data: line(coords) })
  }
  if (!map.getLayer('planned')) map.addLayer({ id: 'planned', type: 'line', source: 'planned',
    paint: { 'line-color': '#ffffff', 'line-width': 1.6, 'line-opacity': 0.55, 'line-dasharray': [1, 2.5] },
    layout: { 'line-cap': 'round' } })
  if (!map.getLayer('sailed-glow')) map.addLayer({ id: 'sailed-glow', type: 'line', source: 'sailed',
    paint: { 'line-color': '#0A2472', 'line-width': 6, 'line-opacity': 0.35 }, layout: { 'line-cap': 'round', 'line-join': 'round' } })
  if (!map.getLayer('sailed')) map.addLayer({ id: 'sailed', type: 'line', source: 'sailed',
    paint: { 'line-color': '#ffffff', 'line-width': 2.4 }, layout: { 'line-cap': 'round', 'line-join': 'round' } })
  if (!map.getLayer('ahead')) map.addLayer({ id: 'ahead', type: 'line', source: 'ahead',
    paint: { 'line-color': ORANGE, 'line-width': 2, 'line-dasharray': [1.2, 2] }, layout: { 'line-cap': 'round' } })
}

function stopEl(name: string, role: string): HTMLElement {
  const el = document.createElement('div')
  el.className = 'flex items-center gap-1.5 pointer-events-none'
  const dot = role === 'destination'
    ? '<span style="width:12px;height:12px;border-radius:50%;border:2.5px solid #fff;background:#0A2472;display:block"></span>'
    : `<span style="width:9px;height:9px;border-radius:50%;background:#fff;display:block;opacity:${role === 'tranship' ? 0.8 : 1}"></span>`
  el.innerHTML = `${dot}<span style="font:500 12px 'General Sans',sans-serif;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.8)"></span>`
  el.querySelector('span:last-child')!.textContent = name
  return el
}

function vesselEl(heading: number | null): HTMLElement {
  const el = document.createElement('div')
  el.innerHTML = `<div class="ubf-vessel"><span class="ubf-vessel__pulse"></span><span class="ubf-vessel__dot">${
    heading != null ? `<svg width="12" height="12" viewBox="0 0 12 12" style="transform:rotate(${heading}deg)"><path d="M6 1 L10 10 L6 8 L2 10 Z" fill="#fff"/></svg>` : ''
  }</span></div>`
  return el
}

export default function TrackMap({ track, padding }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markers = useRef<mapboxgl.Marker[]>([])
  const fitted = useRef(false)
  const latest = useRef(track)
  const [style, setStyle] = useState<StyleKey>('satellite')
  latest.current = track

  const fit = (animate = true) => {
    const map = mapRef.current
    const pts = allCoords(latest.current)
    if (!map || !pts.length) return
    const b = new mapboxgl.LngLatBounds(pts[0], pts[0])
    for (const p of pts) b.extend(p)
    map.fitBounds(b, { padding, maxZoom: 7, duration: animate ? 900 : 0 })
  }

  useEffect(() => {
    if (!box.current || !TOKEN) return
    mapboxgl.accessToken = TOKEN
    const map = new mapboxgl.Map({
      container: box.current, style: STYLES.satellite, projection: 'mercator', renderWorldCopies: true,
      center: [150, -15], zoom: 1.6, attributionControl: false, cooperativeGestures: false,
    })
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right')
    map.on('styledata', () => {
      if (map.isStyleLoaded() && !map.getLayer('sailed')) addLayers(map, latest.current)
    })
    map.on('style.load', () => {
      addLayers(map, latest.current)
      if (!fitted.current) { fitted.current = true; fit(false) }
    })
    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Data refresh: update lines + markers in place.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (map.isStyleLoaded()) addLayers(map, track)
    for (const m of markers.current) m.remove()
    markers.current = []
    for (const s of track.stops) {
      if (!s.coord) continue
      markers.current.push(new mapboxgl.Marker({ element: stopEl(s.name, s.role), anchor: 'left', offset: [-6, 0] }).setLngLat(s.coord).addTo(map))
    }
    const v = track.vessel
    if (v?.position) markers.current.push(new mapboxgl.Marker({ element: vesselEl(v.heading) }).setLngLat(v.position).addTo(map))
  }, [track])

  // Skip the first run: the map was just created with this style. Calling setStyle again
  // during the initial load wiped the route layers until the user toggled styles.
  const appliedStyle = useRef<StyleKey>('satellite')
  useEffect(() => {
    if (appliedStyle.current === style) return
    appliedStyle.current = style
    mapRef.current?.setStyle(STYLES[style])
  }, [style])

  const recenter = () => {
    const v = latest.current.vessel?.position
    if (v && mapRef.current) mapRef.current.flyTo({ center: v, zoom: 5, padding, duration: 1200 })
    else fit()
  }

  if (!TOKEN) return <div className="absolute inset-0 bg-[#0B1A3A]" />

  return (
    <div className="absolute inset-0">
      <style>{`
        .ubf-vessel{position:relative;width:22px;height:22px}
        .ubf-vessel__dot{position:absolute;inset:3px;border-radius:50%;background:${ORANGE};border:2px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.45)}
        .ubf-vessel__pulse{position:absolute;inset:-10px;border-radius:50%;background:${ORANGE};opacity:.35;animation:ubfPulse 2.2s ease-out infinite}
        @keyframes ubfPulse{0%{transform:scale(.4);opacity:.55}100%{transform:scale(1.4);opacity:0}}
        .mapboxgl-ctrl-attrib{font-size:10px}
      `}</style>
      <div ref={box} className="absolute inset-0" />
      <div className="absolute right-4 top-4 flex flex-col gap-2">
        <button type="button" onClick={() => setStyle(style === 'satellite' ? 'map' : 'satellite')}
          title={style === 'satellite' ? 'Map view' : 'Satellite view'} aria-label="Toggle map style"
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/95 text-slate-700 shadow-md hover:bg-white">
          <Layers size={17} />
        </button>
        <button type="button" onClick={recenter} title="Recenter" aria-label="Recenter"
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/95 text-slate-700 shadow-md hover:bg-white">
          <Crosshair size={17} />
        </button>
      </div>
    </div>
  )
}
