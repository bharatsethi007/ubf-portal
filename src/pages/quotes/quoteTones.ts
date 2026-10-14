// One palette for quote status, mode and direction. Pastel background, deep ink of
// the same hue, plus a solid chart colour. Used by the record, the list, the board
// and the leaderboard so a colour always means the same thing.

export type Tone = { label: string; fg: string; bg: string; chart: string }

export const STATUS_TONE: Record<string, Tone> = {
  open: { label: 'Open', fg: '#475467', bg: '#F2F4F7', chart: '#2a78d6' },
  published: { label: 'Published', fg: '#1D4ED8', bg: '#EFF6FF', chart: '#2a78d6' },
  sent: { label: 'Sent', fg: '#4338CA', bg: '#EEF2FF', chart: '#2a78d6' },
  held: { label: 'Held', fg: '#B54708', bg: '#FFF6E0', chart: '#eda100' },
  won: { label: 'Won', fg: '#067647', bg: '#E8F8EF', chart: '#047857' },
  lost: { label: 'Lost', fg: '#B42318', bg: '#FDECEA', chart: '#b91c1c' },
  crosswin: { label: 'Cross win', fg: '#5925DC', bg: '#F1EEFE', chart: '#4a3aa7' },
}

export const MODE_TONE: Record<string, Tone> = {
  FCL: { label: 'FCL', fg: '#1D4ED8', bg: '#EAF1FF', chart: '#2a78d6' },
  LCL: { label: 'LCL', fg: '#0F766E', bg: '#E6F7F4', chart: '#1baf7a' },
  Air: { label: 'Air', fg: '#026AA2', bg: '#E8F5FC', chart: '#0ba5ec' },
  Courier: { label: 'Courier', fg: '#C4320A', bg: '#FFF1EA', chart: '#eb6834' },
}

export const DIR_TONE: Record<string, Tone> = {
  import: { label: 'Import', fg: '#0E7090', bg: '#E6F8FB', chart: '#0e9384' },
  export: { label: 'Export', fg: '#C4620E', bg: '#FFF1E5', chart: '#eb6834' },
  crosstrade: { label: 'Cross trade', fg: '#9F1AB1', bg: '#FBEEFD', chart: '#a21caf' },
}

const GREY: Tone = { label: '', fg: '#475467', bg: '#F2F4F7', chart: '#a3a39e' }

export const statusTone = (s: string | null | undefined): Tone =>
  STATUS_TONE[(s ?? '').toLowerCase()] ?? { ...GREY, label: s ?? '—' }
export const dirTone = (d: string | null | undefined): Tone | null => DIR_TONE[(d ?? '').toLowerCase()] ?? null

/** Pill style for inline spans: pastel fill, same-hue ink. */
export const pillStyle = (t: Tone) => ({
  display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 999, padding: '2px 9px',
  fontSize: 11, fontWeight: 500, lineHeight: 1.4, whiteSpace: 'nowrap' as const, background: t.bg, color: t.fg,
})

/** Chart colour by the label the leaderboard RPC returns ("Held", "Cross trade", "LCL"). */
export function chartColorFor(label: string): string | undefined {
  const all = [...Object.values(STATUS_TONE), ...Object.values(MODE_TONE), ...Object.values(DIR_TONE)]
  return all.find((t) => t.label === label)?.chart
}
