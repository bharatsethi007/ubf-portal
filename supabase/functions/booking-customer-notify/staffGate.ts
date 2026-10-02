import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2"

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } })

/** Staff JWT required. Returns a service client for writes. */
export async function requireStaff(req: Request): Promise<
  { ok: true; staffId: string; db: SupabaseClient } | { ok: false; response: Response }
> {
  const url = Deno.env.get("SUPABASE_URL")!
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  })
  const { data: ures } = await userClient.auth.getUser()
  if (!ures?.user) return { ok: false, response: json({ error: "unauthorized" }, 401) }
  const { data: staff } = await userClient.from("staff_users").select("user_id").eq("user_id", ures.user.id).maybeSingle()
  if (!staff) return { ok: false, response: json({ error: "forbidden" }, 403) }
  return { ok: true, staffId: ures.user.id, db: createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!) }
}
