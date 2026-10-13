// Free, in-browser read of an export air email: destination, PO, pieces, dims, weight, signature company, parties.
// Same rules as the ea-booking edge function's free pass, but over the full email text (forwards included).
import type { EaLine } from '@/pages/inbox/eaBookingApi'

type Line = EaLine
export type Parsed = { destination: string | null; po_refs: string | null; lines: Line[]; is_dg: boolean }

// Pacific + common long-haul export airports, by code and city name.
const AIRPORTS: [RegExp, string][] = [
  [/\b(NAN|NADI|LAUTOKA)\b/i, "NAN"], [/\b(SUV|SUVA|NAUSORI)\b/i, "SUV"], [/\b(TBU|TONGA|NUKU'?ALOFA)\b/i, "TBU"],
  [/\b(APW|APIA|SAMOA)\b/i, "APW"], [/\b(HIR|HONIARA|SOLOMON)/i, "HIR"], [/\b(VLI|PORT VILA|VANUATU)\b/i, "VLI"],
  [/\b(RAR|RAROTONGA|COOK ISLANDS)\b/i, "RAR"], [/\b(NOU|NOUMEA|NEW CALEDONIA)\b/i, "NOU"], [/\b(POM|PORT MORESBY|PNG)\b/i, "POM"],
  [/\b(PPT|TAHITI|PAPEETE)\b/i, "PPT"], [/\b(FUN|TUVALU)\b/i, "FUN"], [/\b(TRW|KIRIBATI|TARAWA)\b/i, "TRW"], [/\b(IUE|NIUE)\b/i, "IUE"],
  [/\b(SYD|SYDNEY)\b/i, "SYD"], [/\b(MEL|MELBOURNE)\b/i, "MEL"], [/\b(BNE|BRISBANE)\b/i, "BNE"],
];

const NUM = "(\\d{1,5}(?:[.,]\\d{1,3})?)"
const toNum = (x: string) => Number(x.replace(",", "."))
const PKG = "(pcs?|pieces?|cartons?|ctns?|pallets?|plts?|pkgs?|packages?|boxes|box|crates?|skids?|drums?|bundles?|rolls?)"

/** Free pass. Reads the newest message first, then the rest of the chain, so replies beat quoted history. */
export function parseCargo(text: string, latest = ''): Parsed {
  const pick = (re: RegExp) => latest.replace(/\s+/g, " ").match(re) ?? text.replace(/\s+/g, " ").match(re)
  const t = `${latest}\n${text}`.replace(/\s+/g, " ")
  const dest = AIRPORTS.find(([re]) => re.test(latest))?.[1] ?? AIRPORTS.find(([re]) => re.test(t))?.[1] ?? null
  const pos = Array.from(new Set([
    ...[...t.matchAll(/\bP\.?O\b\.?\s*(?:no\.?|number|#)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9\-\/]{3,})/gi)].map((m) => m[1]),
    ...[...t.matchAll(/\b(PO\d{4,}[A-Z0-9\-]*)/gi)].map((m) => m[1]),
    ...[...t.matchAll(/\bPURCHASE ORDER\s*(?:no\.?|#)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9\-\/]{2,})/gi)].map((m) => m[1]),
  ].map((x) => x.toUpperCase()).filter((x) => /\d/.test(x)))).slice(0, 6)

  // Weight: "Weight = 11.00kgs", "79 kgs", "G/W 120kg"
  const kgM = pick(new RegExp(`(?:weight|g\\.?\\s?w|gross)[^\\d]{0,12}${NUM}\\s?(?:kgs?|kilos?)\\b`, "i")) ?? pick(new RegExp(`\\b${NUM}\\s?(?:kgs?|kilos?)\\b`, "i"))
  const kg = kgM ? toNum(kgM[1]) : null
  // Pieces: "1 x Carton", "13pc", "2 pallets", "Pieces: 4"
  const pcsM = pick(new RegExp(`\\b(\\d{1,4})\\s?x?\\s?${PKG}\\b`, "i")) ?? pick(/\b(?:pieces|pcs|qty|packages)\s*[:=]\s*(\d{1,4})\b/i)
  const pcs = pcsM ? Number(pcsM[1]) : null
  // Dimensions: "120x80x100cm" or "Length: 59cms, Width: 26cms & Height: 45cms" (also L/W/H)
  const unitF = (u?: string) => (u && /^mm/i.test(u) ? 0.1 : u && /^m$/i.test(u) ? 100 : 1)
  const lines: Line[] = []
  for (const m of [...(latest || text).replace(/\s+/g, " ").matchAll(new RegExp(`\\b${NUM}\\s?(cm|cms|mm)?\\s?[xX*×]\\s?${NUM}\\s?(cm|cms|mm)?\\s?[xX*×]\\s?${NUM}\\s?(cm|cms|mm|m)?\\b`, "g"))].slice(0, 10)) {
    const f = unitF(m[6] ?? m[4] ?? m[2])
    lines.push({ pieces: 1, l: +(toNum(m[1]) * f).toFixed(1), w: +(toNum(m[3]) * f).toFixed(1), h: +(toNum(m[5]) * f).toFixed(1), kg: null })
  }
  if (!lines.length) {
    const lab = pick(new RegExp(`\\b(?:length|len|l)\\s*[:=]?\\s*${NUM}\\s?(cm|cms|mm|m)?[^\\d]{1,25}(?:width|wid|w)\\s*[:=]?\\s*${NUM}\\s?(cm|cms|mm|m)?[^\\d]{1,25}(?:height|hgt|h)\\s*[:=]?\\s*${NUM}\\s?(cm|cms|mm|m)?`, "i"))
    if (lab) {
      const f = unitF(lab[2] ?? lab[4] ?? lab[6])
      lines.push({ pieces: 1, l: +(toNum(lab[1]) * f).toFixed(1), w: +(toNum(lab[3]) * f).toFixed(1), h: +(toNum(lab[5]) * f).toFixed(1), kg: null })
    }
  }
  if (lines.length === 1) { if (pcs) lines[0].pieces = pcs; if (kg != null) lines[0].kg = kg }
  else if (!lines.length && (pcs || kg)) lines.push({ pieces: pcs, kg })
  return { destination: dest, po_refs: pos.join(", ") || null, lines, is_dg: /\b(dangerous goods|DG cargo|UN\s?\d{4}|lithium)\b/i.test(t) }
}

/** Company in an email signature: "Ampac NZ Limited", "Fletcher Construction Pte Ltd". */
export function signatureCompany(text: string): string | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const re = /^([A-Z0-9][A-Za-z0-9&.,'()\- ]{1,60}?\s(?:Limited|Ltd\.?|LTD|Pty\.? Ltd\.?|Pte\.? Ltd\.?|Co\.? Ltd\.?|Inc\.?|LLC))\b/
  for (const l of lines.slice(0, 80)) {
    if (/ub freight/i.test(l)) continue
    const m = l.match(re)
    if (m) return m[1].trim()
  }
  return null
}


const PACIFIC = /\.(fj|to|ws|sb|vu|ck|nc|pg|pf|tv|ki|nu)$|fj\.|fiji|tonga|samoa|vanuatu|solomon/i

export type EmailParty = { name: string | null; email: string; side: 'nz' | 'pacific' }

/** Every sender in the chain ("From: Name <a@b>" lines + the envelope), split into NZ side and Pacific side. UBF staff skipped. */
export function partiesFromText(fullText: string, envelope: { name: string | null; email: string | null }[]): EmailParty[] {
  const out: EmailParty[] = []
  const add = (name: string | null, email: string | null) => {
    const e = (email ?? '').trim().toLowerCase()
    if (!e || /@ubfreight\.com$/.test(e) || out.some((p) => p.email === e)) return
    out.push({ name: name?.trim() || null, email: e, side: PACIFIC.test(e.split('@')[1] ?? '') ? 'pacific' : 'nz' })
  }
  for (const m of fullText.matchAll(/^\s*From:\s*"?([^"<\r\n]*?)"?\s*<([^>\s]+@[^>\s]+)>/gim)) add(m[1], m[2])
  for (const e of envelope) add(e.name, e.email)
  return out
}

/** Signature company that sits right after a given sender's name block, else the first in the text. */
export function companyNear(fullText: string, email: string): string | null {
  const i = fullText.toLowerCase().indexOf(`from:`)
  const at = fullText.toLowerCase().indexOf(email.toLowerCase(), Math.max(0, i))
  const slice = at >= 0 ? fullText.slice(at, at + 4000) : fullText
  return signatureCompany(slice)
}
