export type DatePreset = 'this-month' | 'last-month' | 'last-90' | 'this-year' | 'custom'

export type DateRange = {
  from: string
  to: string
  preset: DatePreset
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function currentMonthDefault(): DateRange {
  const now = new Date()
  const from = iso(new Date(now.getFullYear(), now.getMonth(), 1))
  return { from, to: iso(now), preset: 'this-month' }
}

export function computePresetRange(preset: DatePreset): DateRange {
  const now = new Date()
  const today = iso(now)

  switch (preset) {
    case 'this-month':
      return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: today, preset }
    case 'last-month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const end = new Date(now.getFullYear(), now.getMonth(), 0)
      return { from: iso(start), to: iso(end), preset }
    }
    case 'last-90': {
      const start = new Date(now)
      start.setDate(start.getDate() - 90)
      return { from: iso(start), to: today, preset }
    }
    case 'this-year':
      return { from: iso(new Date(now.getFullYear(), 0, 1)), to: today, preset }
    default:
      return currentMonthDefault()
  }
}

export const PRESET_LABELS: Record<DatePreset, string> = {
  'this-month': 'This Month',
  'last-month': 'Last Month',
  'last-90': 'Last 90 Days',
  'this-year': 'This Year',
  custom: 'Custom',
}
