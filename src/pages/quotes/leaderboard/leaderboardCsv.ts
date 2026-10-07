import type { Leaderboard } from './leaderboardApi'
import { fmtDay } from './leaderboardFormat'

function cell(v: unknown): string {
  const s = v == null ? '' : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function row(vals: unknown[]): string {
  return vals.map(cell).join(',')
}

// One CSV, two sections: team then customers. Hours stay numeric for Excel.
export function downloadLeaderboardCsv(lb: Leaderboard, periodLabel: string, modeText: string) {
  const out: string[] = []
  out.push(row(['UBF Quotes Leaderboard', periodLabel, modeText, `Since ${fmtDay(lb.since)}`]))
  out.push('')
  out.push(row(['TEAM']))
  out.push(row(['Rank', 'Staff', 'Quotes', 'Per day', 'Per week', 'Per month', 'Open', 'Won', 'Lost', 'Win rate %', 'Avg hrs to quote', 'Avg hrs email to quote', 'Email-matched quotes']))
  lb.staff.forEach((s, i) => out.push(row([
    i + 1, s.name, s.quotes, s.per_day, s.per_week, s.per_month, s.open, s.won, s.lost,
    s.win_rate ?? '', s.avg_hrs_to_quote ?? '', s.avg_hrs_email_to_quote ?? '', s.email_matched,
  ])))
  out.push('')
  out.push(row(['CUSTOMERS']))
  out.push(row(['Rank', 'Customer', 'Account', 'Quotes', 'Open', 'Won', 'Lost', 'Win rate %', 'Avg hrs to quote', 'Last quote']))
  lb.customers.forEach((c, i) => out.push(row([
    i + 1, c.name, c.account_id ?? '', c.quotes, c.open, c.won, c.lost,
    c.win_rate ?? '', c.avg_hrs_to_quote ?? '', fmtDay(c.last_quote),
  ])))

  const blob = new Blob(['﻿' + out.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ubf-quotes-leaderboard-${periodLabel.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
