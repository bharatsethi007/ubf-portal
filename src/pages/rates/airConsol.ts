// UBF own air products (consol / personal effects) — schedule + labels.
// Consol and personal-effects cards hold UBF's SELL tariff; buy is unknown.

export type AirProduct = 'direct' | 'consol' | 'personal_effects'
export type AirCargoClass = 'general' | 'temp' | 'dg'

export type ConsolSlot = { depart_dow: number; cutoff_dow: number; cutoff_time: string }
export type ConsolDeparture = { departDate: string; cutoffDate: string; cutoffTime: string }

export function asAirProduct(v: unknown): AirProduct {
  return v === 'consol' || v === 'personal_effects' ? v : 'direct'
}

export function isSellOnlyProduct(p: AirProduct): boolean {
  return p === 'consol' || p === 'personal_effects'
}

export function productLabel(p: AirProduct): string {
  if (p === 'consol') return 'UBF Consol'
  if (p === 'personal_effects') return 'Personal effects'
  return 'Airline direct'
}

export function cargoClassFor(isHazardous: boolean | null | undefined, reeferTempC: number | null | undefined, needRefrigeration?: boolean | null): AirCargoClass {
  if (isHazardous) return 'dg'
  if (needRefrigeration || reeferTempC != null) return 'temp'
  return 'general'
}

const NZ_TZ = 'Pacific/Auckland'

// Current NZ wall-clock date (YYYY-MM-DD) and time (HH:MM).
function nzNow(now: Date): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: NZ_TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now)
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
  return { date: `${g('year')}-${g('month')}-${g('day')}`, time: `${g('hour')}:${g('minute')}` }
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function dow(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getUTCDay()
}

export function parseSchedule(v: unknown): ConsolSlot[] {
  if (!Array.isArray(v)) return []
  return v
    .map((s: any) => ({ depart_dow: Number(s?.depart_dow), cutoff_dow: Number(s?.cutoff_dow), cutoff_time: String(s?.cutoff_time ?? '00:00') }))
    .filter((s) => s.depart_dow >= 0 && s.depart_dow <= 6 && s.cutoff_dow >= 0 && s.cutoff_dow <= 6)
}

// Next departure whose cut-off has not passed (NZ time), skipping holiday dates.
export function nextConsolDeparture(schedule: ConsolSlot[], skipDates: string[] = [], now: Date = new Date()): ConsolDeparture | null {
  if (schedule.length === 0) return null
  const nz = nzNow(now)
  const skip = new Set(skipDates)
  for (let i = 0; i < 28; i++) {
    const day = addDays(nz.date, i)
    if (skip.has(day)) continue
    const slots = schedule.filter((s) => s.depart_dow === dow(day))
    for (const s of slots) {
      const back = (s.depart_dow - s.cutoff_dow + 7) % 7
      const cutoffDate = addDays(day, -back)
      const passed = cutoffDate < nz.date || (cutoffDate === nz.date && s.cutoff_time <= nz.time)
      if (!passed) return { departDate: day, cutoffDate, cutoffTime: s.cutoff_time }
    }
  }
  return null
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function fmtDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  return `${DOW[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]}`
}

export function fmtDeparture(d: ConsolDeparture): string {
  return `Departs ${fmtDay(d.departDate)} · cut-off ${DOW[dow(d.cutoffDate)]} ${d.cutoffTime}`
}
