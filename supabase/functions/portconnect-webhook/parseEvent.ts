import type { JsonRecord, ParsedWebhookEvent } from "./types.ts"

function keyVariants(name: string): string[] {
  const lower = name.toLowerCase()
  const pascal = name.charAt(0).toUpperCase() + name.slice(1)
  const camel = name.charAt(0).toLowerCase() + name.slice(1)
  return [name, lower, camel, pascal]
}

function buildKeyMap(obj: JsonRecord): Map<string, unknown> {
  const map = new Map<string, unknown>()
  for (const [k, v] of Object.entries(obj)) {
    map.set(k.toLowerCase(), v)
  }
  return map
}

export function getField(obj: JsonRecord, ...names: string[]): unknown {
  const map = buildKeyMap(obj)
  for (const name of names) {
    for (const variant of keyVariants(name)) {
      const hit = map.get(variant.toLowerCase())
      if (hit !== undefined && hit !== null && hit !== "") return hit
    }
  }
  return null
}

function asText(value: unknown): string | null {
  if (value == null) return null
  const text = String(value).trim()
  return text || null
}

function asInt(value: unknown): number | null {
  if (value == null || value === "") return null
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

export function normalizeEventType(code: string): string {
  return code.replace(/[^a-z0-9]/gi, "").toUpperCase()
}

export function visitIdFromUri(uri: string | null): number | null {
  if (!uri) return null
  const match = uri.match(/(\d+)\s*$/)
  return match ? Number(match[1]) : null
}

export function parseWebhookEvent(raw: JsonRecord): ParsedWebhookEvent | null {
  const containerNo = asText(getField(
    raw,
    "containerNumber",
    "containerNo",
  ))
  const eventTypeCode = asText(getField(
    raw,
    "containerVisitEventTypeCode",
    "eventTypeCode",
    "containerVisitEventType",
  ))
  const eventDatetime = asText(getField(
    raw,
    "containerVisitEventDatetime",
    "eventDatetime",
    "eventDateTime",
  ))
  if (!containerNo || !eventTypeCode || !eventDatetime) return null

  const containerVisitUri = asText(getField(raw, "containerVisitUri"))

  return {
    subscriptionEventId: asInt(getField(raw, "subscriptionEventId")),
    subscriptionId: asInt(getField(raw, "subscriptionId")),
    subscriptionContainerId: asInt(getField(raw, "subscriptionContainerId")),
    containerNo,
    containerVisitId: asInt(getField(raw, "containerVisitId")) ?? visitIdFromUri(containerVisitUri),
    containerVisitUri,
    partnerPortCode: asText(getField(raw, "partnerPortCode")),
    containerVisitTypeCode: asText(getField(raw, "containerVisitTypeCode")),
    eventTypeCode,
    eventDatetime,
    eventLocation: asText(getField(raw, "containerVisitEventLocation", "eventLocation")),
    eventValue: asText(getField(raw, "containerVisitEventValue", "eventValue")),
    eventValue2: asText(getField(raw, "containerVisitEventValue2", "eventValue2")),
    containerIsoType: asText(getField(raw, "containerIsoTypeCode", "containerIsoType")),
    containerStatus: asText(getField(raw, "containerStatus")),
    inboundVesselRef: asText(getField(raw, "inboundVesselRef")),
    inboundVesselName: asText(getField(raw, "inboundVesselName")),
    inboundVesselImo: asInt(getField(raw, "inboundVesselIMONumber", "inboundVesselImo")),
    outboundVesselRef: asText(getField(raw, "outboundVesselRef")),
    outboundVesselName: asText(getField(raw, "outboundVesselName")),
    bookingReference: asText(getField(raw, "bookingReference")),
    operatorScac: asText(getField(raw, "containerOperatorSCACCode", "operatorScac")),
    userDefinedReference: asText(getField(raw, "userDefinedReference")),
    raw,
  }
}

export function parsePayload(body: unknown): JsonRecord[] {
  if (Array.isArray(body)) {
    return body.filter((row): row is JsonRecord => !!row && typeof row === "object")
  }
  if (body && typeof body === "object") return [body as JsonRecord]
  return []
}

export function headerValue(req: Request, name: string): string | null {
  for (const [key, value] of req.headers.entries()) {
    if (key.toLowerCase() === name.toLowerCase()) return value
  }
  return null
}
