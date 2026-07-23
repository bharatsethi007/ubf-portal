/** Deno copy — keep in sync with src/features/importSea/iso6346Normalize.ts */

export type IsoPillKind = "G" | "H" | "R"

const LENGTH_TO_SIZE: Record<string, string> = {
  "20": "20", "22": "20", "25": "20",
  "42": "40", "45": "40",
  "L2": "45", "L5": "45",
}

const NUMERIC_TYPE_KIND: Record<string, IsoPillKind> = {
  "00": "G", "01": "G", "02": "G", "03": "G", "04": "G", "05": "G",
  "10": "G", "11": "G", "12": "G", "13": "G", "14": "G", "15": "G",
  "20": "G", "21": "G", "22": "G", "23": "G", "24": "G", "25": "G",
  "30": "R", "31": "R", "32": "R", "33": "R", "34": "R", "35": "R",
  "40": "H", "41": "H", "42": "H", "43": "H", "44": "H", "45": "H",
}

const ALPHA_TYPE_KIND: Record<string, IsoPillKind> = {
  G: "G", U: "G", P: "G", V: "G",
  R: "R", H: "H",
}

function sizeFromLengthCode(code: string): string | null {
  const u = code.toUpperCase()
  if (LENGTH_TO_SIZE[u]) return LENGTH_TO_SIZE[u]
  if (/^2/.test(u)) return "20"
  if (/^4/.test(u)) return "40"
  if (/^L/.test(u)) return "45"
  return null
}

function kindFromDescription(desc: string): IsoPillKind | null {
  const u = desc.toUpperCase()
  if (/REEF|REEFER|\bRF\b|\bRH\b|\bRT\b/.test(u)) return "R"
  if (/HIGH\s*CUBE|\bHC\b|\bHQ\b|\bHR\b/.test(u)) return "H"
  if (/GENERAL|DRY|STANDARD|\bGP\b|\bDC\b|\bDV\b/.test(u)) return "G"
  return null
}

function normalizeAlphanumeric(code: string): string | null {
  const m = code.match(/^(\d{2}|L\d)([A-Z])(\d)$/i)
  if (!m) return null
  const size = sizeFromLengthCode(m[1])
  if (!size) return null
  const letter = m[2].toUpperCase()
  const kind = ALPHA_TYPE_KIND[letter] ?? (letter === "H" ? "H" : "G")
  if (m[1].toUpperCase() === "45" && kind === "G") return `${size}H`
  return `${size}${kind}`
}

function normalizeNumeric(code: string): string | null {
  const m = code.match(/^(\d{2})(\d{2})$/)
  if (!m) return null
  const size = sizeFromLengthCode(m[1])
  if (!size) return null
  const kind = NUMERIC_TYPE_KIND[m[2]] ?? "G"
  if (m[1] === "45" && kind === "G") return `${size}H`
  return `${size}${kind}`
}

export function normalizeIso6346Pill(
  code: string | null | undefined,
  description?: string | null,
): string | null {
  const raw = code?.trim()
  if (!raw && !description?.trim()) return null

  const compact = raw?.replace(/[^A-Za-z0-9]/g, "").toUpperCase() ?? ""
  if (compact.length === 4) {
    const alpha = normalizeAlphanumeric(compact)
    if (alpha) return alpha
    const num = normalizeNumeric(compact)
    if (num) return num
  }

  const descKind = description?.trim() ? kindFromDescription(description) : null
  if (descKind && compact.length >= 2) {
    const size = sizeFromLengthCode(compact.slice(0, 2)) ?? compact.match(/^(20|40|45)/)?.[1]
    if (size) return `${size}${descKind}`
  }

  if (raw) return raw.toUpperCase()
  return null
}
