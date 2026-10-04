// files-sign (verify_jwt = false; auth checked here).
// Single gateway to the S3 bucket. Supabase stores paths only.
//
// POST { op: "get"|"put"|"delete", keys: string[], expires?, download? }
//   -> { items: [{ key, url? }] }   (delete runs server-side, no url)
// GET  /files-sign/o/<key>  -> 302 to short-lived URL. Public areas only (for <img src>).
// POST { op: "health" | "migrate" }  service-role only.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { presign, putObject, deleteObject, getObject, listKeys, S3_BUCKET, S3_REGION } from "../_shared/s3.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const URL_ = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Areas = old Supabase bucket names. Public areas: anyone may GET.
const AREAS = [
  "booking-documents", "sli-uploads", "booking-emails", "whatsapp-media", "csat", "conferences",
  "fleet", "fleet-docs", "checkin", "meeting-audio", "courier-labels", "avatars",
];
const PUBLIC_READ = new Set(["csat", "conferences", "fleet", "avatars"]);

type Op = "get" | "put" | "delete";
type Who = { kind: "service" } | { kind: "staff" } | { kind: "customer"; account: string | null } | { kind: "anon" };

function split(key: string): [string, string[]] | null {
  if (typeof key !== "string" || !key || key.length > 900 || key.includes("..") || key.startsWith("/")) return null;
  const parts = key.split("/");
  if (parts.length < 2 || !AREAS.includes(parts[0]) || parts.some((p) => !p)) return null;
  return [parts[0], parts.slice(1)];
}

async function whoAmI(req: Request): Promise<{ who: Who; client: ReturnType<typeof createClient> }> {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (token && token === SERVICE) return { who: { kind: "service" }, client: createClient(URL_, SERVICE) };
  const client = createClient(URL_, ANON, { global: { headers: { Authorization: auth || `Bearer ${ANON}` } } });
  if (!token || token === ANON) return { who: { kind: "anon" }, client };
  const { data } = await client.auth.getUser(token);
  if (!data?.user) return { who: { kind: "anon" }, client: createClient(URL_, ANON) };
  const { data: staff } = await client.rpc("is_staff");
  if (staff === true) return { who: { kind: "staff" }, client };
  const { data: acct } = await client.rpc("my_account_id");
  return { who: { kind: "customer", account: (acct as string) ?? null }, client };
}

async function allowed(who: Who, client: ReturnType<typeof createClient>, op: Op, key: string): Promise<boolean> {
  const s = split(key);
  if (!s) return false;
  const [area, rest] = s;
  if (who.kind === "service" || who.kind === "staff") return true;
  if (op === "get" && PUBLIC_READ.has(area)) return true;
  if (area === "booking-documents" && who.kind === "customer") {
    if (op === "get") {
      // RLS on booking_documents only returns shared docs on the customer's bookings.
      const { data } = await client.from("booking_documents").select("id").eq("storage_path", rest.join("/")).limit(1);
      return (data?.length ?? 0) > 0;
    }
    if (op === "put") {
      // Own folder: <account>/<booking_id>/<file>, booking must be theirs.
      if (!who.account || rest[0] !== who.account || rest.length < 3) return false;
      const { data } = await client.rpc("portal_can_see_booking", { p_booking_id: rest[1] });
      return data === true;
    }
    if (op === "delete") {
      // Customers may delete only files they uploaded themselves (row still visible to them).
      const { data } = await client.from("booking_documents").select("uploaded_via").eq("storage_path", rest.join("/")).limit(1);
      return data?.[0]?.uploaded_via === "customer";
    }
    return false;
  }
  if (area === "sli-uploads" && op !== "delete") {
    const fn = op === "put" ? "sli_token_is_live" : "sli_token_exists";
    const { data } = await client.rpc(fn, { p_token: rest[0] });
    return data === true;
  }
  return false;
}

async function migrate(): Promise<unknown> {
  const db = createClient(URL_, SERVICE);
  const out: Record<string, { copied: number; skipped: number; errors: string[] }> = {};
  for (const area of AREAS) {
    const r = { copied: 0, skipped: 0, errors: [] as string[] };
    out[area] = r;
    const have = new Set(await listKeys(`${area}/`));
    const walk = async (prefix: string) => {
      const { data, error } = await db.storage.from(area).list(prefix, { limit: 1000 });
      if (error) { r.errors.push(`${prefix}: ${error.message}`); return; }
      for (const it of data ?? []) {
        const path = prefix ? `${prefix}/${it.name}` : it.name;
        if (!it.id) { await walk(path); continue; }
        const key = `${area}/${path}`;
        if (have.has(key)) { r.skipped++; continue; }
        const dl = await db.storage.from(area).download(path);
        if (dl.error || !dl.data) { r.errors.push(`${path}: ${dl.error?.message}`); continue; }
        try {
          await putObject(key, await dl.data.arrayBuffer(), (it.metadata as any)?.mimetype);
          r.copied++;
        } catch (e) { r.errors.push(`${path}: ${(e as Error).message}`); }
      }
    };
    await walk("");
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { who, client } = await whoAmI(req);

    if (req.method === "GET") {
      const m = new URL(req.url).pathname.match(/\/files-sign\/o\/(.+)$/);
      const key = m ? decodeURIComponent(m[1]) : "";
      const s = split(key);
      if (!s || !PUBLIC_READ.has(s[0])) return json({ error: "not_found" }, 404);
      const url = await presign(key, "GET", 3600);
      return new Response(null, { status: 302, headers: { ...cors, Location: url, "Cache-Control": "private, max-age=3000" } });
    }
    if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

    const body = await req.json().catch(() => ({}));
    const op = body?.op as string;

    if (op === "health" || op === "migrate") {
      if (who.kind !== "service") return json({ error: "forbidden" }, 403);
      if (op === "migrate") return json({ ok: true, result: await migrate() });
      const k = `csat/_health/${Date.now()}.txt`;
      await putObject(k, "ok", "text/plain");
      const back = await (await getObject(k)).text();
      await deleteObject(k);
      return json({ ok: back === "ok", bucket: S3_BUCKET, region: S3_REGION, signed: (await presign("csat/x", "GET", 60)).slice(0, 80) });
    }

    if (op !== "get" && op !== "put" && op !== "delete") return json({ error: "bad_op" }, 400);
    const keys: string[] = Array.isArray(body?.keys) ? body.keys : typeof body?.key === "string" ? [body.key] : [];
    if (!keys.length || keys.length > 200) return json({ error: "bad_keys" }, 400);
    const expires = Number(body?.expires) || (op === "put" ? 900 : 3600);

    const items: { key: string; url?: string; error?: string }[] = [];
    for (const key of keys) {
      if (!(await allowed(who, client, op, key))) { items.push({ key, error: "forbidden" }); continue; }
      if (op === "delete") { await deleteObject(key); items.push({ key }); continue; }
      const download = op === "get" && typeof body?.download === "string" ? body.download : undefined;
      items.push({ key, url: await presign(key, op === "put" ? "PUT" : "GET", expires, { download }) });
    }
    const denied = items.every((i) => i.error);
    return json({ items }, denied ? 403 : 200);
  } catch (e) {
    return json({ error: "server_error", message: (e as Error).message }, 500);
  }
});
