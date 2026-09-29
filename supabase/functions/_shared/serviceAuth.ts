// True when the caller holds the project's service key: legacy service_role JWT (exact env match)
// or a new sb_secret_ key (proven by an admin-only call). Never trusts an unverified JWT payload.
import { createClient } from "jsr:@supabase/supabase-js@2";

export async function isServiceCaller(req: Request): Promise<boolean> {
  const tok = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!tok) return false;
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy && tok === legacy) return true;
  if (!tok.startsWith("sb_secret_")) return false;
  const probe = createClient(Deno.env.get("SUPABASE_URL")!, tok, { auth: { persistSession: false } });
  const { error } = await probe.auth.admin.listUsers({ page: 1, perPage: 1 });
  return !error;
}
