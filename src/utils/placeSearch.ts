// Shared helpers for airport and sea port search: code and city first, then the rest.

/** Lowercase, no accents, no apostrophes or dots: "O'Hare" -> "ohare", "Nouméa" -> "noumea". */
export function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/['’`.]/g, '').replace(/\s+/g, ' ').trim()
}

/** True when q starts the text or any word in it. */
export function wordStart(hay: string, q: string): boolean {
  return hay.startsWith(q) || hay.includes(` ${q}`) || hay.includes(`-${q}`) || hay.includes(`/${q}`) || hay.includes(`(${q}`)
}

let regionNames: Intl.DisplayNames | null = null
/** "FJ" -> "Fiji". Empty when unknown. */
export function countryName(cc: string | null | undefined): string {
  try {
    regionNames ??= new Intl.DisplayNames(['en'], { type: 'region' })
    return (cc && regionNames.of(cc.toUpperCase())) || ''
  } catch { return '' }
}
