import mapboxgl from 'mapbox-gl'
import type { LngLat } from './routeMapGeo'
import { styleBasemap } from './shipmentMapLayers'

const NAVY = '#0E1B2D'

export function initRouteMap(
  container: HTMLElement,
  arc: LngLat[],
  origin: LngLat,
  dest: LngLat,
  originCode: string,
  destCode: string,
): mapboxgl.Map {
  const map = new mapboxgl.Map({
    container,
    style: 'mapbox://styles/mapbox/light-v11',
    center: origin,
    zoom: 2,
    attributionControl: false,
    dragRotate: false,
  })

  map.on('load', () => {
    styleBasemap(map)

    map.addSource('route-arc', {
      type: 'geojson',
      data: { type: 'Feature', geometry: { type: 'LineString', coordinates: arc }, properties: {} },
    })
    map.addSource('route-ports', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', geometry: { type: 'Point', coordinates: origin }, properties: { code: originCode } },
          { type: 'Feature', geometry: { type: 'Point', coordinates: dest }, properties: { code: destCode } },
        ],
      },
    })

    map.addLayer({
      id: 'route-arc-line',
      type: 'line',
      source: 'route-arc',
      paint: { 'line-color': NAVY, 'line-width': 2, 'line-opacity': 0.55 },
    })

    map.addLayer({
      id: 'route-port-glow',
      type: 'circle',
      source: 'route-ports',
      paint: { 'circle-color': NAVY, 'circle-opacity': 0.15, 'circle-radius': 14 },
    })

    map.addLayer({
      id: 'route-port-dot',
      type: 'circle',
      source: 'route-ports',
      paint: {
        'circle-color': NAVY,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
        'circle-radius': 6,
      },
    })

    map.addLayer({
      id: 'route-port-label',
      type: 'symbol',
      source: 'route-ports',
      layout: {
        'text-field': ['get', 'code'],
        'text-size': 11,
        'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
        'text-offset': [0, 1.4],
        'text-anchor': 'top',
        'text-allow-overlap': true,
      },
      paint: { 'text-color': NAVY },
    })

    const bounds = arc.reduce(
      (b, c) => b.extend(c as mapboxgl.LngLatLike),
      new mapboxgl.LngLatBounds(origin, dest),
    )
    map.fitBounds(bounds, { padding: 48, maxZoom: 5, duration: 0 })
  })

  return map
}

export function updateRouteArc(map: mapboxgl.Map, arc: LngLat[]) {
  const src = map.getSource('route-arc') as mapboxgl.GeoJSONSource | undefined
  if (!src) return
  src.setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: arc }, properties: {} })
}

export function fitRouteBounds(map: mapboxgl.Map, arc: LngLat[]) {
  if (arc.length < 2) return
  const bounds = arc.reduce(
    (b, c) => b.extend(c as mapboxgl.LngLatLike),
    new mapboxgl.LngLatBounds(arc[0], arc[1]),
  )
  map.fitBounds(bounds, { padding: 48, maxZoom: 5, duration: 300 })
}
