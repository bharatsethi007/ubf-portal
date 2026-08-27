import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Navman TN360 fleet tracking poller (cron: every minute, service-role writes).
//
// POSITIONS ENDPOINT QUIRK (verified 27 Aug 2026 via live probe):
//   /vehicles/{id}/positions returns fixes OLDEST-FIRST, hard-capped at 100 rows.
//   `order`/`sort` params are IGNORED; there is no descending/latest mode.
//   With NO window the platform applies a WIDE default window, so a truck that has emitted
//   >100 fixes returns the OLDEST 100 -> computed 'latest' frozen hours behind (the old bug:
//   busy trucks looked stuck). FIX: request a NARROW recent window via from/to (ISO8601 only;
//   epoch ms -> 400).
//
// WINDOW SIZING: the 100-row cap only bites during SUSTAINED motion (>100 fixes in-window).
// Local start-stop trucks emit ~1 fix/min, so a 40-min window is ~40 rows (safe) yet wide
// enough to capture a truck's final RESTING fix even if a poll is missed or after a redeploy
// gap (a parked truck emits no new breadcrumbs, so its last fix must be caught before it ages
// out of the window). A truck parked longer than the window returns 0 rows and correctly keeps
// its already-stored last-known dot. We insert EVERY in-window fix (dedup on
// (tn_vehicle_id, position_timestamp)) so the trail is complete and gaps self-heal.

const BASE = Deno.env.get("NAVMAN_BASE_URL") ?? "https://api-au.telematics.com/v1";
const KEY = Deno.env.get("NAVMAN_API_KEY") ?? "";
const ACTIVE_WINDOW_DAYS = 7;
const POS_WINDOW_MIN = 40; // keep small enough that in-window fix count stays < 100

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function tn(path: string): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${KEY}`, Accept: "application/json" },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`TN360 ${path} -> ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

const msToIso = (ms?: number | null) => (ms ? new Date(ms).toISOString() : null);
function withinDays(ts: string | null | undefined, days: number): boolean {
  if (!ts) return false;
  const t = new Date(ts).getTime();
  return Number.isFinite(t) && Date.now() - t <= days * 86400_000;
}

Deno.serve(async () => {
  const started = Date.now();
  const errors: string[] = [];
  let positionsInserted = 0;
  let driversSynced = 0;

  try {
    if (!KEY) throw new Error("NAVMAN_API_KEY not set");

    const vehicles: any[] = await tn("/vehicles");
    const stats: any[] = await tn("/vehicles/stats");
    const statById = new Map<number, any>(stats.map((s) => [s.vehicleId, s]));

    // --- Drivers (non-fatal) ---
    try {
      const users: any[] = await tn("/users");
      if (Array.isArray(users) && users.length) {
        const driverRows = users.map((u) => ({
          tn_user_id: u.id,
          first_name: u.firstName ?? null,
          last_name: u.lastName ?? null,
          full_name:
            [u.firstName, u.lastName].filter(Boolean).join(" ") ||
            u.username || u.email || String(u.id),
          email: u.email ?? null,
          licence_number: u.licenceNumber ?? null,
          licence_state: u.licenceState ?? null,
          user_type: u.type?.code ?? u.type?.name ?? null,
          status: u.status ?? null,
          tn_company_id: u.companyId ?? null,
          raw: u,
          updated_at: new Date().toISOString(),
        }));
        const { error: dErr } = await supabase
          .from("dispatch_drivers")
          .upsert(driverRows, { onConflict: "tn_user_id" });
        if (dErr) errors.push(`drivers upsert: ${dErr.message}`);
        else driversSynced = driverRows.length;
      }
    } catch (e) {
      errors.push(`users: ${(e as Error).message}`);
    }

    // --- Roster (never overwrite staff is_active) ---
    const { data: existingRows } = await supabase.from("dispatch_vehicles").select("tn_vehicle_id");
    const existing = new Set<number>((existingRows ?? []).map((r: any) => r.tn_vehicle_id));

    const roster = vehicles.map((v) => {
      const s = statById.get(v.id);
      return {
        tn_vehicle_id: v.id,
        tn_device_id: s?.currentDeviceId ?? null,
        tn_company_id: v.companyId ?? v.company?.id ?? null,
        tn_external_id: v.externalId ?? null,
        name: v.name ?? v.registration ?? String(v.id),
        registration: v.registration ?? null,
        registration_state: v.registrationState ?? null,
        vin: v.vin ?? null,
        make: v.make ?? null,
        model: v.model ?? null,
        vehicle_type: v.type?.name ?? null,
        vehicle_type_code: v.type?.code ?? null,
        status: v.status ?? null,
        raw: v,
        updated_at: new Date().toISOString(),
      };
    });
    const { error: upErr } = await supabase
      .from("dispatch_vehicles")
      .upsert(roster, { onConflict: "tn_vehicle_id" });
    if (upErr) throw new Error(`roster upsert: ${upErr.message}`);

    for (const v of vehicles) {
      if (existing.has(v.id)) continue;
      const s = statById.get(v.id);
      const recent = withinDays(s?.lastReadingsAt ?? s?.lastEventAt, ACTIVE_WINDOW_DAYS);
      await supabase.from("dispatch_vehicles").update({ is_active: recent }).eq("tn_vehicle_id", v.id);
    }

    // --- Positions: NARROW recent window -> newest fixes (see header note) ---
    const activeVehicles = vehicles.filter((v) => {
      const s = statById.get(v.id);
      return withinDays(s?.lastReadingsAt ?? s?.lastEventAt, ACTIVE_WINDOW_DAYS);
    });

    const toIso = new Date().toISOString();
    const fromIso = new Date(Date.now() - POS_WINDOW_MIN * 60_000).toISOString();
    const winQs = `from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`;

    for (const v of activeVehicles) {
      try {
        const fixes: any[] = await tn(`/vehicles/${v.id}/positions?${winQs}`);
        if (!Array.isArray(fixes) || fixes.length === 0) continue;
        const s = statById.get(v.id);
        const rows = fixes
          .filter((f) => f.Lat != null && f.Lng != null && f.At != null)
          .map((f) => ({
            tn_vehicle_id: v.id,
            latitude: f.Lat,
            longitude: f.Lng,
            speed: f.Spd ?? null,
            heading: f.Dir ?? null,
            altitude: f.Alt ?? null,
            nsat: f.NSat ?? null,
            hdop: f.HDOP ?? null,
            location: f.location ?? s?.location ?? null,
            last_event_type: s?.lastEventType ?? null,
            last_event_subtype: s?.lastEventSubtype ?? null,
            odometer: s?.gpsOdometer ?? null,
            driver_user_id: s?.currentUserId ?? null,
            position_timestamp: msToIso(f.At),
            source: "navman",
            raw: f,
          }));
        if (rows.length === 0) continue;
        const { error: posErr, count } = await supabase
          .from("dispatch_vehicle_positions")
          .upsert(rows, { onConflict: "tn_vehicle_id,position_timestamp", ignoreDuplicates: true, count: "exact" });
        if (posErr) errors.push(`veh ${v.id} pos: ${posErr.message}`);
        else positionsInserted += count ?? 0;
      } catch (e) {
        errors.push(`veh ${v.id}: ${(e as Error).message}`);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        vehicles_synced: vehicles.length,
        drivers_synced: driversSynced,
        active_polled: activeVehicles.length,
        positions_inserted: positionsInserted,
        errors,
        took_ms: Date.now() - started,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message, errors }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
