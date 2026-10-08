import {
  fetchAging, fetchBalanceSheet, fetchCashflow, fetchClose, fetchCustomerProfit, fetchFlags, fetchForecast, fetchKpis, fetchLeaks, fetchPl,
  type AgingRow, type CloseList, type CustProfitRow, type FlagRow, type ForecastRow, type PlRow,
} from '../financeApi'
import { buildInsights, type Insight } from '../financeInsights'
import {
  DATA_START, addMonths, fyOf, fyStart, monthEnd, monthsBetween, serviceLines, totals, unpostedCosts, type Totals,
} from '../financeUtil'

// Four comparison periods used through the pack: month, same month last year, YTD, last year YTD.
export type Quad = { m: number; mLy: number | null; y: number; yLy: number | null }
export type PackRow = { label: string; kind: 'section' | 'line' | 'sub' | 'total' | 'pct' | 'memo'; v: Quad }
export type BsLine = { label: string; kind: 'section' | 'line' | 'total'; now: number; open: number }
export type CfLine = { label: string; kind: 'section' | 'line' | 'sub' | 'total'; m: number; y: number }
export type Trend = { month: string; revenue: number; gp: number; ebit: number; cash: number }
export type Buckets = { current: number; d1_30: number; d31_60: number; d61_90: number; d90_plus: number; total: number }
export type SlRow = { line: string; revenue: number; gp: number; margin: number | null; lyGp: number | null }

export type BoardPack = {
  month: string; fy: number; hasLy: boolean; useAdj: boolean; generatedAt: Date
  mT: Totals; mLy: Totals | null; yT: Totals; yLy: Totals | null; openAdj: number
  pl: PackRow[]; sl: SlRow[]; trend: Trend[]; insights: Insight[]
  bs: BsLine[]; bsOpenLabel: string; ca: number; cl: number; cash: number; equity: number
  cf: CfLine[]; cashOpenM: number; cashOpenY: number; cashClose: number
  forecast: ForecastRow[]
  ar: Buckets; ap: Buckets; arTop: AgingRow[]; dso: number | null; dpo: number | null; unapplied: number; relatedAr: number
  flags: FlagRow[]
  leaks: { label: string; n: number; amount: number }[]
  cust: { rows: CustProfitRow[]; from: string; to: string }
  close: CloseList | null
}

const PL_GROUPS = ['Revenue', 'Cost of sales', 'Other operating income', 'Operating expenses', 'Other income', 'Finance costs', 'Income tax']
const BS_ORDER: Record<string, string[]> = {
  Assets: ['Cash & bank', 'Trade receivables', 'Prepayments', 'Tax assets', 'Other current assets', 'Related party advances', 'Bonds & deposits', 'Fixed assets'],
  Liabilities: ['Trade payables', 'Accruals', 'GST', 'Customs duty payable', 'Payroll liabilities', 'Related party & dividends', 'Other liabilities', 'Borrowings'],
  Equity: ['Share capital', 'Retained earnings', 'Drawings & dividends', 'Current year earnings'],
}
const NON_CURRENT = ['Fixed assets', 'Bonds & deposits', 'Related party advances', 'Borrowings']
const CF_SECTIONS = [['operating', 'Operating activities'], ['investing', 'Investing activities'], ['financing', 'Financing activities'], ['fx', 'Exchange rate effect']]
const LEAK_LABEL: Record<string, string> = { not_invoiced: 'Supplier billed, customer not invoiced', overrun: 'Supplier cost above cost booked',
  loss: 'Loss-making jobs', never_costed: 'Invoiced but never costed', cost_not_billed: 'Cost booked, supplier bill missing' }

function buckets(rows: AgingRow[]): Buckets {
  const b: Buckets = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0, total: 0 }
  for (const r of rows) {
    b.current += r.current_amt; b.d1_30 += r.d1_30; b.d31_60 += r.d31_60; b.d61_90 += r.d61_90; b.d90_plus += r.d90_plus; b.total += r.total
  }
  return b
}
const days = (rows: AgingRow[]) => {
  const bal = rows.reduce((a, r) => a + Math.max(0, r.total), 0), billed = rows.reduce((a, r) => a + r.billed_12m, 0)
  return billed ? (bal / billed) * 365 : null
}

