import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

const BREVO = "https://api.brevo.com/v3";

async function isStaff(req: Request): Promise<boolean> {
  const auth = req.headers.get("Authorization") ?? "";
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anon || !auth) return false;
  const r = await fetch(`${url}/rest/v1/rpc/is_staff`, {
    method: "POST",
    headers: { apikey: anon, Authorization: auth, "Content-Type": "application/json" },
    body: "{}",
  });
  if (!r.ok) return false;
  const v = await r.json().catch(() => false);
  return v === true;
}

async function brevo(path: string, init: RequestInit) {
  const key = Deno.env.get("BREVO_API_KEY");
  if (!key) throw new Error("BREVO_API_KEY not set");
  const r = await fetch(`${BREVO}${path}`, {
    ...init,
    headers: { "api-key": key, "Content-Type": "application/json", accept: "application/json", ...(init.headers ?? {}) },
  });
  const text = await r.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!r.ok) {
    const msg = typeof body === "string" ? body : ((body as { message?: string })?.message ?? `Brevo ${r.status}`);
    throw new Error(msg);
  }
  return body as Record<string, unknown> | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  try {
    if (!(await isStaff(req))) return json({ error: "staff only" }, 403);
    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (action === "lists") {
      const lists = await brevo("/contacts/lists?limit=50&offset=0", { method: "GET" });
      const folders = await brevo("/contacts/folders?limit=50&offset=0", { method: "GET" });
      const ls = (lists?.lists as Array<{ id: number; name: string }> | undefined) ?? [];
      const fs = (folders?.folders as Array<{ id: number }> | undefined) ?? [];
      return json({ lists: ls.map((l) => ({ id: l.id, name: l.name })), defaultFolderId: fs[0]?.id ?? null });
    }

    if (action === "sync") {
      const raw = Array.isArray(body?.contacts) ? body.contacts : [];
      const clean = raw
        .map((c: { email?: string; name?: string | null; phone?: string | null; contact_name?: string | null }) => ({
          email: String(c?.email ?? "").trim().toLowerCase(),
          name: c?.name ?? null,
          phone: c?.phone ? String(c.phone).trim() : null,
          contact_name: c?.contact_name ? String(c.contact_name).trim() : null,
        }))
        .filter((c: { email: string }) => c.email.includes("@"));
      if (!clean.length) return json({ error: "no valid contacts" }, 400);
      if (clean.length > 5000) return json({ error: "too many contacts (max 5000)" }, 400);

      const jsonBody = clean.map((c: { email: string; name: string | null; phone: string | null; contact_name: string | null }) => {
        const attributes: Record<string, string> = {};
        if (c.name) attributes.FNAME = c.name;
        if (c.phone) attributes.PHONE = c.phone;
        if (c.contact_name) attributes.CONTACT = c.contact_name;
        return Object.keys(attributes).length ? { email: c.email, attributes } : { email: c.email };
      });

      const payload: Record<string, unknown> = { jsonBody, updateExistingContacts: true, emptyContactsAttributes: false };

      if (typeof body?.listId === "number") {
        payload.listIds = [body.listId];
      } else if (typeof body?.newListName === "string" && body.newListName.trim()) {
        payload.listName = body.newListName.trim();
        if (typeof body?.folderId === "number") payload.folderId = body.folderId;
      } else {
        return json({ error: "listId or newListName required" }, 400);
      }

      const res = await brevo("/contacts/import", { method: "POST", body: JSON.stringify(payload) });
      return json({ ok: true, queued: clean.length, processId: (res as { processId?: number })?.processId ?? null });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message ?? "failed" }, 500);
  }
});
