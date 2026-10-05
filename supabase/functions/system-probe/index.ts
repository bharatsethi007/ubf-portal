// system-probe (verify_jwt = false; own auth). pg_cron every 15 min + nightly.
// action "probe":   reachability check per provider (any HTTP < 500 = up, no billing),
//                   plus free authed checks (Anthropic models, Brevo account, S3 round trip).
// action "storage": S3 object count + bytes per area -> storage_snapshots.
// Auth: service-role bearer (cron) OR signed-in staff (Refresh button in System Health).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { isServiceCaller } from "../_shared/serviceAuth.ts";
import { deleteObject, getObject, putObject, S3_BUCKET, S3_REGION } from "../_shared/s3.ts";
import { AwsClient } from "npm:aws4fetch@1.0.20";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const AREAS = [
  "booking-documents", "sli-uploads", "booking-emails", "whatsapp-media", "csat", "conferences", "fleet",
  "fleet-docs", "checkin", "meeting-audio", "courier-labels", "avatars", "archive", "_health",
];

type Provider = { code: string; probe_url: string | null; probe_auth: boolean };
type Check = { provider: string; ok: boolean; status: number | null; ms: number; error: string | null };

async function timed(fn: () => Promise<Response>, okWhen: (r: Response) => boolean): Promise<Omit<Check, "provider">> {
  const t0 = performance.now();
  try {
    const r = await fn();
    await r.body?.cancel().catch(() => {});
    const ok = okWhen(r);
    return { ok, status: r.status, ms: Math.round(performance.now() - t0), error: ok ? null : `HTTP ${r.status}` };
  } catch (e) {
    return { ok: false, status: null, ms: Math.round(performance.now() - t0), error: String(e instanceof Error ? e.message : e).slice(0, 300) };
  }
}

const withTimeout = (url: string, init: RequestInit = {}) =>
  fetch(url, { ...init, signal: AbortSignal.timeout(10_000), redirect: "manual" });

async function checkOne(p: Provider): Promise<Check> {
  // Free authed checks prove the key works, not just the host.
  if (p.code === "anthropic") {
    const key = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
    const r = await timed(() => withTimeout("https://api.anthropic.com/v1/models?limit=1", {
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
    }), (r) => r.ok);
    return { provider: p.code, ...r };
  }
  if (p.code === "brevo") {
    const r = await timed(() => withTimeout("https://api.brevo.com/v3/account", {
      headers: { "api-key": Deno.env.get("BREVO_API_KEY") ?? "", accept: "application/json" },
    }), (r) => r.ok);
    return { provider: p.code, ...r };
  }
  if (p.code === "s3") {
    const t0 = performance.now();
    const key = `_health/probe-${Date.now()}.txt`;
    try {
      await putObject(key, "ok", "text/plain");
      const back = await (await getObject(key)).text();
      await deleteObject(key);
      const ok = back === "ok";
      return { provider: "s3", ok, status: 200, ms: Math.round(performance.now() - t0), error: ok ? null : "read-back mismatch" };
    } catch (e) {
      return { provider: "s3", ok: false, status: null, ms: Math.round(performance.now() - t0), error: String(e).slice(0, 300) };
    }
  }
  if (!p.probe_url) return { provider: p.code, ok: false, status: null, ms: 0, error: "no probe url" };
  // Reachability only: unauthenticated request, never billed. Any reply under 500 means the service is up.
  const r = await timed(() => withTimeout(p.probe_url!, { method: "GET" }), (r) => r.status < 500);
  return { provider: p.code, ...r };
}

async function storageSnapshot() {
  const aws = new AwsClient({
    accessKeyId: Deno.env.get("AWS_ACCESS_KEY_ID")!,
    secretAccessKey: Deno.env.get("AWS_SECRET_ACCESS_KEY")!,
    region: S3_REGION,
    service: "s3",
  });
  const base = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/`;
  const rows: { area: string; objects: number; bytes: number }[] = [];
  for (const area of AREAS) {
    let token: string | null = null, objects = 0, bytes = 0, pages = 0;
    do {
      const u = new URL(base);
      u.searchParams.set("list-type", "2");
      u.searchParams.set("prefix", `${area}/`);
      u.searchParams.set("max-keys", "1000");
      if (token) u.searchParams.set("continuation-token", token);
      const r = await aws.fetch(u.toString());
      if (!r.ok) throw new Error(`S3 list ${area} ${r.status}`);
      const xml = await r.text();
      for (const m of xml.matchAll(/<Size>(\d+)<\/Size>/g)) { objects++; bytes += Number(m[1]); }
      token = /<IsTruncated>true<\/IsTruncated>/.test(xml)
        ? (xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/)?.[1] ?? null)
        : null;
      pages++;
    } while (token && pages < 500);
    if (objects > 0) rows.push({ area, objects, bytes });
  }
  return rows;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!(await isServiceCaller(req))) {
    const uc = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: u } = await uc.auth.getUser();
    if (!u?.user) return json({ error: "unauthorized" }, 401);
    const { data: staff } = await uc.from("staff_users").select("user_id").eq("user_id", u.user.id).maybeSingle();
    if (!staff) return json({ error: "forbidden" }, 403);
  }

  const db = createClient(url, service, { auth: { persistSession: false } });
  const body = await req.json().catch(() => ({}));
  const action = body?.action === "storage" ? "storage" : "probe";

  try {
    if (action === "storage") {
      const rows = await storageSnapshot();
      if (rows.length) {
        const { error } = await db.from("storage_snapshots").insert(rows);
        if (error) throw new Error(error.message);
      }
      return json({ ok: true, areas: rows.length, bytes: rows.reduce((s, r) => s + r.bytes, 0) });
    }

    const { data: providers, error } = await db.from("api_providers")
      .select("code, probe_url, probe_auth").eq("active", true);
    if (error) throw new Error(error.message);
    const checks = await Promise.all((providers as Provider[]).map(checkOne));
    const { error: insErr } = await db.from("api_health_checks").insert(checks);
    if (insErr) throw new Error(insErr.message);
    return json({ ok: true, up: checks.filter((c) => c.ok).length, total: checks.length, checks });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
