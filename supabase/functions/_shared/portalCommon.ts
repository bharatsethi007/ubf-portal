import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

export async function requireStaff(req: Request): Promise<
  { ok: true; staffId: string; db: SupabaseClient } | { ok: false; response: Response }
> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: ures } = await userClient.auth.getUser();
  if (!ures?.user) return { ok: false, response: json({ error: "unauthorized" }, 401) };

  const { data: staff } = await userClient
    .from("staff_users")
    .select("user_id")
    .eq("user_id", ures.user.id)
    .maybeSingle();
  if (!staff) return { ok: false, response: json({ error: "forbidden" }, 403) };

  return { ok: true, staffId: ures.user.id, db: createClient(url, service) };
}

export function serviceClient(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

export function normalizeEmail(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const clean = email.trim().toLowerCase();
  return clean.includes("@") ? clean : null;
}

export const MIN_PASSWORD_LENGTH = 8;

/** Returns an error message, or null if the password meets minimum length. */
export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  return null;
}

export function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const b64 = btoa(String.fromCharCode(...bytes));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function portalSetPasswordLink(token: string): string {
  const base = (Deno.env.get("PORTAL_PUBLIC_BASE_URL") ?? "").replace(/\/$/, "");
  if (!base) throw new Error("PORTAL_PUBLIC_BASE_URL not configured");
  return `${base}/portal/set-password?token=${encodeURIComponent(token)}`;
}

export async function findAuthUserIdByEmail(
  admin: SupabaseClient,
  email: string,
): Promise<string | null> {
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data?.users?.length) return null;
    const hit = data.users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (hit) return hit.id;
    if (data.users.length < 1000) return null;
    page += 1;
  }
}

export async function resolveAuthUserId(
  admin: SupabaseClient,
  email: string,
): Promise<{ userId: string; created: boolean } | { error: string }> {
  const existingId = await findAuthUserIdByEmail(admin, email);
  if (existingId) return { userId: existingId, created: false };

  const throwaway = generateToken();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password: throwaway,
  });
  if (error) {
    const retryId = await findAuthUserIdByEmail(admin, email);
    if (retryId) return { userId: retryId, created: false };
    return { error: error.message };
  }
  if (!data.user) return { error: "create user failed" };
  return { userId: data.user.id, created: true };
}

export async function issueInviteToken(
  db: SupabaseClient,
  opts: { userId: string; accountId: string; staffId: string },
): Promise<{ token: string; expiresAt: string; link: string }> {
  await db
    .from("portal_invite_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("user_id", opts.userId)
    .is("used_at", null);

  const token = generateToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await db.from("portal_invite_tokens").insert({
    token,
    user_id: opts.userId,
    account_id: opts.accountId,
    expires_at: expiresAt,
    created_by: opts.staffId,
  });
  if (error) throw new Error(error.message);
  return { token, expiresAt, link: portalSetPasswordLink(token) };
}
