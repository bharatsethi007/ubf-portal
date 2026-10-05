// rate-search — AI Rates tab. Given a lane (POL/POD + mode/type/container) returns
// matching rate-card options (FCL/LCL/air) with buy, markup-derived sell, transit,
// carrier and validity, via the search_rates RPC. Auth: x-ubf-secret shared secret.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ALLOWED_ORIGIN = "https://ubf-outlook.netlify.app";
const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-ubf-secret",
  "Access-Control-Max-Age": "86400",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json", ...cors } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const secret = Deno.env.get("QUOTE_INGEST_SECRET");
  if (!secret || req.headers.get("x-ubf-secret") !== secret) return json({ error: "unauthorized" }, 401);
  const url = Deno.env.get("SUPABASE_URL"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !service) return json({ error: "missing supabase env" }, 500);
  const db = createClient(url, service);

  let b: { pol?: string; pod?: string; mode?: string; type?: string; container?: string };
  try { b = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  if (!b.pod) return json({ error: "POD required" }, 400);

  const { data, error } = await db.rpc("search_rates", {
    p_pol: b.pol ?? "", p_pod: b.pod ?? "", p_mode: b.mode ?? null, p_type: b.type ?? null, p_container: b.container ?? null,
  });
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, options: data ?? [] });
});
