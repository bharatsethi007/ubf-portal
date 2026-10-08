import { Page, View, Text, Svg, Path, StyleSheet } from '@react-pdf/renderer'
import type { Leaderboard } from './leaderboardApi'
import { arcPath, buildInsights, sliceAngles, winRate, type InsightChart } from './insightsData'

const NAVY = '#002753', INK = '#111111', MUTE = '#6b7280', LINE = '#e2e6ea', SOFT = '#f4f6f8', BLUE = '#2a78d6'
const D = 74, R = 35, RI = 23

const s = StyleSheet.create({
  page: { padding: 28, fontFamily: 'General Sans', fontSize: 8, color: INK },
  sec: { marginBottom: 6, color: NAVY, fontSize: 9, fontWeight: 700, letterSpacing: 0.5 },
  take: { backgroundColor: SOFT, borderRadius: 3, paddingVertical: 7, paddingHorizontal: 10, marginBottom: 10 },
  takeT: { fontSize: 7.6, lineHeight: 1.45, color: INK },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: { width: '32.4%', border: '0.75 solid ' + LINE, borderRadius: 3, padding: 8, flexDirection: 'row', gap: 8 },
  title: { fontSize: 8.2, fontWeight: 600, color: NAVY },
  head: { fontSize: 6.6, color: MUTE, marginTop: 1, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 2.2 },
  dot: { width: 6, height: 6, borderRadius: 1, marginRight: 4 },
  lbl: { flex: 1, fontSize: 6.8, color: INK },
  num: { fontSize: 6.8, width: 18, textAlign: 'right' },
  pct: { fontSize: 6.8, width: 22, textAlign: 'right', color: MUTE },
  win: { fontSize: 6.4, width: 30, textAlign: 'right', color: MUTE },
  laneRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  foot: { position: 'absolute', bottom: 14, left: 28, right: 28, flexDirection: 'row', justifyContent: 'space-between', fontSize: 6.6, color: MUTE },
})

function Donut({ c }: { c: InsightChart }) {
  if (!c.total) return <View style={{ width: D, height: D, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 6.6, color: MUTE }}>{c.empty}</Text></View>
  if (c.slices.length < 3) {
    return (
      <View style={{ width: D, justifyContent: 'center' }}>
        <View style={{ flexDirection: 'row', height: 8, borderRadius: 2, overflow: 'hidden', gap: 1 }}>
          {c.slices.map((x) => <View key={x.label} style={{ width: `${x.pct}%`, backgroundColor: x.color }} />)}
        </View>
      </View>
    )
  }
  const ang = sliceAngles(c.slices)
  return (
    <View style={{ width: D, height: D }}>
      <Svg width={D} height={D} viewBox={`0 0 ${D} ${D}`}>
        {c.slices.map((x, i) => <Path key={x.label} d={arcPath(D / 2, D / 2, R, RI, ang[i].a0, ang[i].a1)} fill={x.color} />)}
      </Svg>
      <View style={{ position: 'absolute', top: D / 2 - 9, left: 0, right: 0, alignItems: 'center' }}>
        <Text style={{ fontSize: 11, fontWeight: 600, color: NAVY }}>{c.total}</Text>
        <Text style={{ fontSize: 5.6, color: MUTE }}>quotes</Text>
      </View>
    </View>
  )
}

function Card({ c }: { c: InsightChart }) {
  const showWin = c.slices.some((x) => (x.won ?? 0) > 0 || (x.lost ?? 0) > 0)
  return (
    <View style={s.card} wrap={false}>
      <Donut c={c} />
      <View style={{ flex: 1 }}>
        <Text style={s.title}>{c.title}</Text>
        <Text style={s.head}>{c.headline}</Text>
        {c.slices.map((x) => {
          const wr = winRate(x)
          return (
            <View key={x.label} style={s.row}>
              <View style={[s.dot, { backgroundColor: x.color }]} />
              <Text style={s.lbl}>{x.label.length > 24 ? `${x.label.slice(0, 23)}…` : x.label}</Text>
              <Text style={s.num}>{x.n}</Text>
              <Text style={s.pct}>{x.pct}%</Text>
              {showWin && <Text style={s.win}>{wr == null ? '–' : `${wr}% win`}</Text>}
            </View>
          )
        })}
      </View>
    </View>
  )
}

export default function LeaderboardPdfInsights({ lb, periodLabel }: { lb: Leaderboard; periodLabel: string }) {
  const { charts, lanes, takeaways } = buildInsights(lb)
  if (!charts.length) return null
  const max = Math.max(1, ...lanes.map((l) => l.n))
  return (
    <Page size="A4" orientation="landscape" style={s.page}>
      <Text style={s.sec}>INSIGHTS · {periodLabel.toUpperCase()}</Text>
      {takeaways.length > 0 && (
        <View style={s.take}>
          {takeaways.map((t) => <Text key={t} style={s.takeT}>•  {t}</Text>)}
        </View>
      )}
      <View style={s.grid}>{charts.map((c) => <Card key={c.key} c={c} />)}</View>
      {lanes.length > 0 && (
        <View style={{ marginTop: 10 }} wrap={false}>
          <Text style={s.sec}>TOP TRADE LANES</Text>
          {lanes.map((l) => (
            <View key={l.label} style={s.laneRow}>
              <Text style={{ width: 210, fontSize: 7.2 }}>{l.label.replace('→', 'to')}</Text>
              <View style={{ flex: 1, height: 5, backgroundColor: SOFT, borderRadius: 2 }}>
                <View style={{ width: `${(l.n / max) * 100}%`, height: 5, backgroundColor: BLUE, borderRadius: 2 }} />
              </View>
              <Text style={{ width: 26, textAlign: 'right', fontSize: 7.2 }}>{l.n}</Text>
              <Text style={{ width: 44, textAlign: 'right', fontSize: 6.8, color: MUTE }}>{l.won} won</Text>
            </View>
          ))}
        </View>
      )}
      <View style={s.foot} fixed>
        <Text>UB Freight Ltd · Internal</Text>
        <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </View>
    </Page>
  )
}
