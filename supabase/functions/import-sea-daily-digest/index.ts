// Import Sea 7am digest. Cron (service role) sends to all subscribers once per NZ day.
// Staff can POST { test: true } with their own JWT to get a copy sent only to themselves.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { renderDigest, type DigestRow } from "./digestEmail.ts";
import { apiFetch, setApiFn } from "../_shared/apiFetch.ts";
setApiFn("import-sea-daily-digest");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });
}

function nzNow() {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-NZ", {
    timeZone: "Pacific/Auckland", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false,
  }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: parseInt(p.hour as string, 10) % 24 };
}

function jwtRole(auth: string | null): string | null {
  try {
    const tok = (auth ?? "").replace(/^Bearer\s+/i, "");
    const payload = JSON.parse(atob(tok.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.role ?? null;
  } catch { return null; }
}

// Cron sends the new-style sb_secret_ key; legacy callers send a service_role JWT.
// A secret key is proven by calling an RPC only service_role may execute.
async function isServiceCaller(auth: string | null): Promise<boolean> {
  if (jwtRole(auth) === "service_role") return true;
  const tok = (auth ?? "").replace(/^Bearer\s+/i, "");
  if (!tok.startsWith("sb_secret_")) return false;
  const probe = createClient(Deno.env.get("SUPABASE_URL")!, tok, { auth: { persistSession: false } });
  const { error } = await probe.rpc("import_sea_digest_rows", { p_today: "2000-01-01" });
  return !error;
}

async function send(to: { email: string; name?: string }[], subject: string, html: string, text: string) {
  const key = Deno.env.get("BREVO_API_KEY");
  if (!key) { console.error("BREVO_API_KEY not set"); return false; }
  const from = Deno.env.get("STAFF_INVITE_FROM_EMAIL") ?? "no-reply@ubfreight.com";
  let ok = true;
  // One message per recipient so staff never see each other's addresses.
  for (const r of to) {
    const resp = await apiFetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ sender: { email: from, name: "UBF Import Sea" }, to: [r], subject, htmlContent: html, textContent: text }),
    });
    if (!resp.ok) { ok = false; console.error("brevo", r.email, resp.status, await resp.text()); }
  }
  return ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const authHeader = req.headers.get("Authorization");
    const isService = await isServiceCaller(authHeader);
    const body = await req.json().catch(() => ({}));
    const nz = nzNow();

    let recipients: { email: string; name?: string }[] = [];

    if (isService) {
      const force = new URL(req.url).searchParams.get("force") === "1";
      if (!force && nz.hour !== 7) return json({ skipped: `NZ hour ${nz.hour}, not 7`, nzDate: nz.date });
      if (!force) {
        const { data: done } = await admin.from("import_sea_digest_log").select("nz_date").eq("nz_date", nz.date).maybeSingle();
        if (done) return json({ skipped: "already sent today", nzDate: nz.date });
      }
      const { data: subs, error } = await admin.from("import_sea_digest_subscriptions")
        .select("user:staff_users!inner(email,full_name,is_active)");
      if (error) throw error;
      recipients = (subs ?? [])
        .map((s: any) => s.user)
        .filter((u: any) => u?.is_active && u?.email)
        .map((u: any) => ({ email: u.email, name: u.full_name ?? undefined }));
    } else {
      // Staff self-test: send only to the caller.
      if (!body?.test) return json({ error: "forbidden" }, 403);
      const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader ?? "" } },
      });
      const { data: u } = await userClient.auth.getUser();
      if (!u?.user) return json({ error: "unauthorised" }, 401);
      const { data: staff } = await admin.from("staff_users").select("email,full_name,is_active").eq("user_id", u.user.id).maybeSingle();
      if (!staff?.is_active || !staff.email) return json({ error: "staff only" }, 403);
      recipients = [{ email: staff.email, name: staff.full_name ?? undefined }];
    }

    const { data: rows, error: rowsErr } = await admin.rpc("import_sea_digest_rows", { p_today: nz.date });
    if (rowsErr) throw rowsErr;
    const { html, text, subject } = renderDigest((rows ?? []) as DigestRow[], nz.date);

    const sent = recipients.length ? await send(recipients, subject, html, text) : false;

    if (isService && new URL(req.url).searchParams.get("force") !== "1") {
      await admin.from("import_sea_digest_log").upsert({ nz_date: nz.date, recipients: recipients.length }, { onConflict: "nz_date" });
    }

    return json({ nzDate: nz.date, rows: (rows ?? []).length, recipients: recipients.length, sent });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
