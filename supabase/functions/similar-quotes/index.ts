// similar-quotes — AI Rates tab. Given a lane (+ optional customer account) returns
// past quotes on that lane with their outcome (open/won/lost) and last response's
// sell total + margin, via the similar_quotes RPC. Auth: x-ubf-secret shared secret.
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

  let b: { pol?: string; pod?: string; account?: string };
  try { b = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }

  const { data, error } = await db.rpc("similar_quotes", {
    p_pol: b.pol ?? "", p_pod: b.pod ?? "", p_account: b.account ?? null,
  });
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, quotes: data ?? [] });
});
