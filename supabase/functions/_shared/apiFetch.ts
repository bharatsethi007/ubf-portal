// Drop-in fetch replacement that logs every outbound call to public.api_calls.
// Usage: import { apiFetch } from "../_shared/apiFetch.ts"; then apiFetch(url, init) instead of fetch.
// Provider is detected from the host. Logging is fire-and-forget and never breaks the caller.
// Bodies are stored (truncated, secrets masked) only for providers with log_bodies, plus all error responses.

const HOSTS: Record<string, string> = {
  "api.anthropic.com": "anthropic",
  "api.deepgram.com": "deepgram",
  "api.brevo.com": "brevo",
  "graph.microsoft.com": "msgraph",
  "login.microsoftonline.com": "msgraph",
  "graph.facebook.com": "whatsapp",
  "api.portconnect.io": "portconnect",
  "api.maersk.com": "maersk",
  "insight.seavantage.com": "seavantage",
  "api-au.telematics.com": "navman",
  "routes.googleapis.com": "google_routes",
  "api.mapbox.com": "mapbox",
  "express.api.dhl.com": "dhl",
  "express.api.dhl.com.test": "dhl",
  "apis.fedex.com": "fedex",
  "apis-sandbox.fedex.com": "fedex",
  "api.bascik.co.nz": "bascik",
  "apitest.bascik.co.nz": "bascik",
  "api.gosweetspot.com": "gss",
};
const BODY_PROVIDERS = new Set([
  "brevo", "msgraph", "whatsapp", "portconnect", "maersk", "seavantage", "dhl", "fedex", "bascik", "gss",
]);
const MAX_BODY = 4000;

export function providerFor(host: string): string {
  if (HOSTS[host]) return HOSTS[host];
  if (host.endsWith(".amazonaws.com")) return "s3";
  return "other";
}

const SECRET_KEYS = /("?(?:password|pass|secret|client_secret|access_token|refresh_token|api[_-]?key|token|authorization)"?\s*[:=]\s*)("[^"]*"|[^&\s,}]+)/gi;
export function mask(s: string): string {
  return s.replace(SECRET_KEYS, "$1\"***\"").replace(/Bearer\s+[A-Za-z0-9._\-]+/g, "Bearer ***");
}

function clip(s: string | null): string | null {
  if (s == null) return null;
  const m = mask(s);
  return m.length > MAX_BODY ? m.slice(0, MAX_BODY) + `…[+${m.length - MAX_BODY}]` : m;
}

function bodyText(b: BodyInit | null | undefined): string | null {
  if (b == null) return null;
  if (typeof b === "string") return b;
  if (b instanceof URLSearchParams) return b.toString();
  return `[${b.constructor?.name ?? "binary"}]`;
}

function bodySize(b: BodyInit | null | undefined): number {
  if (b == null) return 0;
  if (typeof b === "string") return new TextEncoder().encode(b).length;
  if (b instanceof URLSearchParams) return b.toString().length;
  if (b instanceof Uint8Array) return b.byteLength;
  if (b instanceof ArrayBuffer) return b.byteLength;
  if (b instanceof Blob) return b.size;
  return 0;
}

function fnName(): string | null {
  try {
    const u = new URL(import.meta.url);
    const parts = u.pathname.split("/").filter(Boolean);
    const i = parts.indexOf("functions");
    return i >= 0 && parts[i + 1] && parts[i + 1] !== "_shared" ? parts[i + 1] : Deno.env.get("SB_FUNCTION_NAME") ?? null;
  } catch { return null; }
}

let fnLabel: string | null = null;
/** Optional: call once at the top of a function so rows carry its slug. */
export function setApiFn(name: string) { fnLabel = name; }

function record(row: Record<string, unknown>) {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return;
  const p = fetch(`${url}/rest/v1/api_calls`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(row),
  }).catch(() => {});
  // Keep the isolate alive until the log write finishes.
  // deno-lint-ignore no-explicit-any
  const er = (globalThis as any).EdgeRuntime;
  if (er?.waitUntil) er.waitUntil(p);
}

export async function apiFetch(input: string | URL | Request, init: RequestInit = {}): Promise<Response> {
  const req = input instanceof Request ? input : null;
  const u = new URL(req ? req.url : String(input));
  const provider = providerFor(u.host);
  const method = (init.method ?? req?.method ?? "GET").toUpperCase();
  const logBodies = BODY_PROVIDERS.has(provider);
  const t0 = performance.now();
  const base = {
    provider, fn: fnLabel ?? fnName(), method, host: u.host, path: u.pathname.slice(0, 300),
    bytes_out: bodySize(init.body),
    req_body: logBodies ? clip(bodyText(init.body)) : null,
  };
  try {
    const res = await fetch(input, init);
    const ms = Math.round(performance.now() - t0);
    const len = Number(res.headers.get("content-length") ?? "");
    let resText: string | null = null;
    let bytesIn = Number.isFinite(len) && len > 0 ? len : null;
    if (logBodies || !res.ok) {
      try {
        resText = await res.clone().text();
        bytesIn = bytesIn ?? new TextEncoder().encode(resText).length;
      } catch { /* stream not readable */ }
    }
    record({
      ...base, status: res.status, ok: res.ok, ms, bytes_in: bytesIn,
      error: res.ok ? null : `HTTP ${res.status}`, res_body: clip(resText),
    });
    return res;
  } catch (e) {
    record({
      ...base, status: null, ok: false, ms: Math.round(performance.now() - t0), bytes_in: 0,
      error: (e instanceof Error ? e.message : String(e)).slice(0, 500),
    });
    throw e;
  }
}