export async function buildBoardPack(month: string, useAdj: boolean): Promise<BoardPack> {
  const fy = fyOf(month)
  const months = monthsBetween(fyStart(fy), month)
  const lyMonths = months.map((m) => addMonths(m, -12))
  const hasLy = lyMonths[0] >= DATA_START
  const lyMonth = addMonths(month, -12)
  const plFrom = hasLy ? lyMonths[0] : months[0]
  const bsOpen = fy > fyOf(DATA_START) ? `${fy}-03-31` : fyStart(fy)
  const custFrom = addMonths(month, -11), custTo = monthEnd(month)

  const [kpis, plAll, bsNow, bsOpenRows, cfRows, arRows, apRows, forecast, flags, leakRows, custRows, close] = await Promise.all([
    fetchKpis(DATA_START, month), fetchPl(plFrom, month), fetchBalanceSheet(monthEnd(month)), fetchBalanceSheet(bsOpen),
    fetchCashflow(months[0], month), fetchAging('D'), fetchAging('C'), fetchForecast(13), fetchFlags(), fetchLeaks(),
    fetchCustomerProfit(custFrom, custTo), fetchClose(month).catch(() => null),
  ])

  const adj = useAdj ? unpostedCosts(kpis) : {}
  const t = (ms: string[]) => totals(kpis, ms, adj, useAdj)
  const mT = t([month]), yT = t(months)
  const mLy = hasLy ? t([lyMonth]) : null, yLy = hasLy ? t(lyMonths) : null

  // P&L rows across the four periods
  const quad = (rows: PlRow[], extra: (m: string) => number = () => 0): Quad => {
    const s = (ms: string[]) => rows.filter((r) => ms.includes(r.month)).reduce((a, r) => a + r.amount, 0) + ms.reduce((a, m) => a + extra(m), 0)
    return { m: s([month]), mLy: hasLy ? s([lyMonth]) : null, y: s(months), yLy: hasLy ? s(lyMonths) : null }
  }
  const ratioQ = (a: Quad, b: Quad): Quad => {
    const r = (x: number | null, y: number | null) => (x != null && y ? (x / y) * 100 : null)
    return { m: r(a.m, b.m) ?? 0, mLy: r(a.mLy, b.mLy), y: r(a.y, b.y) ?? 0, yLy: r(a.yLy, b.yLy) }
  }
  const adjFn = (m: string) => -(adj[m] ?? 0)
  const pl: PackRow[] = []
  const g = (name: string) => plAll.filter((r) => r.pl_group === name)
  const revenue = quad(g('Revenue'))
  for (const name of PL_GROUPS) {
    const gr = g(name)
    const hasAdj = name === 'Cost of sales' && [month, ...months].some((m) => adj[m])
    if (!gr.length && !hasAdj) continue
    pl.push({ label: name, kind: 'section', v: { m: 0, mLy: null, y: 0, yLy: null } })
    const lines = [...new Set(gr.map((r) => r.pl_line))]
      .map((l) => ({ l, t: gr.filter((r) => r.pl_line === l).reduce((a, r) => a + Math.abs(r.amount), 0) }))
      .sort((a, b) => b.t - a.t)
    for (const { l } of lines) pl.push({ label: l, kind: 'line', v: quad(gr.filter((r) => r.pl_line === l)) })
    if (hasAdj) pl.push({ label: 'Job costs not yet posted', kind: 'memo', v: quad([], adjFn) })
    pl.push({ label: `Total ${name.toLowerCase()}`, kind: 'sub', v: quad(gr, name === 'Cost of sales' ? adjFn : undefined) })
    if (name === 'Cost of sales') {
      const gp = quad(plAll.filter((r) => ['Revenue', 'Cost of sales'].includes(r.pl_group)), adjFn)
      pl.push({ label: 'Gross profit', kind: 'total', v: gp }, { label: 'Gross margin', kind: 'pct', v: ratioQ(gp, revenue) })
    }
    if (name === 'Operating expenses') {
      const ebit = quad(plAll.filter((r) => ['Revenue', 'Cost of sales', 'Other operating income', 'Operating expenses'].includes(r.pl_group)), adjFn)
      pl.push({ label: 'Operating profit (EBIT)', kind: 'total', v: ebit }, { label: 'Operating margin', kind: 'pct', v: ratioQ(ebit, revenue) })
    }
  }
  const net = quad(plAll, adjFn)
  pl.push({ label: 'Net profit before tax', kind: 'total', v: net }, { label: 'Net margin', kind: 'pct', v: ratioQ(net, revenue) })

  const slCur = serviceLines(plAll, months), slPrev = hasLy ? serviceLines(plAll, lyMonths) : []
  const sl = slCur.filter((s) => s.revenue || s.cost)
    .map((s) => ({ line: s.line, revenue: s.revenue, gp: s.gp, margin: s.margin, lyGp: slPrev.find((x) => x.line === s.line)?.gp ?? null }))

  const trend = kpis.filter((k) => k.month <= month && k.month > addMonths(month, -12))
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((k) => ({ month: k.month, revenue: k.revenue, gp: k.gross_profit - (adj[k.month] ?? 0), ebit: k.ebit - (adj[k.month] ?? 0), cash: k.cash }))

  // Balance sheet
  const sumBs = (rows: typeof bsNow, f: (r: (typeof bsNow)[number]) => boolean) => rows.filter(f).reduce((a, r) => a + r.amount, 0)
  const bs: BsLine[] = []
  for (const side of Object.keys(BS_ORDER)) {
    bs.push({ label: side, kind: 'section', now: 0, open: 0 })
    for (const grp of BS_ORDER[side]) {
      const now = sumBs(bsNow, (r) => r.side === side && r.bs_group === grp), open = sumBs(bsOpenRows, (r) => r.side === side && r.bs_group === grp)
      if (now || open) bs.push({ label: grp, kind: 'line', now, open })
    }
    bs.push({ label: `Total ${side.toLowerCase()}`, kind: 'total', now: sumBs(bsNow, (r) => r.side === side), open: sumBs(bsOpenRows, (r) => r.side === side) })
  }
  const ca = sumBs(bsNow, (r) => r.side === 'Assets' && !NON_CURRENT.includes(r.bs_group))
  const cl = sumBs(bsNow, (r) => r.side === 'Liabilities' && !NON_CURRENT.includes(r.bs_group))

  // Cash flow: month and YTD
  const flows = cfRows.filter((r) => r.cf_section !== 'balance')
  const closing = new Map(cfRows.filter((r) => r.cf_section === 'balance').map((r) => [r.month, r.amount]))
  const netM = (m: string) => flows.filter((r) => r.month === m).reduce((a, r) => a + r.amount, 0)
  const cf: CfLine[] = []
  const mv = (rs: typeof flows) => ({ m: rs.filter((r) => r.month === month).reduce((a, r) => a + r.amount, 0), y: rs.reduce((a, r) => a + r.amount, 0) })
  for (const [k, label] of CF_SECTIONS) {
    const sr = flows.filter((r) => r.cf_section === k)
    if (!sr.length) continue
    cf.push({ label, kind: 'section', m: 0, y: 0 })
    const lines = [...new Set(sr.map((r) => r.cf_line))]
      .sort((a, b) => Math.abs(mv(sr.filter((r) => r.cf_line === b)).y) - Math.abs(mv(sr.filter((r) => r.cf_line === a)).y))
    for (const l of lines) cf.push({ label: l, kind: 'line', ...mv(sr.filter((r) => r.cf_line === l)) })
    cf.push({ label: `Net cash from ${label.toLowerCase()}`, kind: 'sub', ...mv(sr) })
  }
  cf.push({ label: 'Net change in cash', kind: 'total', ...mv(flows) })
  const cashClose = closing.get(month) ?? 0
  const cashOpenM = cashClose - netM(month)
  const cashOpenY = (closing.get(months[0]) ?? 0) - netM(months[0])

  const leaks = Object.keys(LEAK_LABEL).map((k) => {
    const rs = leakRows.filter((r) => r.category === k && !r.review_status)
    const amt = (r: (typeof rs)[number]) => (k === 'loss' ? -r.gp : k === 'cost_not_billed' ? -r.gap : k === 'overrun' ? r.gap : r.cost_billed)
    return { label: LEAK_LABEL[k], n: rs.length, amount: rs.reduce((a, r) => a + amt(r), 0) }
  })

  const RELATED = ['3RN', 'NRR', 'UBNAN', 'UBFSYD']
  const isRel = (r: AgingRow) => r.is_related || RELATED.includes(r.accountid)
  const nonRel = arRows.filter((r) => !isRel(r))
  const insights = buildInsights({ cur: yT, prev: yLy, periodLabel: 'Year to date', slCur, slPrev,
    kpis: kpis.filter((k) => k.month <= month), aging: arRows, forecast, flags })

  return {
    month, fy, hasLy, useAdj, generatedAt: new Date(), mT, mLy, yT, yLy, openAdj: adj[month] ?? 0,
    pl, sl, trend, insights,
    bs, bsOpenLabel: bsOpen, ca, cl, cash: sumBs(bsNow, (r) => r.bs_group === 'Cash & bank'), equity: sumBs(bsNow, (r) => r.side === 'Equity'),
    cf, cashOpenM, cashOpenY, cashClose, forecast,
    ar: buckets(arRows), ap: buckets(apRows), arTop: [...nonRel].sort((a, b) => (b.d31_60 + b.d61_90 + b.d90_plus) - (a.d31_60 + a.d61_90 + a.d90_plus)).slice(0, 10),
    dso: days(arRows), dpo: days(apRows), unapplied: arRows.reduce((a, r) => a + r.unapplied, 0),
    relatedAr: arRows.filter(isRel).reduce((a, r) => a + r.total, 0),
    flags, leaks, cust: { rows: custRows, from: custFrom, to: custTo }, close,
  }
}
