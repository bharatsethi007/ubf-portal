import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { C, fmtDay, titleCase } from "./towerTheme";
import { CountUp } from "./towerUi";
import { MAP_CSS, positionOf, routeOf, shipmentNo, unwrap } from "./transitModel";
import { TransitDrawer, type DrawerState } from "./TransitDrawer";
import { useTowerRpc, type TransitShipment } from "./useTower";

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;
const FONT = ["DIN Pro Medium", "Arial Unicode MS Regular"];
const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
const PACIFIC: [[number, number], [number, number]] = [[95, -48], [215, 42]];
type Mode = "all" | "sea" | "air";
type Dir = "all" | "import" | "export";

/* Flexport-style map: in-transit shipments clustered by position. Click a cluster to zoom in;
   when it cannot split further it opens a list. Click a shipment to open its drawer and route. */
export function TransitMap({ className }: { className?: string }) {
  const { data } = useTowerRpc<TransitShipment[]>("tower_transit", null, ["shipments"], 300_000);
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<Mode>("all");
  const [dir, setDir] = useState<Dir>("all");
  const [drawer, setDrawer] = useState<DrawerState | null>(null);

  const ships = useMemo(() => (data ?? []).filter((s) =>
    (mode === "all" || s.mode === mode) && (dir === "all" || s.dir === dir)), [data, mode, dir]);
  const byId = useRef(new Map<number, TransitShipment>());
  byId.current = new Map((data ?? []).map((s) => [s.id, s]));

  useEffect(() => {
    if (!box.current || !TOKEN) return;
    mapboxgl.accessToken = TOKEN;
    const map = new mapboxgl.Map({
      container: box.current, style: "mapbox://styles/mapbox/light-v11", projection: "mercator",
      bounds: PACIFIC, fitBoundsOptions: { padding: { top: 30, bottom: 30, left: 290, right: 30 } },
      renderWorldCopies: true, attributionControl: false, cooperativeGestures: true, dragRotate: false,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-left");
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");
    mapRef.current = map;
    const tip = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, className: "tw-pop", offset: 14 });

    map.on("load", () => {
      map.addSource("tw-ships", { type: "geojson", data: EMPTY, cluster: true, clusterRadius: 50, clusterMaxZoom: 7 });
      map.addSource("tw-route", { type: "geojson", data: EMPTY });
      map.addLayer({ id: "tw-route-done", type: "line", source: "tw-route", filter: ["==", ["get", "part"], "done"], layout: { "line-cap": "round" }, paint: { "line-color": C.navy, "line-width": 2.5 } });
      map.addLayer({ id: "tw-route-todo", type: "line", source: "tw-route", filter: ["==", ["get", "part"], "todo"], paint: { "line-color": C.navy, "line-width": 2, "line-opacity": 0.55, "line-dasharray": [2, 2.5] } });
      map.addLayer({ id: "tw-route-port", type: "circle", source: "tw-route", filter: ["==", ["get", "part"], "port"], paint: { "circle-radius": 5, "circle-color": "#fff", "circle-stroke-color": C.navy, "circle-stroke-width": 3 } });
      map.addLayer({ id: "tw-route-lbl", type: "symbol", source: "tw-route", filter: ["==", ["get", "part"], "port"], layout: { "text-field": ["get", "code"], "text-font": FONT, "text-size": 12, "text-anchor": "left", "text-offset": [0.9, 0] }, paint: { "text-color": C.navy, "text-halo-color": "#fff", "text-halo-width": 2 } });
      map.addLayer({ id: "tw-cl-halo", type: "circle", source: "tw-ships", filter: ["has", "point_count"], paint: { "circle-color": C.navy, "circle-opacity": 0.14, "circle-radius": ["step", ["get", "point_count"], 22, 5, 26, 15, 31, 40, 36] } });
      map.addLayer({ id: "tw-cl", type: "circle", source: "tw-ships", filter: ["has", "point_count"], paint: { "circle-color": C.navy, "circle-stroke-color": "#fff", "circle-stroke-width": 2.5, "circle-radius": ["step", ["get", "point_count"], 15, 5, 19, 15, 24, 40, 29] } });
      map.addLayer({ id: "tw-cl-n", type: "symbol", source: "tw-ships", filter: ["has", "point_count"], layout: { "text-field": ["get", "point_count_abbreviated"], "text-font": FONT, "text-size": 12, "text-allow-overlap": true }, paint: { "text-color": "#fff" } });
      map.addLayer({ id: "tw-pt", type: "circle", source: "tw-ships", filter: ["!", ["has", "point_count"]], paint: {
        "circle-radius": 6.5, "circle-stroke-color": "#fff", "circle-stroke-width": 2.5,
        "circle-color": ["case", ["==", ["get", "sel"], 1], C.orange, ["==", ["get", "live"], 1], C.live, C.blue] } });

      for (const id of ["tw-cl", "tw-pt"]) {
        map.on("mouseenter", id, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", id, () => { map.getCanvas().style.cursor = ""; tip.remove(); });
      }
      map.on("mousemove", "tw-pt", (e) => {
        const s = byId.current.get(Number(e.features?.[0]?.properties?.id));
        if (!s) return;
        tip.setLngLat(e.lngLat).setHTML(`<b>${shipmentNo(s)}</b> · ${titleCase(s.customer)}<br>${s.o} → ${s.d} · ETA ${fmtDay(s.eta)}${s.live?.kn != null ? ` · ${Math.round(s.live.kn * 10) / 10} kn` : ""}`).addTo(map);
      });
      map.on("mousemove", "tw-cl", (e) => {
        const n = e.features?.[0]?.properties?.point_count;
        tip.setLngLat(e.lngLat).setHTML(`<b>${n} shipments</b><br>Click to zoom in`).addTo(map);
      });
      map.on("click", "tw-pt", (e) => {
        const s = byId.current.get(Number(e.features?.[0]?.properties?.id));
        if (s) setDrawer((d) => ({ list: d?.list ?? null, focus: s }));
      });
      map.on("click", "tw-cl", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const src = map.getSource("tw-ships") as mapboxgl.GeoJSONSource;
        const cid = Number(f.properties?.cluster_id), count = Number(f.properties?.point_count);
        const center = (f.geometry as GeoJSON.Point).coordinates as [number, number];
        src.getClusterExpansionZoom(cid, (err, zoom) => {
          if (err || zoom == null) return;
          if (zoom <= 7 && map.getZoom() < 7) { map.easeTo({ center, zoom: zoom + 0.2, duration: 600 }); return; }
          src.getClusterLeaves(cid, count, 0, (e2, leaves) => {
            if (e2 || !leaves) return;
            const list = leaves.map((l) => byId.current.get(Number(l.properties?.id))).filter((s): s is TransitShipment => !!s);
            setDrawer({ list, focus: null });
          });
        });
      });
      setReady(true);
    });
    return () => { tip.remove(); map.remove(); mapRef.current = null; setReady(false); };
  }, []);

  /* Shipment points; the focused one is flagged so it renders orange. */
  const focusId = drawer?.focus?.id ?? null;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (map.getSource("tw-ships") as mapboxgl.GeoJSONSource).setData({ type: "FeatureCollection", features: ships.map((s) => ({
      type: "Feature", geometry: { type: "Point", coordinates: positionOf(s) },
      properties: { id: s.id, live: s.live ? 1 : 0, sel: s.id === focusId ? 1 : 0 },
    })) });
  }, [ships, ready, focusId]);

  /* Route for the focused shipment: sailed part solid, remaining dashed. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const src = map.getSource("tw-route") as mapboxgl.GeoJSONSource;
    const s = drawer?.focus;
    if (!s) { src.setData(EMPTY); return; }
    const r = routeOf(s);
    src.setData({ type: "FeatureCollection", features: [
      { type: "Feature", geometry: { type: "LineString", coordinates: r.done }, properties: { part: "done" } },
      { type: "Feature", geometry: { type: "LineString", coordinates: r.todo }, properties: { part: "todo" } },
      { type: "Feature", geometry: { type: "Point", coordinates: r.line[0] }, properties: { part: "port", code: s.o } },
      { type: "Feature", geometry: { type: "Point", coordinates: r.line[r.line.length - 1] }, properties: { part: "port", code: s.d } },
    ] });
    const b = new mapboxgl.LngLatBounds(r.line[0], r.line[0]);
    [...r.line, positionOf(s)].forEach((p) => b.extend(p));
    map.fitBounds(b, { padding: { top: 60, bottom: 60, left: 300, right: 460 }, maxZoom: 5, duration: 900 });
  }, [drawer?.focus, ready]);

  const close = () => {
    setDrawer(null);
    mapRef.current?.fitBounds(PACIFIC.map(([x, y]) => [unwrap(x), y]) as [[number, number], [number, number]], { padding: { top: 30, bottom: 30, left: 290, right: 30 }, duration: 900 });
  };

  if (!TOKEN) return <div className={`tw-map tw-map--empty ${className ?? ""}`}><style>{MAP_CSS}</style>Map unavailable. Mapbox token missing.</div>;
  const sea = ships.filter((s) => s.mode === "sea").length;
  const live = ships.filter((s) => s.live).length;

  return (
    <div className={`tw-map ${className ?? ""}`}>
      <style>{MAP_CSS}</style>
      <div ref={box} className="tw-map__canvas" />
      <div className="tw-map__panel">
        <div className="tw-map__title">Shipments in transit</div>
        <Seg value={mode} onChange={setMode} items={[["all", "All"], ["sea", "Sea"], ["air", "Air"]]} label="Mode" />
        <Seg value={dir} onChange={setDir} items={[["all", "Both"], ["import", "Import"], ["export", "Export"]]} label="Direction" />
        <div className="tw-map__meta">{data ? `${ships.length} shipments · ${live} with live AIS` : "Loading shipments…"}</div>
        <div className="tw-legend">
          <span><i style={{ background: C.navy }} />Group, click to zoom in</span>
          <span><i style={{ background: C.live, boxShadow: "0 0 0 3px rgba(5,150,105,.2)" }} />Live vessel position</span>
          <span><i style={{ background: C.blue, boxShadow: "0 0 0 3px rgba(37,99,235,.2)" }} />Estimated from ETD and ETA</span>
        </div>
        <div className="tw-mstats">
          <div>At sea<CountUp value={sea} /></div>
          <div>In air<CountUp value={ships.length - sea} /></div>
          <div>Live AIS<CountUp value={live} /></div>
        </div>
      </div>
      {drawer && (
        <TransitDrawer state={drawer} onClose={close}
          onFocus={(s) => setDrawer((d) => ({ list: d?.list ?? null, focus: s }))}
          onBack={() => setDrawer((d) => (d ? { list: d.list, focus: null } : d))} />
      )}
    </div>
  );
}

function Seg<K extends string>({ value, onChange, items, label }: { value: K; onChange: (k: K) => void; items: [K, string][]; label: string }) {
  return (
    <div className="tw-seg" role="group" aria-label={label}>
      {items.map(([k, t]) => <button key={k} type="button" aria-pressed={k === value} onClick={() => onChange(k)}>{t}</button>)}
    </div>
  );
}
