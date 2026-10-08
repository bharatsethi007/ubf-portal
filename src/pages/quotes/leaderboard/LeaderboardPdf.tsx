import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import type { Leaderboard } from './leaderboardApi'
import { fmtDay, fmtHrs, fmtPct } from './leaderboardFormat'
import LeaderboardPdfInsights from './LeaderboardPdfInsights'

const NAVY = '#002753', ORANGE = '#F99D29', INK = '#111111', MUTE = '#6b7280', LINE = '#e2e6ea', SOFT = '#f4f6f8'
const GREEN = '#047857', RED = '#B91C1C', MEDAL = ['#C9A227', '#9AA4B2', '#B87333']
const CUST_MAX = 25

const s = StyleSheet.create({
  page: { padding: 28, fontFamily: 'General Sans', fontSize: 8, color: INK },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logo: { width: 80, height: 40, objectFit: 'contain' },
  meta: { textAlign: 'right', color: MUTE, fontSize: 7.5 },
  bar: { marginTop: 10, backgroundColor: NAVY, height: 26, borderRadius: 2, paddingHorizontal: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  barT: { color: '#fff', fontSize: 11.5, fontWeight: 700, letterSpacing: 2 },
  barS: { color: ORANGE, fontSize: 9, fontWeight: 600, letterSpacing: 1 },
  kpis: { flexDirection: 'row', gap: 8, marginTop: 12 },
  kpi: { flex: 1, border: '0.75 solid ' + LINE, borderRadius: 3, paddingVertical: 7, paddingHorizontal: 9 },
  kpiV: { fontSize: 15, fontWeight: 600, color: NAVY },
  kpiL: { fontSize: 6.8, color: MUTE, marginTop: 2 },
  sec: { marginTop: 14, marginBottom: 5, color: NAVY, fontSize: 9, fontWeight: 700, letterSpacing: 0.5 },
  tr: { flexDirection: 'row', alignItems: 'center', borderBottom: '0.5 solid ' + LINE, minHeight: 18 },
  th: { backgroundColor: NAVY, borderBottom: 'none' },
  thC: { color: '#fff', fontSize: 6.8, fontWeight: 600, paddingVertical: 4.5, paddingHorizontal: 4 },
  td: { fontSize: 7.6, paddingVertical: 3, paddingHorizontal: 4 },
  rank: { width: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  rankT: { fontSize: 6.8, fontWeight: 600 },
  track: { height: 4, backgroundColor: SOFT, borderRadius: 2, flex: 1, marginLeft: 5 },
  fill: { height: 4, borderRadius: 2 },
  note: { marginTop: 10, fontSize: 6.6, color: MUTE },
  foot: { position: 'absolute', bottom: 14, left: 28, right: 28, flexDirection: 'row', justifyContent: 'space-between', fontSize: 6.6, color: MUTE },
})

type Col = { label: string; w: number; right?: boolean }

function Head({ cols, fixed }: { cols: Col[]; fixed?: boolean }) {
  return (
    <View style={[s.tr, s.th]} fixed={fixed}>
      {cols.map((c) => (
        <Text key={c.label} style={[s.thC, { width: c.w, textAlign: c.right ? 'right' : 'left' }]}>{c.label}</Text>
      ))}
    </View>
  )
}

function Rank({ i }: { i: number }) {
  const c = MEDAL[i]
  return (
    <View style={[s.rank, { backgroundColor: c ?? SOFT }]}>
      <Text style={[s.rankT, { color: c ? '#fff' : MUTE }]}>{i + 1}</Text>
    </View>
  )
}

function Bar({ v, max, color, label, w }: { v: number; max: number; color: string; label: string; w: number }) {
  return (
    <View style={{ width: w, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 }}>
      <Text style={{ fontSize: 7.6, width: 22, textAlign: 'right' }}>{label}</Text>
      <View style={s.track}><View style={[s.fill, { width: `${max ? Math.min(100, (v / max) * 100) : 0}%`, backgroundColor: color }]} /></View>
    </View>
  )
}

function winColor(v: number | null) {
  const n = Number(v ?? 0)
  return n >= 50 ? GREEN : n >= 25 ? '#B45309' : RED
}

const STAFF_COLS: Col[] = [
  { label: '#', w: 26 }, { label: 'SALES SUPPORT', w: 140 }, { label: 'QUOTES', w: 110 },
  { label: '/ DAY', w: 42, right: true }, { label: '/ WEEK', w: 46, right: true }, { label: '/ MONTH', w: 50, right: true },
  { label: 'WON', w: 38, right: true }, { label: 'LOST', w: 38, right: true }, { label: 'WIN RATE', w: 100 },
  { label: 'TIME TO QUOTE', w: 70, right: true }, { label: 'EMAIL TO QUOTE', w: 70, right: true },
]
const CUST_COLS: Col[] = [
  { label: '#', w: 26 }, { label: 'CUSTOMER', w: 230 }, { label: 'QUOTES', w: 110 },
  { label: 'OPEN', w: 40, right: true }, { label: 'WON', w: 40, right: true }, { label: 'LOST', w: 40, right: true },
  { label: 'WIN RATE', w: 100 }, { label: 'TIME TO QUOTE', w: 70, right: true }, { label: 'LAST QUOTE', w: 74, right: true },
]

type Props = { lb: Leaderboard; periodLabel: string; modeText: string; logoUrl: string; generatedBy?: string }

export default function LeaderboardPdf({ lb, periodLabel, modeText, logoUrl, generatedBy }: Props) {
  const t = lb.totals
  const sMax = Math.max(1, ...lb.staff.map((r) => r.quotes))
  const cust = lb.customers.slice(0, CUST_MAX)
  const cMax = Math.max(1, ...cust.map((r) => r.quotes))
  const kpis = [
    { v: String(t.quotes), l: 'Quotes' },
    { v: String(t.won), l: 'Won' },
    { v: String(t.lost), l: 'Lost' },
    { v: fmtPct(t.win_rate), l: 'Win rate' },
    { v: fmtHrs(t.avg_hrs_to_quote), l: 'Avg time to quote' },
    { v: fmtHrs(t.avg_hrs_email_to_quote), l: 'Avg email to quote' },
    { v: String(t.customers), l: 'Customers quoted' },
  ]
  const r = (w: number, right?: boolean) => [s.td, { width: w, textAlign: right ? 'right' as const : 'left' as const }]

  return (
    <Document title={`UBF Quotes Leaderboard ${periodLabel}`}>
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.head}>
          <Image src={logoUrl} style={s.logo} />
          <View>
            <Text style={s.meta}>{modeText} · Since {fmtDay(lb.since)}</Text>
            <Text style={s.meta}>Generated {new Date().toLocaleString('en-NZ')}{generatedBy ? ` by ${generatedBy}` : ''}</Text>
          </View>
        </View>
        <View style={s.bar}>
          <Text style={s.barT}>QUOTES LEADERBOARD</Text>
          <Text style={s.barS}>{periodLabel.toUpperCase()}</Text>
        </View>

        <View style={s.kpis}>
          {kpis.map((k) => (
            <View key={k.l} style={s.kpi}><Text style={s.kpiV}>{k.v}</Text><Text style={s.kpiL}>{k.l}</Text></View>
          ))}
        </View>

        <Text style={s.sec}>TEAM</Text>
        <Head cols={STAFF_COLS} />
        {lb.staff.map((x, i) => (
          <View key={x.user_id ?? x.name} style={s.tr} wrap={false}>
            <View style={{ width: 26, paddingHorizontal: 4 }}><Rank i={i} /></View>
            <Text style={r(140)}>{x.name}</Text>
            <Bar v={x.quotes} max={sMax} color={NAVY} label={String(x.quotes)} w={110} />
            <Text style={r(42, true)}>{x.per_day}</Text>
            <Text style={r(46, true)}>{x.per_week}</Text>
            <Text style={r(50, true)}>{x.per_month}</Text>
            <Text style={[...r(38, true), { color: GREEN }]}>{x.won}</Text>
            <Text style={[...r(38, true), { color: RED }]}>{x.lost}</Text>
            <Bar v={Number(x.win_rate ?? 0)} max={100} color={winColor(x.win_rate)} label={fmtPct(x.win_rate)} w={100} />
            <Text style={r(70, true)}>{fmtHrs(x.avg_hrs_to_quote)}</Text>
            <Text style={r(70, true)}>{fmtHrs(x.avg_hrs_email_to_quote)}</Text>
          </View>
        ))}

        <Text style={s.note}>
          Time to quote: quote created to first rate response. Email to quote: customer email received to first rate response
          (matched by account or contact email, within 3 days). Per day uses working days. Win rate = won / (won + lost).
        </Text>
        <View style={s.foot} fixed>
          <Text>UB Freight Ltd · Internal</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
      <LeaderboardPdfInsights lb={lb} periodLabel={periodLabel} />
      {cust.length > 0 && (
        <Page size="A4" orientation="landscape" style={s.page}>
        <Text style={[s.sec, { marginTop: 0 }]}>CUSTOMERS{lb.customers.length > CUST_MAX ? ` (TOP ${CUST_MAX})` : ''}</Text>
        <Head cols={CUST_COLS} fixed />
        {cust.map((x, i) => (
          <View key={`${x.account_id ?? ''}-${x.name}`} style={s.tr} wrap={false}>
            <View style={{ width: 26, paddingHorizontal: 4 }}><Rank i={i} /></View>
            <Text style={r(230)}>{x.name}</Text>
            <Bar v={x.quotes} max={cMax} color={NAVY} label={String(x.quotes)} w={110} />
            <Text style={r(40, true)}>{x.open}</Text>
            <Text style={[...r(40, true), { color: GREEN }]}>{x.won}</Text>
            <Text style={[...r(40, true), { color: RED }]}>{x.lost}</Text>
            <Bar v={Number(x.win_rate ?? 0)} max={100} color={winColor(x.win_rate)} label={fmtPct(x.win_rate)} w={100} />
            <Text style={r(70, true)}>{fmtHrs(x.avg_hrs_to_quote)}</Text>
            <Text style={r(74, true)}>{fmtDay(x.last_quote)}</Text>
          </View>
        ))}

        <View style={s.foot} fixed>
          <Text>UB Freight Ltd · Internal</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
      )}
    </Document>
  )
}
