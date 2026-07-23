import { normalizeIso6346Pill } from './iso6346Normalize'

/** Normalise container size to a short pill label (20G, 40H, 20R, …). Never empty when raw exists. */
export function containerTypeLabel(
  raw: string | null | undefined,
  description?: string | null,
): string | null {
  if (!raw?.trim() && !description?.trim()) return null
  return normalizeIso6346Pill(raw, description) ?? raw?.trim() ?? null
}

export function containerTypePillClass(label: string): string {
  if (label.endsWith('R')) return 'import-sea-type-pill import-sea-type-pill--reefer'
  if (label.endsWith('H')) return 'import-sea-type-pill import-sea-type-pill--general'
  if (label.endsWith('G')) return 'import-sea-type-pill import-sea-type-pill--general'
  return 'import-sea-type-pill'
}
