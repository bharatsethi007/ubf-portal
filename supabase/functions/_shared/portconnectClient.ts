export type JsonRecord = Record<string, unknown>

const API_BASE = "https://api.portconnect.io"

export function webhookUri(): string {
  const base = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "")
  if (!base) throw new Error("SUPABASE_URL not configured")
  return `${base}/functions/v1/portconnect-webhook`
}

export function portconnectHeaders(apiKey: string): HeadersInit {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "Ocp-Apim-Subscription-Key": apiKey,
  }
}

function fieldMap(obj: JsonRecord): Map<string, unknown> {
  const map = new Map<string, unknown>()
  for (const [k, v] of Object.entries(obj)) map.set(k.toLowerCase(), v)
  return map
}

export function pcField(obj: JsonRecord, ...names: string[]): unknown {
  const map = fieldMap(obj)
  for (const name of names) {
    const hit = map.get(name.toLowerCase())
    if (hit !== undefined && hit !== null && hit !== "") return hit
  }
  return null
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

export function expiresInDays(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
}

export type SubscribeContainerResult = {
  subscriptionId: number
  containerNumber: string
  expiresAt: string | null
}

export async function portconnectSubscribeChunk(
  apiKey: string,
  webhookToken: string,
  bookingId: string,
  containerNumbers: string[],
): Promise<SubscribeContainerResult[]> {
  const body = {
    containers: containerNumbers.map((containerNumber) => ({
      containerNumber,
      userDefinedReference: bookingId,
    })),
    webhookURI: webhookUri(),
    webhookToken,
    portCode: "ALL",
    category: "IMPORT",
    eventTypeCodes: ["ALL"],
    facilityCode: null,
  }

  const res = await fetch(`${API_BASE}/v2/subscriptions`, {
    method: "POST",
    headers: portconnectHeaders(apiKey),
    body: JSON.stringify(body),
  })

  const data = (await res.json().catch(() => ({}))) as JsonRecord
  if (!res.ok) {
    const msg = String(pcField(data, "message", "title", "error") ?? res.statusText)
    throw new Error(`PortConnect subscribe failed (${res.status}): ${msg}`)
  }

  const subscriptionId = Number(pcField(data, "subscriptionId"))
  if (!Number.isFinite(subscriptionId)) {
    throw new Error("PortConnect subscribe response missing subscriptionId")
  }

  const containers = pcField(data, "containers")
  if (!Array.isArray(containers)) {
    return containerNumbers.map((containerNumber) => ({
      subscriptionId,
      containerNumber,
      expiresAt: expiresInDays(90),
    }))
  }

  return containers.map((row) => {
    const rec = row as JsonRecord
    const containerNumber = String(pcField(rec, "containerNumber") ?? "")
    const expiresAt = pcField(rec, "expirationDatetime") as string | null
    return {
      subscriptionId,
      containerNumber,
      expiresAt: expiresAt ?? expiresInDays(90),
    }
  }).filter((r) => r.containerNumber)
}

export async function portconnectDeleteContainer(
  apiKey: string,
  subscriptionId: number,
  containerNumber: string,
): Promise<void> {
  const encoded = encodeURIComponent(containerNumber)
  const res = await fetch(
    `${API_BASE}/v2/subscriptions/${subscriptionId}/containers/${encoded}`,
    { method: "DELETE", headers: portconnectHeaders(apiKey) },
  )
  if (res.status === 204 || res.ok) return
  const data = (await res.json().catch(() => ({}))) as JsonRecord
  const msg = String(pcField(data, "message", "title", "error") ?? res.statusText)
  throw new Error(`PortConnect unsubscribe failed (${res.status}): ${msg}`)
}

export type PortConnectFetchResult = {
  status: number
  data: JsonRecord | JsonRecord[] | null
  message: string | null
}

export async function fetchContainerVisitsImport(
  apiKey: string,
  containerNumber: string,
): Promise<PortConnectFetchResult> {
  const url = new URL(`${API_BASE}/v1/container-visits`)
  url.searchParams.set("containerNumber", containerNumber)
  url.searchParams.set("category", "IMPORT")

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json", "Ocp-Apim-Subscription-Key": apiKey },
  })

  const text = await res.text()
  let parsed: unknown = null
  try {
    parsed = text ? JSON.parse(text) : null
  } catch {
    parsed = text
  }

  const obj = parsed && typeof parsed === "object" ? parsed as JsonRecord : null
  const message = obj
    ? String(pcField(obj, "message", "title", "error", "detail") ?? "")
    : typeof parsed === "string" ? parsed : null

  if (!res.ok) {
    return { status: res.status, data: obj, message: message || res.statusText }
  }

  if (Array.isArray(parsed)) {
    return { status: res.status, data: parsed as JsonRecord[], message: null }
  }
  if (obj && Array.isArray(obj.data)) {
    return { status: res.status, data: obj.data as JsonRecord[], message: null }
  }
  if (obj && Array.isArray(obj.value)) {
    return { status: res.status, data: obj.value as JsonRecord[], message: null }
  }
  if (obj) return { status: res.status, data: [obj], message: null }
  return { status: res.status, data: [], message: null }
}
