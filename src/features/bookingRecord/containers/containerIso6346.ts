/** ISO 6346 letter values (multiples of 11 omitted). */
const LETTER_VALUES: Record<string, number> = {
  A: 10, B: 12, C: 13, D: 14, E: 15, F: 16, G: 17, H: 18, I: 19,
  J: 20, K: 21, L: 23, M: 24, N: 25, O: 26, P: 27, Q: 28, R: 29,
  S: 30, T: 31, U: 32, V: 34, W: 35, X: 36, Y: 37, Z: 38,
}

export function normalizeContainerNo(raw: string): string {
  return raw.replace(/\s/g, '').toUpperCase()
}

export function isIso6346Format(normalized: string): boolean {
  return /^[A-Z]{4}\d{7}$/.test(normalized)
}

export function iso6346CheckDigit(normalized: string): number | null {
  if (!isIso6346Format(normalized)) return null
  let sum = 0
  for (let i = 0; i < 10; i += 1) {
    const ch = normalized[i]
    const value = /\d/.test(ch) ? Number(ch) : LETTER_VALUES[ch] ?? 0
    sum += value * 2 ** i
  }
  const mod = sum % 11
  return mod === 10 ? 0 : mod
}

export function iso6346CheckValid(normalized: string): boolean {
  if (!isIso6346Format(normalized)) return false
  const expected = iso6346CheckDigit(normalized)
  const actual = Number(normalized[10])
  return expected === actual
}

export function containerNoValidationMessage(normalized: string): string | null {
  if (!normalized) return null
  if (!isIso6346Format(normalized)) {
    return 'Expected 4 letters followed by 7 digits (ISO 6346).'
  }
  if (!iso6346CheckValid(normalized)) {
    return 'Check digit does not match — verify the number is correct.'
  }
  return null
}
