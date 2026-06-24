import mapboxgl from 'mapbox-gl'
import type { MapPortPoint } from '../types/port'

const NAVY = '#0E1B2D'

export function portsToGeoJSON(ports: MapPortPoint[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: ports.map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: { code: p.code, name: p.name, count: p.count },
    })),
  }
}

export function styleBasemap(map: mapboxgl.Map) {
  map.setPaintProperty('water', 'fill-color', '#eef2f6')
  for (const id of ['land', 'landcover', 'national-park']) {
    if (!map.getLayer(id)) continue
    try {
      map.setPaintProperty(id, 'fill-color', '#f7f9fb')
    } catch {
      /* layer may not support fill-color */
    }
  }
}

export function addPortLayers(map: mapboxgl.Map, data: GeoJSON.FeatureCollection) {
  map.addSource('ports', { type: 'geojson', data })

  map.addLayer({
    id: 'ports-glow',
    type: 'circle',
    source: 'ports',
    paint: {
      'circle-color': NAVY,
      'circle-opacity': 0.12,
      'circle-radius': ['interpolate', ['linear'], ['get', 'count'], 1, 8, 10, 18, 50, 30, 200, 44],
    },
  })

  map.addLayer({
    id: 'ports-dot',
    type: 'circle',
    source: 'ports',
    paint: {
      'circle-color': NAVY,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 1.5,
      'circle-radius': ['interpolate', ['linear'], ['get', 'count'], 1, 4, 10, 9, 50, 15, 200, 22],
    },
  })

  map.addLayer({
    id: 'ports-count',
    type: 'symbol',
    source: 'ports',
    filter: ['>=', ['get', 'count'], 5],
    layout: {
      'text-field': ['to-string', ['get', 'count']],
      'text-size': 11,
      'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
      'text-allow-overlap': true,
    },
    paint: { 'text-color': '#ffffff' },
  })
}

export function bindPortInteractions(
  map: mapboxgl.Map,
  onPortClick?: (code: string) => void,
) {
  const setCursor = (c: string) => {
    map.getCanvas().style.cursor = c
  }
  const popup = new mapboxgl.Popup({ closeButton: false, offset: 12 })

  map.on('mouseenter', 'ports-dot', () => setCursor('pointer'))
  map.on('mouseleave', 'ports-dot', () => setCursor(''))

  map.on('mousemove', 'ports-dot', (e) => {
    const f = e.features?.[0]
    if (!f) return
    const { name, code, count } = f.properties as Record<string, unknown>
    popup
      .setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number])
      .setHTML(
        `<div style="font:600 12px/1.4 system-ui;color:${NAVY}">${name} (${code})<br>` +
          `<span style="font-weight:400;color:#64748b">${count} shipments</span></div>`,
      )
      .addTo(map)
  })
  map.on('mouseleave', 'ports-dot', () => popup.remove())

  map.on('click', 'ports-dot', (e) => {
    const code = e.features?.[0]?.properties?.code as string | undefined
    if (code) onPortClick?.(code)
  })
}
