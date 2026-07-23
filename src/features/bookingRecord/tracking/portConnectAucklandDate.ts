const AUCKLAND = 'Pacific/Auckland'

const ISO_RE = /^\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:\d{2})$/

export function parsePortConnectDate(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null
  const text = value.trim()
  const d = new Date(text.includes('T') ? text : `${text}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

export function formatPortConnectDateTime(iso: string | null | undefined): string {
  const d = parsePortConnectDate(iso)
  if (!d) return '—'
  return d.toLocaleString('en-NZ', {
    timeZone: AUCKLAND,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export function formatPortConnectDate(iso: string | null | undefined): string {
  const d = parsePortConnectDate(iso)
  if (!d) return '—'
  return d.toLocaleDateString('en-NZ', {
    timeZone: AUCKLAND,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatPortConnectDateTimeShort(iso: string | null | undefined): string {
  const d = parsePortConnectDate(iso)
  if (!d) return '—'
  return d.toLocaleString('en-NZ', {
    timeZone: AUCKLAND,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

/** Format event_value when it carries a datetime (e.g. VBSCHANGED). */
export function formatEventValue(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  const text = value.trim()
  if (ISO_RE.test(text) || text.includes('T')) {
    return formatPortConnectDateTime(text)
  }
  return text
}

export function isPastInstant(iso: string | null | undefined): boolean {
  const d = parsePortConnectDate(iso)
  if (!d) return false
  return d.getTime() <= Date.now()
}
