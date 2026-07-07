// RETIRED — replaced by portal-activate (staff set-password link flow).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  return new Response(
    JSON.stringify({ error: "retired", message: "Use portal-activate instead." }),
    { status: 410, headers: { ...cors, "Content-Type": "application/json" } },
  );
});
