// db-archive (verify_jwt = false; service-role bearer only). Nightly via pg_cron.
// Moves old rows out of Postgres into S3 as gzip JSONL, then deletes them.
// S3 key: archive/<source>/<YYYY-MM-DD>/<firstId>-<lastId>.jsonl.gz
// Body: { sources?: string[], maxBatches?: number }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getObject, putObject } from "../_shared/s3.ts";

const SOURCES: Record<string, string> = {
  cron_runs: "runid",
  vessel_positions: "id",
  vehicle_positions: "id",
};
const BATCH = 5000;

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

async function gzip(text: string): Promise<Uint8Array> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

Deno.serve(async (req) => {
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (req.headers.get("Authorization") !== `Bearer ${service}`) return json({ error: "unauthorized" }, 401);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, service);
  const body = await req.json().catch(() => ({}));
  const wanted: string[] = Array.isArray(body?.sources) ? body.sources : Object.keys(SOURCES);
  const maxBatches = Math.min(Number(body?.maxBatches) || 6, 20);
  const day = new Date().toISOString().slice(0, 10);
  const out: Record<string, { archived: number; files: string[]; error?: string }> = {};

  for (const source of wanted) {
    const idCol = SOURCES[source];
    if (!idCol) continue;
    const r = { archived: 0, files: [] as string[] } as { archived: number; files: string[]; error?: string };
    out[source] = r;
    try {
      for (let i = 0; i < maxBatches; i++) {
        const { data, error } = await db.rpc("archive_fetch", { p_source: source, p_limit: BATCH });
        if (error) throw new Error(error.message);
        const rows = (data ?? []) as Record<string, unknown>[];
        if (!rows.length) break;

        const ids = rows.map((x) => Number(x[idCol]));
        const key = `archive/${source}/${day}/${ids[0]}-${ids[ids.length - 1]}.jsonl.gz`;
        const gz = await gzip(rows.map((x) => JSON.stringify(x)).join("\n") + "\n");
        await putObject(key, gz, "application/gzip");

        // Verify the copy landed intact before deleting anything.
        const back = new Uint8Array(await (await getObject(key)).arrayBuffer());
        if (back.length !== gz.length) throw new Error(`verify failed for ${key}`);

        const del = await db.rpc("archive_delete", { p_source: source, p_ids: ids });
        if (del.error) throw new Error(del.error.message);
        r.archived += Number(del.data ?? 0);
        r.files.push(key);
        if (rows.length < BATCH) break;
      }
    } catch (e) {
      r.error = e instanceof Error ? e.message : String(e);
    }
  }
  return json({ ok: true, result: out });
});
