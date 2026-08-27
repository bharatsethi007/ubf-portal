import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// On-demand driver run + traffic ETA via Google Routes API.
// Returns the WHOLE run: today's completed stops first (solid on the map), then pending stops
// (dotted red). Per-leg polylines carry a `done` flag. Pending ETAs start from now (the already
// driven legs are not re-counted). body: { driverId, order? } ; order = stop keys for pending.
//
// CORS: invoked from the browser via supabase.functions.invoke, which sends an Authorization
// header and therefore triggers a preflight OPTIONS. Without a CORS/OPTIONS handler the browser
// blocks the call (works server-side, silently fails in-app). Handle OPTIONS + echo CORS on
// every response.

const GKEY = Deno.env.get("GOOGLE_MAPS_API_KEY") ?? "";
const DWELL_SEC = 600;
const OPEN_EXCLUDE = ["complete", "checked_in", "failed", "inComplete", "cancel", "archived"];
const DONE_STATUSES = ["complete", "checked_in"];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const isNZ = (lat: number, lng: number) => lat > -48 && lat < -33 && lng > 165 && lng < 180;
const nearDepot = (lat: number, lng: number, dLat: number, dLng: number) =>
  Math.abs(lat - dLat) < 0.004 && Math.abs(lng - dLng) < 0.004;
const secs = (v: any) => (typeof v === "string" ? parseInt(v.replace("s", ""), 10) : Number(v ?? 0)) || 0;

