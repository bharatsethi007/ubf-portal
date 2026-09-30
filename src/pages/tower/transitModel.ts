import type { TransitShipment } from "./useTower";

export type LngLat = [number, number];

/* Pacific-centred longitudes: west of -30° wraps to 330+, so Samoa sits next to Fiji, not beside Africa. */
export const unwrap = (lng: number) => (lng < -30 ? lng + 360 : lng);

export function greatCircle(a: LngLat, b: LngLat, n = 64): LngLat[] {
  const r = Math.PI / 180, [l1, p1] = [a[0] * r, a[1] * r], [l2, p2] = [b[0] * r, b[1] * r];
  const d = 2 * Math.asin(Math.sqrt(Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin((l2 - l1) / 2) ** 2));
  if (!d) return [a, b];
  const out: LngLat[] = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n, A = Math.sin((1 - f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(p1) * Math.cos(l1) + B * Math.cos(p2) * Math.cos(l2);
    const y = A * Math.cos(p1) * Math.sin(l1) + B * Math.cos(p2) * Math.sin(l2);
    const z = A * Math.sin(p1) + B * Math.sin(p2);
    out.push([Math.atan2(y, x) / r, Math.atan2(z, Math.sqrt(x * x + y * y)) / r]);
  }
  // Keep the line continuous across the dateline for Mapbox.
  for (let i = 1; i < out.length; i++) {
    while (out[i][0] - out[i - 1][0] > 180) out[i][0] -= 360;
    while (out[i][0] - out[i - 1][0] < -180) out[i][0] += 360;
  }
  const shift = unwrap(out[0][0]) - out[0][0];
  return out.map(([x, y]) => [x + shift, y]);
}

export function routeOf(s: TransitShipment) {
  const line = greatCircle([s.olng, s.olat], [s.dlng, s.dlat]);
  const k = Math.round(Math.min(1, Math.max(0, s.frac)) * (line.length - 1));
  return { line, done: line.slice(0, k + 1), todo: line.slice(k) };
}

/* Live AIS fix when we have one, else a point along the route at the elapsed share of ETD to ETA. */
export function positionOf(s: TransitShipment): LngLat {
  if (s.live) return [unwrap(Number(s.live.lng)), Number(s.live.lat)];
  const { line } = routeOf(s);
  const p = line[Math.round(s.frac * (line.length - 1))];
  return [unwrap(p[0]), p[1]];
}

export function shipmentNo(s: Pick<TransitShipment, "module" | "ship_no" | "job_no" | "hbl" | "id">) {
  const mod = (s.module ?? "").toUpperCase();
  if (mod.startsWith("FI") && s.ship_no != null) return `${mod}-${s.ship_no}${(s.job_no ?? 0) > 1 ? `/${s.job_no}` : ""}`;
  if (s.job_no != null && mod) return `${mod}-${s.job_no}`;
  return s.hbl ?? `#${s.id}`;
}

export function daysToEta(eta: string) {
  const today = new Date(new Date().toLocaleDateString("en-CA", { timeZone: "Pacific/Auckland" }) + "T00:00:00");
  return Math.round((new Date(eta + "T00:00:00").getTime() - today.getTime()) / 864e5);
}

export const MAP_CSS = `
.tw-map{position:relative;height:520px;border-radius:12px;overflow:hidden;border:1px solid var(--line);background:#EEF2F6;box-shadow:var(--shadow);animation:tw-rise .5s var(--ease) both}
.tw-map__canvas{position:absolute;inset:0}
.tw-map__panel{position:absolute;left:14px;top:14px;z-index:2;width:260px;padding:14px;background:rgba(255,255,255,.96);border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow-lg);display:flex;flex-direction:column;gap:10px}
.tw-map__title{font-size:14px;font-weight:600;color:var(--ink)}
.tw-map__meta{font-size:12px;color:var(--muted)}
.tw-seg{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;padding:3px;gap:2px;border-radius:8px;background:var(--line-soft)}
.tw-seg button{height:28px;border:0;border-radius:6px;background:transparent;font:inherit;font-size:12px;font-weight:500;color:var(--muted);cursor:pointer}
.tw-seg button[aria-pressed="true"]{background:#fff;color:var(--ink);box-shadow:0 1px 2px rgba(15,23,42,.1)}
.tw-legend{display:flex;flex-direction:column;gap:6px;font-size:12px;color:var(--ink-2)}
.tw-legend span{display:flex;align-items:center;gap:8px}
.tw-legend i{width:10px;height:10px;border-radius:50%;display:inline-block}
.tw-mstats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding-top:10px;border-top:1px solid var(--line-soft)}
.tw-mstats div{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
.tw-mstats span{display:block;font-size:18px;color:var(--ink);font-weight:600;text-transform:none;letter-spacing:-.01em}
.tw-map--empty{display:flex;align-items:center;justify-content:center;color:var(--muted)}
.tw-pop .mapboxgl-popup-content{border-radius:10px;border:1px solid var(--line);box-shadow:var(--shadow-lg);padding:8px 10px;font:12px 'Inter Variable',Inter,sans-serif;color:var(--ink-2)}
.tw-pop .mapboxgl-popup-tip{display:none}
.tw-pop b{color:var(--ink);font-weight:600}
.tw-drawer{position:absolute;right:12px;top:12px;bottom:12px;z-index:3;width:420px;max-width:calc(100% - 24px);background:#fff;border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow-lg);display:flex;flex-direction:column;overflow:hidden;animation:tw-slidein .28s var(--ease) both}
.tw-dh{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:16px;border-bottom:1px solid var(--line-soft)}
.tw-dh__t{font-size:15px;font-weight:600;color:var(--ink)}
.tw-dh__s{font-size:12px;color:var(--muted);margin-top:2px}
.tw-dlist{list-style:none;margin:0;padding:6px;overflow-y:auto}
.tw-dlist li{animation:tw-rise .3s var(--ease) both}
.tw-drow{width:100%;display:flex;align-items:center;gap:10px;padding:10px;border:0;border-radius:8px;background:transparent;font:inherit;text-align:left;cursor:pointer}
.tw-drow:hover{background:var(--bg)}
.tw-drow__m{flex:1;display:flex;flex-direction:column;gap:2px;min-width:0}
.tw-drow__no{color:var(--ink);font-weight:500}
.tw-drow__s{font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tw-dbody{padding:16px;overflow-y:auto;display:flex;flex-direction:column;gap:16px}
.tw-back{display:inline-flex;align-items:center;gap:4px;border:0;background:none;color:var(--blue);font:inherit;font-size:13px;font-weight:500;cursor:pointer;padding:0;align-self:flex-start}
.tw-pk__head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
.tw-pk__id{display:flex;gap:12px;min-width:0}
.tw-pk__mode{width:34px;height:34px;border-radius:8px;background:#E8EDF7;color:var(--navy);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.tw-pk__no{font-size:20px;font-weight:600;color:var(--ink);line-height:1.2}
.tw-pk__sub{font-size:13px;color:var(--muted);margin-top:2px}
.tw-route{display:flex;flex-direction:column;gap:12px;padding:14px;border-radius:10px;background:#F8FAFC;border:1px solid var(--line-soft)}
.tw-ends{display:flex;justify-content:space-between;gap:10px}
.tw-ends>div{display:flex;flex-direction:column;gap:2px;min-width:0}
.tw-ends>div:last-child{align-items:flex-end;text-align:right}
.tw-code{font-size:18px;font-weight:600;color:var(--ink)}
.tw-city{font-size:12px;color:var(--ink-2)}
.tw-date{font-size:12px;color:var(--muted)}
.tw-prog{height:6px;border-radius:99px;background:var(--line);overflow:hidden;position:relative}
.tw-prog i{position:absolute;left:0;top:0;bottom:0;background:var(--blue);border-radius:99px;transform-origin:left;animation:tw-gx .8s var(--ease) both}
.tw-progmeta{display:flex;justify-content:space-between;font-size:12px;color:var(--muted)}
.tw-steps{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(4,1fr);position:relative}
.tw-steps::before{content:'';position:absolute;left:12%;right:12%;top:5px;height:2px;background:var(--line)}
.tw-steps li{position:relative;display:flex;flex-direction:column;align-items:center;gap:6px}
.tw-steps .d{width:12px;height:12px;border-radius:50%;background:#fff;border:2px solid #CBD5E1;z-index:1}
.tw-steps .lb{font-size:11px;color:var(--faint)}
.tw-steps .done .d{background:var(--blue);border-color:var(--blue)}.tw-steps .done .lb{color:var(--ink-2)}
.tw-steps .next .d{border-color:var(--blue);box-shadow:0 0 0 4px rgba(37,99,235,.15)}
.tw-facts{margin:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 18px}
.tw-facts div{display:flex;flex-direction:column;gap:2px;min-width:0}
.tw-facts dt{font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:.04em;color:var(--faint)}
.tw-facts dd{margin:0;font-size:13px;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tw-ais{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;background:var(--live-soft);color:var(--live);font-size:12.5px}
.tw-est{font-size:12px;color:var(--muted)}
.tw-actions{display:flex;flex-wrap:wrap;gap:8px;padding-top:14px;border-top:1px solid var(--line-soft)}
@media (max-width:640px){.tw-map__panel{width:auto;right:14px}.tw-drawer{width:auto;left:12px}}
`;
