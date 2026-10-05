// entity-search — called by the UBF Outlook add-in when the user overrides a
// suggested party match or types a name to search. Wraps the search_entities
// RPC (trigram + distinctive-token matching over customers/agents).
//
// Auth: shared secret in the `x-ubf-secret` header (env QUOTE_INGEST_SECRET).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ALLOWED_ORIGIN = "https://ubf-outlook.netlify.app";
const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-ubf-secret",
  "Access-Control-Max-Age": "86400",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const secret = Deno.env.get("QUOTE_INGEST_SECRET");
  if (!secret || req.headers.get("x-ubf-secret") !== secret) return json({ error: "unauthorized" }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !service) return json({ error: "missing supabase env" }, 500);
  const db = createClient(url, service);

  let body: { query?: string; limit?: number };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  const q = (body.query ?? "").trim();
  if (q.length < 2) return json({ normalized: "", customers: [], agents: [] });

  const lim = Math.min(Math.max(Number(body.limit) || 6, 1), 12);
  const { data, error } = await db.rpc("search_entities", { q, lim });
  if (error) return json({ error: error.message }, 500);
  return json(data ?? { normalized: "", customers: [], agents: [] });
});
