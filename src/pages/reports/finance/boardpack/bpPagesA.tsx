import { Image, Page, Text, View } from '@react-pdf/renderer'
import { compact, fyLabel, pct, ratio } from '../financeUtil'
import type { BoardPack } from './boardPackData'
import { TrendChart } from './bpCharts'
import { BpPage, Callout, K, Kpi, KpiRow, S, Table, chg, chgTxt, fullMonth, m0, p1, type Row } from './bpKit'

const fyMonthNo = (p: BoardPack) => ((Number(p.month.slice(5, 7)) + 8) % 12) + 1 // April = 1
const delta = (a: number, b: number | null | undefined, higherIsGood = true) => {
  if (b == null || !b) return { delta: undefined, good: null }
  const c = chg(a, b)!
  return { delta: `${c >= 0 ? '+' : ''}${c.toFixed(0)}% vs last year`, good: higherIsGood ? c >= 0 : c <= 0 }
}

export const CONTENTS = ['At a glance', 'Commentary and matters for the board', 'Profit and loss', 'Balance sheet',
  'Cash flow and 13-week forecast', 'Debtors and creditors', 'Margin leaks and customer profitability']

export function Cover({ p }: { p: BoardPack }) {
  const gm = ratio(p.yT.gp, p.yT.revenue)
  return (
    <Page size="A4" style={{ fontFamily: 'General Sans', backgroundColor: K.paper }}>
      <View style={{ backgroundColor: K.navy, paddingHorizontal: 48, paddingTop: 44, paddingBottom: 40 }}>
        <Image src="/ub-freight-logo-white.png" style={{ width: 112, height: 56, objectFit: 'contain', marginBottom: 72 }} />
        <Text style={{ fontSize: 9, color: '#C9D3EC', letterSpacing: 1.2, textTransform: 'uppercase' }}>UB Freight Limited</Text>
        <Text style={{ fontSize: 30, fontWeight: 600, color: K.paper, marginTop: 10 }}>Board pack</Text>
        <View style={{ width: 44, height: 3, backgroundColor: K.orange, marginTop: 12, marginBottom: 12 }} />
        <Text style={{ fontSize: 14, color: K.paper }}>{fullMonth(p.month)}</Text>
        <Text style={{ fontSize: 9.5, color: '#C9D3EC', marginTop: 4 }}>{fyLabel(p.fy)} · month {fyMonthNo(p)} of 12</Text>
      </View>
      <View style={{ paddingHorizontal: 48, paddingTop: 30 }}>
        <View style={{ flexDirection: 'row', gap: 18 }}>
          <Kpi label="Net profit YTD" value={compact(p.yT.net)} {...delta(p.yT.net, p.yLy?.net)} />
          <Kpi label="Gross profit YTD" value={compact(p.yT.gp)} sub={`${pct(gm)} margin`} {...delta(p.yT.gp, p.yLy?.gp)} />
          <Kpi label={`Net profit ${fullMonth(p.month).split(' ')[0]}`} value={compact(p.mT.net)} {...delta(p.mT.net, p.mLy?.net)} />
          <Kpi label="Cash at month end" value={compact(p.cashClose)} />
        </View>
        <Text style={{ ...S.h3, marginTop: 34 }}>Contents</Text>
        {CONTENTS.map((c, i) => (
          <View key={c} style={{ flexDirection: 'row', paddingVertical: 5, borderBottomWidth: 0.3, borderBottomColor: K.hair }}>
            <Text style={{ width: 22, fontSize: 9, color: K.orange }}>{i + 1}</Text>
            <Text style={{ fontSize: 9.5, color: K.ink }}>{c}</Text>
          </View>
        ))}
        <Text style={{ ...S.note, marginTop: 28 }}>
          Prepared {p.generatedAt.toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' })} from the TradeWindow general ledger
          (company 01, NZD). Unaudited management accounts: depreciation and income tax are not posted in the ledger.
          {p.useAdj ? ' Supplier invoices received but not yet costed to jobs are added back as "Job costs not yet posted".' : ''}
        </Text>
      </View>
    </Page>
  )
}

export function Glance({ p }: { p: BoardPack }) {
  const mon = fullMonth(p.month).split(' ')[0]
  const gpC = chg(p.yT.gp, p.yLy?.gp ?? null)
  const title = `Year-to-date net profit ${compact(p.yT.net)}${p.yLy ? `, ${chgTxt(p.yT.net, p.yLy.net)} on last year` : ''}`
  const lead = `Revenue ${compact(p.yT.revenue)} and gross profit ${compact(p.yT.gp)} at ${pct(ratio(p.yT.gp, p.yT.revenue))} margin`
    + (gpC != null ? `; gross profit ${gpC >= 0 ? 'up' : 'down'} ${Math.abs(gpC).toFixed(0)}% on last year.` : '.')
    + (p.openAdj > 50000 ? ` ${mon} is not closed in TradeWindow: ${compact(p.openAdj)} of supplier costs are added back as unposted.` : '')
  const slRows: Row[] = p.sl.map((s) => ({ cells: [s.line, m0(s.revenue), m0(s.gp), p1(s.margin), p1(ratio(s.gp, p.sl.reduce((a, x) => a + x.gp, 0))), s.lyGp == null ? '–' : chgTxt(s.gp, s.lyGp)],
    neg: [false, false, s.gp < 0] }))
  if (p.yT.adj) slRows.push({ kind: 'memo', cells: ['Job costs not yet posted', '', m0(-p.yT.adj), '', '', ''], neg: [false, false, true] })
  slRows.push({ kind: 'total', cells: ['Total', m0(p.yT.revenue), m0(p.yT.gp), p1(ratio(p.yT.gp, p.yT.revenue)), '', p.yLy ? chgTxt(p.yT.gp, p.yLy.gp) : '–'] })
  return (
    <BpPage section="1 · At a glance" month={p.month} title={title} lead={lead}>
      <Text style={S.h3}>{mon}</Text>
      <KpiRow>
        <Kpi label="Revenue" value={compact(p.mT.revenue)} {...delta(p.mT.revenue, p.mLy?.revenue)} />
        <Kpi label="Gross profit" value={compact(p.mT.gp)} sub={`${pct(ratio(p.mT.gp, p.mT.revenue))} margin`} {...delta(p.mT.gp, p.mLy?.gp)} />
        <Kpi label="Overheads" value={compact(p.mT.opex)} {...delta(p.mT.opex, p.mLy?.opex, false)} />
        <Kpi label="Operating profit" value={compact(p.mT.ebit)} {...delta(p.mT.ebit, p.mLy?.ebit)} />
        <Kpi label="Net profit" value={compact(p.mT.net)} {...delta(p.mT.net, p.mLy?.net)} />
      </KpiRow>
      <Text style={S.h3}>Year to date</Text>
      <KpiRow>
        <Kpi label="Revenue" value={compact(p.yT.revenue)} {...delta(p.yT.revenue, p.yLy?.revenue)} />
        <Kpi label="Gross profit" value={compact(p.yT.gp)} sub={`${pct(ratio(p.yT.gp, p.yT.revenue))} margin`} {...delta(p.yT.gp, p.yLy?.gp)} />
        <Kpi label="Overheads" value={compact(p.yT.opex)} sub={`${pct(ratio(p.yT.opex, p.yT.gp), 0)} of GP`} {...delta(p.yT.opex, p.yLy?.opex, false)} />
        <Kpi label="Operating profit" value={compact(p.yT.ebit)} sub={`${pct(ratio(p.yT.ebit, p.yT.gp), 0)} of GP`} {...delta(p.yT.ebit, p.yLy?.ebit)} />
        <Kpi label="Net profit" value={compact(p.yT.net)} {...delta(p.yT.net, p.yLy?.net)} />
      </KpiRow>
      <Text style={S.h3}>Last 12 months</Text>
      <TrendChart data={p.trend} />
      <View style={{ marginTop: 16 }}>
        <Text style={S.h3}>Gross profit by service line, year to date</Text>
        <Table dense cols={[{ label: 'Service line', w: 2.6 }, { label: 'Revenue' }, { label: 'Gross profit' }, { label: 'Margin' }, { label: 'Share of GP' }, { label: 'GP vs LY' }]} rows={slRows} />
        <Text style={S.note}>Service lines follow the GL revenue and cost accounts. Unposted job costs are not split by line, so line margins read high for an open month.</Text>
      </View>
    </BpPage>
  )
}

export function Commentary({ p }: { p: BoardPack }) {
  const matters = p.flags.filter((f) => f.severity !== 'low')
  return (
    <BpPage section="2 · Commentary" month={p.month} title="What the numbers say"
      lead="Every point below is calculated from the ledger. Matters for the board are the exceptions the finance checks raised this month.">
      {p.insights.map((i, k) => <Callout key={k} tone={i.tone} title={i.title} body={i.body} />)}
      <View style={{ marginTop: 10 }} wrap={false}>
        <Text style={S.h3}>Matters for the board</Text>
        <Table dense cols={[{ label: 'Priority', w: 0.8, align: 'left' }, { label: 'Matter', w: 2.4, align: 'left' }, { label: 'Detail', w: 4.6, align: 'left' }, { label: 'Amount', w: 1 }]}
          rows={matters.length ? matters.map((f) => ({ cells: [f.severity === 'high' ? 'High' : 'Medium', f.title, f.detail, f.amount == null ? '' : m0(f.amount)] }))
            : [{ cells: ['', 'No exceptions raised', '', ''] }]} />
      </View>
    </BpPage>
  )
}
