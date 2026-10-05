// INERT. One-off Navman position backfill (paged the oldest-100 /positions endpoint to
// un-stick trucks after the v6->v8 transition, 27 Aug 2026). Neutralised; safe to delete
// from the Supabase dashboard.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
Deno.serve(() => new Response(JSON.stringify({ ok: false, note: "navman-probe retired" }), { status: 410, headers: { "Content-Type": "application/json" } }));