function haversine(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

type Stop = { key: string; consignmentId: string; consignmentNo: string | null; company: string | null; type: "pickup" | "delivery"; lat: number; lng: number; done: boolean; deliveredAt: string | null };

function stopsFrom(rows: any[], done: boolean, dLat: number, dLng: number): { stops: Stop[]; pairs: Record<string, number> } {
  const stops: Stop[] = [];
  const pairs: Record<string, number> = {};
  for (const c of rows ?? []) {
    const ends: Array<["pickup" | "delivery", any, any, string | null]> = [
      ["pickup", c.sender_lat, c.sender_lng, c.sender_company],
      ["delivery", c.receiver_lat, c.receiver_lng, c.receiver_company],
    ];
    for (const [type, lat, lng, company] of ends) {
      if (lat == null || lng == null) continue;
      const la = Number(lat), ln = Number(lng);
      if (!isNZ(la, ln) || nearDepot(la, ln, dLat, dLng)) continue;
      stops.push({ key: `${c.id}:${type}`, consignmentId: c.id, consignmentNo: c.consignment_no, company, type, lat: la, lng: ln, done, deliveredAt: c.delivered_at ?? null });
      pairs[c.id] = (pairs[c.id] ?? 0) + 1;
    }
  }
  return { stops, pairs };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    if (!GKEY) throw new Error("GOOGLE_MAPS_API_KEY not set");
    const { driverId, order } = await req.json().catch(() => ({}));
    if (!driverId) throw new Error("driverId required");

    const { data: depot } = await supabase
      .from("tms_depots").select("location_lat,location_lng")
      .eq("active", true).not("location_lat", "is", null).limit(1).maybeSingle();
    if (!depot) throw new Error("no depot with coordinates");
    const dLat = Number(depot.location_lat), dLng = Number(depot.location_lng);

    const SEL = "id,consignment_no,status,delivered_at,sender_company,sender_lat,sender_lng,receiver_company,receiver_lat,receiver_lng";
    // pending
    const { data: pend, error: pErr } = await supabase
      .from("tms_consignments").select(SEL)
      .eq("assigned_driver_leg1", driverId).eq("archived", false)
      .not("status", "in", `(${OPEN_EXCLUDE.map((s) => `"${s}"`).join(",")})`);
    if (pErr) throw new Error(`load pending: ${pErr.message}`);
    // completed today
    const { data: donej } = await supabase
      .from("tms_consignments").select(SEL)
      .eq("assigned_driver_leg1", driverId).eq("archived", false)
      .in("status", DONE_STATUSES)
      .gt("delivered_at", new Date(Date.now() - 18 * 3600_000).toISOString());

    const pendingBuilt = stopsFrom(pend ?? [], false, dLat, dLng);
    const doneBuilt = stopsFrom(donej ?? [], true, dLat, dLng);

    // done stops first, in completion order
    const doneStops = doneBuilt.stops.sort((a, b) => (a.deliveredAt ?? "").localeCompare(b.deliveredAt ?? ""));

    // order pending: fixed (dispatcher) > google-optimize (if safe) > nearest-neighbour
    const fixed = Array.isArray(order) && order.length > 0;
    const hasPair = Object.values(pendingBuilt.pairs).some((n) => n > 1);
    let pendingStops = pendingBuilt.stops;
    let optimizePending = !fixed && !hasPair && doneStops.length === 0;

    if (fixed) {
      const byKey = new Map(pendingStops.map((s) => [s.key, s]));
      const seen = new Set<string>();
      const ordered: Stop[] = [];
      for (const k of order as string[]) { const s = byKey.get(k); if (s) { ordered.push(s); seen.add(k) } }
      for (const s of pendingStops) if (!seen.has(s.key)) ordered.push(s);
      pendingStops = ordered;
    } else if (!optimizePending) {
      const ordered: Stop[] = [];
      const rem = [...pendingStops];
      let curLat = doneStops.length ? doneStops[doneStops.length - 1].lat : dLat;
      let curLng = doneStops.length ? doneStops[doneStops.length - 1].lng : dLng;
      while (rem.length) {
        let best = 0, bestD = Infinity;
        for (let i = 0; i < rem.length; i++) {
          const d = haversine(curLat, curLng, rem[i].lat, rem[i].lng);
          if (d < bestD) { bestD = d; best = i }
        }
        const s = rem.splice(best, 1)[0];
        ordered.push(s); curLat = s.lat; curLng = s.lng;
      }
      pendingStops = ordered;
    }

    const D = doneStops.length;
    const seq = [...doneStops, ...pendingStops];
    if (seq.length === 0) {
      return json({ ok: true, stops: [], legs: [], note: "no NZ stops for this driver" });
    }

    const body: any = {
      origin: { location: { latLng: { latitude: dLat, longitude: dLng } } },
      destination: { location: { latLng: { latitude: dLat, longitude: dLng } } },
      intermediates: seq.map((s) => ({ location: { latLng: { latitude: s.lat, longitude: s.lng } }, vehicleStopover: true })),
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      departureTime: new Date(Date.now() + 60000).toISOString(),
      optimizeWaypointOrder: optimizePending,
      units: "METRIC",
      languageCode: "en-NZ",
    };

    const gRes = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GKEY,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.duration,routes.legs.distanceMeters,routes.legs.polyline.encodedPolyline,routes.optimizedIntermediateWaypointIndex",
      },
      body: JSON.stringify(body),
    });
    if (!gRes.ok) {
      const t = await gRes.text();
      throw new Error(`Google Routes ${gRes.status}: ${t.slice(0, 400)}`);
    }
    const gj = await gRes.json();
    const route = gj?.routes?.[0];
    if (!route) throw new Error("Google returned no route");

    const gLegs: any[] = route.legs ?? [];
    // optimize only applies when D===0; otherwise identity
    const idxOrder: number[] = route.optimizedIntermediateWaypointIndex ?? seq.map((_, i) => i);
    const ordered = idxOrder.map((i) => seq[i]);
    const departMs = Date.parse(body.departureTime);

    // legs: N intermediates -> N+1 legs. leg i arrives at ordered[i] (i<N) or depot (i=N).
    const legs = gLegs.map((lg, i) => ({
      polyline: lg?.polyline?.encodedPolyline ?? null,
      done: i < D,            // legs into a completed stop are solid
      durationSec: secs(lg?.duration),
      distanceM: Number(lg?.distanceMeters ?? 0),
    }));

    // ETAs: done stops -> delivered_at; pending stops -> now + remaining legs from the boundary
    let cumPendingSec = 0;
    const outStops = ordered.map((s, k) => {
      let etaMs: number | null;
      if (s.done) {
        etaMs = s.deliveredAt ? Date.parse(s.deliveredAt) : null;
      } else {
        cumPendingSec += secs(gLegs[k]?.duration);
        etaMs = departMs + cumPendingSec * 1000 + DWELL_SEC * 1000 * Math.max(0, k - D);
      }
      return {
        key: s.key, consignmentId: s.consignmentId, consignmentNo: s.consignmentNo, company: s.company,
        type: s.type, lat: s.lat, lng: s.lng, seq: k + 1, done: s.done,
        etaMs, legSec: secs(gLegs[k]?.duration), legM: Number(gLegs[k]?.distanceMeters ?? 0),
      };
    });
    cumPendingSec += secs(gLegs[ordered.length]?.duration);
    const backMs = departMs + cumPendingSec * 1000 + DWELL_SEC * 1000 * Math.max(0, ordered.length - D);

    // persist seq + eta for pending stops only
    for (const s of outStops) {
      if (s.done) continue;
      await supabase.from("tms_consignments")
        .update({ route_seq: s.seq, route_eta: s.etaMs ? new Date(s.etaMs).toISOString() : null })
        .eq("id", s.consignmentId);
    }

    return json({
      ok: true, driverId, optimized: optimizePending, fixedOrder: fixed, doneCount: D,
      depot: { lat: dLat, lng: dLng },
      stops: outStops,
      legs,
      backToDepot: { etaMs: backMs, sec: secs(gLegs[ordered.length]?.duration), m: Number(gLegs[ordered.length]?.distanceMeters ?? 0) },
      polyline: route.polyline?.encodedPolyline ?? null,
      totalSec: secs(route.duration), totalM: Number(route.distanceMeters ?? 0),
    });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
