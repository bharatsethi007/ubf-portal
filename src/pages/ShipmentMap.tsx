import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { MapPoint, Dir } from "./useDashboard";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN as string;

const NAVY = "#0A2472";   // exports
const ORANGE = "#F7941D"; // imports

export function ShipmentMap({ points, dir, height = 300 }: { points: MapPoint[]; dir: Dir; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const color = dir === "import" ? ORANGE : NAVY;

  // init once
  useEffect(() => {
    if (!ref.current || map.current) return;
    map.current = new mapboxgl.Map({
      container: ref.current,
      style: "mapbox://styles/mapbox/light-v11",
      projection: "mercator",
      center: [130, 10],
      zoom: 1.1,
      renderWorldCopies: true,
      attributionControl: false,
      dragRotate: false,
      cooperativeGestures: true, // visual-only feel; won't hijack page scroll
    });
    map.current.scrollZoom.disable();
    map.current.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    return () => { map.current?.remove(); map.current = null; };
  }, []);

  // render bubbles on data / dir change
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const draw = () => {
      markers.current.forEach((x) => x.remove());
      markers.current = [];
      if (!points.length) return;
      const max = Math.max(...points.map((p) => p.n));
      const bounds = new mapboxgl.LngLatBounds();
      points.forEach((p) => {
        const size = 30 + (p.n / max) * 26;
        const el = document.createElement("div");
        el.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:${color};
          display:flex;align-items:center;justify-content:center;color:#fff;
          font:600 ${11 + (p.n / max) * 3}px Inter,system-ui,sans-serif;
          box-shadow:0 0 0 6px ${color}22, 0 2px 8px rgba(0,0,0,.18);cursor:pointer;`;
        el.textContent = String(p.n);
        const mk = new mapboxgl.Marker({ element: el })
          .setLngLat([p.lng, p.lat])
          .setPopup(new mapboxgl.Popup({ offset: size / 2, closeButton: false })
            .setHTML(`<strong>${p.name}</strong><br/>${p.n} shipments`))
          .addTo(m);
        markers.current.push(mk);
        bounds.extend([p.lng, p.lat]);
      });
      if (!bounds.isEmpty()) m.fitBounds(bounds, { padding: 56, maxZoom: 3.2, duration: 600 });
    };
    if (m.isStyleLoaded()) draw(); else m.once("load", draw);
  }, [points, color, dir]);

  return <div ref={ref} style={{ width: "100%", height, borderRadius: 12, overflow: "hidden" }} />;
}
