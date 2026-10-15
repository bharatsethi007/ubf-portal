import { conversion, pricingSplit, type Leaderboard } from './leaderboardApi'
import { settledRate } from './LeaderboardExtras'
import { fmtDay } from './leaderboardFormat'
import { countryName } from './insightsData'

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
  out.push(row(['Rank', 'Staff', 'Quotes', 'Per day', 'Per week', 'Per month', 'Open', 'Held', 'Won', 'Lost', 'Conversion %', 'Win rate % (won+lost)', 'Settled 8wk conversion %', 'Card lines %', 'Other lines %', 'Typed lines %', 'Card prices changed', 'Median hrs to quote', 'Median hrs email to quote', 'Email-matched quotes', 'Median hrs to win']))
  lb.staff.forEach((s, i) => {
    const x = lb.extra?.staff[s.user_id ?? 'none']
    const p = pricingSplit(x?.pricing)
    out.push(row([
      i + 1, s.name, s.quotes, s.per_day, s.per_week, s.per_month, s.open, s.held ?? 0, s.won, s.lost,
      conversion(s.won, s.quotes) ?? '', s.win_rate ?? '', settledRate(x?.trend).rate ?? '',
      p?.card ?? '', p?.other ?? '', p?.manual ?? '', p ? `${p.cardEdited}/${p.cardLines}` : '',
      s.avg_hrs_to_quote ?? '', s.avg_hrs_email_to_quote ?? '', s.email_matched, s.hrs_to_win ?? '',
    ]))
  })
  if (lb.sales) {
    out.push('', row(['SALES (WON QUOTES)']))
    out.push(row(['Rank', 'Sales', 'Won', 'Median hrs to win', 'Last win']))
    lb.sales.forEach((x, i) => out.push(row([i + 1, x.name, x.won, x.hrs_to_win ?? '', x.last_won ? fmtDay(x.last_won) : ''])))
  }
  out.push('')
  out.push(row(['CUSTOMERS']))
  out.push(row(['Rank', 'Customer', 'Account', 'Quotes', 'Open', 'Held', 'Won', 'Lost', 'Win rate %', 'Median hrs to quote', 'Median hrs to win', 'Last quote']))
  lb.customers.forEach((c, i) => out.push(row([
    i + 1, c.name, c.account_id ?? '', c.quotes, c.open, c.held ?? 0, c.won, c.lost,
    c.win_rate ?? '', c.avg_hrs_to_quote ?? '', c.hrs_to_win ?? '', fmtDay(c.last_quote),
  ])))

  if (lb.agents) {
    out.push('', row(['AGENTS']))
    out.push(row(['Rank', 'Agent', 'Country', 'Quotes', 'Open', 'Held', 'Won', 'Lost', 'Win rate %', 'Top lane', 'Median hrs to quote', 'Median hrs to win', 'Last quote']))
    lb.agents.forEach((a, i) => out.push(row([
      i + 1, a.name, a.country ?? '', a.quotes, a.open, a.held ?? 0, a.won, a.lost,
      a.win_rate ?? '', a.top_lane ?? '', a.avg_hrs_to_quote ?? '', a.hrs_to_win ?? '', fmtDay(a.last_quote),
    ])))
  }

  if (lb.mix) {
    const sections: [string, { label: string; n: number; won?: number; lost?: number }[]][] = [
      ['STATUS', lb.mix.status], ['MODE', lb.mix.mode], ['DIRECTION', lb.mix.direction],
      ['DESTINATION COUNTRY', lb.mix.destination.map((r) => ({ ...r, label: countryName(r.label) }))],
      ['CUSTOMER VS AGENT', lb.mix.party ?? []], ['HELD BY AGE', lb.mix.held_age ?? []],
      ['LOST REASONS', lb.mix.lost_reason], ['SOURCE', lb.mix.source],
    ];
    for (const [title, rows] of sections) {
      const total = rows.reduce((t, r) => t + r.n, 0);
      out.push('', row([title]), row(['Label', 'Quotes', 'Share %', 'Won', 'Lost']));
      rows.forEach((r) => out.push(row([r.label, r.n, total ? Math.round((r.n / total) * 100) : 0, r.won ?? '', r.lost ?? ''])));
    }
  }

  const blob = new Blob(['﻿' + out.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ubf-quotes-leaderboard-${periodLabel.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
