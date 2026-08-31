import { format } from 'date-fns'

export function conferenceDays(startDate: string, endDate: string): string[] {
  const out: string[] = []
  const cur = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  while (cur <= end) {
    out.push(format(cur, 'yyyy-MM-dd'))
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

export function dayTabLabel(iso: string, index: number): string {
  const short = format(new Date(`${iso}T00:00:00`), 'EEE d')
  return `Day ${index + 1} · ${short}`
}

export function defaultActiveDay(startDate: string, endDate: string): string {
  const days = conferenceDays(startDate, endDate)
  const today = format(new Date(), 'yyyy-MM-dd')
  return days.includes(today) ? today : days[0]
}
