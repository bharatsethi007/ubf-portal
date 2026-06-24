import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { MapPortPoint } from '../types/port'
import {
  addPortLayers,
  bindPortInteractions,
  portsToGeoJSON,
  styleBasemap,
} from '../utils/shipmentMapLayers'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN as string

type Props = {
  ports: MapPortPoint[]
  selectedPort?: string | null
  loading?: boolean
  onPortClick?: (code: string) => void
  onClear?: () => void
}

export default function ShipmentMap({ ports, selectedPort, loading, onPortClick, onClear }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const portsRef = useRef(ports)
  const clickRef = useRef(onPortClick)
  portsRef.current = ports
  clickRef.current = onPortClick

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [60, 20],
      zoom: 1.4,
      minZoom: 1,
      maxZoom: 8,
      projection: 'mercator',
      attributionControl: false,
      dragRotate: false,
    })
    mapRef.current = map
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')

    map.on('load', () => {
      styleBasemap(map)
      addPortLayers(map, portsToGeoJSON(portsRef.current))
      bindPortInteractions(map, (code) => clickRef.current?.(code))
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const apply = () => {
      const src = map.getSource('ports') as mapboxgl.GeoJSONSource | undefined
      if (src) src.setData(portsToGeoJSON(ports))
    }
    if (map.isStyleLoaded()) apply()
    else map.once('load', apply)
  }, [ports])

  return (
    <div className="shipment-map card">
      <div className="shipment-map__canvas">
        <div ref={containerRef} className="shipment-map__map" />
        {loading && (
          <div className="shipment-map__loading" aria-live="polite">
            Loading port coordinates…
          </div>
        )}
      </div>
      <div className="shipment-map__foot">
        {selectedPort ? (
          <span>
            Filtering by port <strong className="mono">{selectedPort}</strong>
            <button type="button" className="text-link map-clear" onClick={onClear}>
              Clear
            </button>
          </span>
        ) : (
          <span className="muted">Click a port to filter the shipments table</span>
        )}
      </div>
    </div>
  )
}
