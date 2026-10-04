// Shared S3 client for edge functions. Bucket + keys from secrets.
// Keys are "<area>/<path>", e.g. "booking-documents/ACC1/uuid/file.pdf".
import { AwsClient } from "npm:aws4fetch@1.0.20";

const region = Deno.env.get("AWS_REGION")!;
const bucket = Deno.env.get("S3_BUCKET")!;
const aws = new AwsClient({
  accessKeyId: Deno.env.get("AWS_ACCESS_KEY_ID")!,
  secretAccessKey: Deno.env.get("AWS_SECRET_ACCESS_KEY")!,
  region,
  service: "s3",
});

export const S3_BUCKET = bucket;
export const S3_REGION = region;
const base = `https://${bucket}.s3.${region}.amazonaws.com`;
const enc = (key: string) => key.split("/").map(encodeURIComponent).join("/");
export const objectUrl = (key: string) => `${base}/${enc(key)}`;

export async function presign(
  key: string,
  method: "GET" | "PUT",
  expires = 3600,
  opts: { download?: string } = {},
): Promise<string> {
  const u = new URL(objectUrl(key));
  u.searchParams.set("X-Amz-Expires", String(Math.min(Math.max(expires, 60), 604800)));
  if (opts.download) {
    u.searchParams.set("response-content-disposition", `attachment; filename="${opts.download.replace(/"/g, "")}"`);
  }
  const signed = await aws.sign(u.toString(), { method, aws: { signQuery: true } });
  return signed.url;
}

export async function putObject(key: string, body: BodyInit, contentType?: string): Promise<void> {
  const headers: Record<string, string> = {};
  if (contentType) headers["Content-Type"] = contentType;
  const r = await aws.fetch(objectUrl(key), { method: "PUT", body, headers });
  if (!r.ok) throw new Error(`S3 put ${r.status}: ${(await r.text()).slice(0, 300)}`);
}

export async function getObject(key: string): Promise<Response> {
  const r = await aws.fetch(objectUrl(key), { method: "GET" });
  if (!r.ok) throw new Error(`S3 get ${r.status}`);
  return r;
}

export async function deleteObject(key: string): Promise<void> {
  const r = await aws.fetch(objectUrl(key), { method: "DELETE" });
  if (!r.ok && r.status !== 404) throw new Error(`S3 delete ${r.status}`);
}

export async function listKeys(prefix: string, max = 1000): Promise<string[]> {
  const u = new URL(`${base}/`);
  u.searchParams.set("list-type", "2");
  u.searchParams.set("prefix", prefix);
  u.searchParams.set("max-keys", String(max));
  const r = await aws.fetch(u.toString());
  if (!r.ok) throw new Error(`S3 list ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const xml = await r.text();
  return [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => m[1]);
}
