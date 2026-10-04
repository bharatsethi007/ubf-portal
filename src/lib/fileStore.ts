// src/lib/fileStore.ts
// S3 file store via the files-sign edge function. Replaces supabase.storage.
// Keys are "<area>/<path>", area = old bucket name, e.g. fileKey('booking-documents', path).
import { supabase } from '../supabase'

const BASE = import.meta.env.VITE_SUPABASE_URL as string
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string
const FN = `${BASE}/functions/v1/files-sign`

export type FileArea =
  | 'booking-documents' | 'sli-uploads' | 'booking-emails' | 'whatsapp-media' | 'csat' | 'conferences'
  | 'fleet' | 'fleet-docs' | 'checkin' | 'meeting-audio' | 'courier-labels' | 'avatars'

type Item = { key: string; url?: string; error?: string }

export const fileKey = (area: FileArea, path: string) => `${area}/${path.replace(/^\/+/, '')}`

async function call(body: Record<string, unknown>, token?: string): Promise<Item[]> {
  const jwt = token ?? (await supabase.auth.getSession()).data.session?.access_token ?? ANON
  const res = await fetch(FN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${jwt}` },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok && !data?.items) throw new Error(data?.message ?? data?.error ?? `File service ${res.status}`)
  return (data.items ?? []) as Item[]
}

/** Upload a file or blob. Pass anonToken=true for public pages (SLI). */
export async function uploadFile(
  key: string,
  file: Blob,
  opts: { contentType?: string; anon?: boolean } = {},
): Promise<void> {
  const [it] = await call({ op: 'put', keys: [key] }, opts.anon ? ANON : undefined)
  if (!it?.url) throw new Error(it?.error ?? 'Upload not allowed')
  const res = await fetch(it.url, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': opts.contentType || file.type || 'application/octet-stream' },
  })
  if (!res.ok) throw new Error(`Upload failed (${res.status})`)
}

/** Short-lived view/download link. */
export async function signedUrl(
  key: string,
  opts: { expires?: number; download?: string; anon?: boolean } = {},
): Promise<string> {
  const [it] = await call(
    { op: 'get', keys: [key], expires: opts.expires, download: opts.download },
    opts.anon ? ANON : undefined,
  )
  if (!it?.url) throw new Error(it?.error ?? 'File not available')
  return it.url
}

/** Many links in one call. Missing/forbidden keys come back without url. */
export async function signedUrls(keys: string[], expires?: number): Promise<Record<string, string>> {
  if (!keys.length) return {}
  const items = await call({ op: 'get', keys, expires })
  return Object.fromEntries(items.filter((i) => i.url).map((i) => [i.key, i.url as string]))
}

export async function removeFiles(keys: string[]): Promise<void> {
  if (!keys.length) return
  const items = await call({ op: 'delete', keys })
  const bad = items.find((i) => i.error)
  if (bad) throw new Error(bad.error)
}

/** Stable URL for public areas (avatars, conferences, fleet, csat). Safe in <img src>. */
export function publicUrl(key: string): string {
  return `${FN}/o/${key.split('/').map(encodeURIComponent).join('/')}`
}
