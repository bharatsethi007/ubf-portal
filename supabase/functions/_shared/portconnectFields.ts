import type { JsonRecord } from "./portconnectClient.ts"
import { pcField } from "./portconnectClient.ts"

export function asText(value: unknown): string | null {
  if (value == null) return null
  const text = String(value).trim()
  return text || null
}

export function asIso(value: unknown): string | null {
  const text = asText(value)
  if (!text) return null
  const d = new Date(text)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export function visitField(visit: JsonRecord, ...names: string[]): unknown {
  return pcField(visit, ...names)
}

export function toDateOnly(iso: string): string {
  return iso.slice(0, 10)
}

export function partnerPortCode(visit: JsonRecord): string | null {
  return asText(visitField(visit, "partnerPortCode", "portCode"))
}

export function isLytteltonPort(code: string | null | undefined): boolean {
  if (!code) return false
  const u = code.trim().toUpperCase()
  return u === "NZLYT" || u.includes("LYTTELTON")
}

export function sameInstant(a: string | null, b: string | null): boolean {
  if (!a || !b) return false
  const da = new Date(a).getTime()
  const db = new Date(b).getTime()
  if (Number.isNaN(da) || Number.isNaN(db)) return a === b
  return da === db
}

export function nzlytEstimatedClearances(
  lineRelease: string | null,
  customsRelease: string | null,
  mpiRelease: string | null,
  partnerPort: string | null,
): boolean {
  if (!isLytteltonPort(partnerPort)) return false
  if (!lineRelease || !customsRelease || !mpiRelease) return false
  return sameInstant(lineRelease, customsRelease) && sameInstant(customsRelease, mpiRelease)
}
