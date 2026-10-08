import { G, Line, Polyline, Rect, Svg, Text as SText, View, Text } from '@react-pdf/renderer'
import { compact } from '../financeUtil'
import { K, shortM } from './bpKit'
import type { Buckets, Trend } from './boardPackData'
import type { ForecastRow } from '../financeApi'

const nice = (v: number) => {
  if (v <= 0) return 1
  const p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p
}
const LEFT = 40, BOTTOM = 16, TOP = 6

function Axis({ w, h, lo, hi, ticks }: { w: number; h: number; lo: number; hi: number; ticks: number[] }) {
  const y = (v: number) => TOP + (h - TOP - BOTTOM) * (1 - (v - lo) / (hi - lo || 1))
  return (
    <G>
      {ticks.map((t) => (
        <G key={t}>
          <Line x1={LEFT} x2={w} y1={y(t)} y2={y(t)} strokeWidth={t === 0 ? 0.7 : 0.4} stroke={t === 0 ? K.faint : K.hair} />
          <SText x={LEFT - 4} y={y(t) + 2.2} style={{ fontSize: 6, fill: K.mut }} textAnchor="end">{compact(t)}</SText>
        </G>
      ))}
    </G>
  )
}
const scale = (vals: number[]) => {
  const max = Math.max(0, ...vals), min = Math.min(0, ...vals)
  const step = nice((max - min) / 4 || 1)
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let t = lo; t <= hi + step / 2; t += step) ticks.push(Math.round(t))
  return { lo, hi, ticks }
}
const Legend = ({ items }: { items: { c: string; t: string; bar?: boolean }[] }) => (
  <View style={{ flexDirection: 'row', gap: 12, marginTop: 4, marginLeft: LEFT }}>
    {items.map((i) => (
      <View key={i.t} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <View style={{ width: i.bar ? 7 : 10, height: i.bar ? 7 : 1.6, backgroundColor: i.c }} />
        <Text style={{ fontSize: 6.8, color: K.mut }}>{i.t}</Text>
      </View>
    ))}
  </View>
)

export function TrendChart({ data, w = 523, h = 150 }: { data: Trend[]; w?: number; h?: number }) {
  const { lo, hi, ticks } = scale(data.flatMap((d) => [d.revenue, d.gp, d.ebit]))
  const y = (v: number) => TOP + (h - TOP - BOTTOM) * (1 - (v - lo) / (hi - lo || 1))
  const slot = (w - LEFT) / Math.max(1, data.length), bw = slot * 0.56
  const cx = (i: number) => LEFT + slot * i + slot / 2
  const line = (f: (d: Trend) => number) => data.map((d, i) => `${cx(i)},${y(f(d))}`).join(' ')
  return (
    <View>
      <Svg width={w} height={h}>
        <Axis w={w} h={h} lo={lo} hi={hi} ticks={ticks} />
        {data.map((d, i) => (
          <G key={d.month}>
            <Rect x={cx(i) - bw / 2} y={Math.min(y(d.revenue), y(0))} width={bw} height={Math.abs(y(d.revenue) - y(0))} fill={i === data.length - 1 ? '#8FA0CF' : K.light} />
            <SText x={cx(i)} y={h - 4} style={{ fontSize: 6, fill: K.mut }} textAnchor="middle">{shortM(d.month)}</SText>
          </G>
        ))}
        <Polyline points={line((d) => d.gp)} stroke={K.orange} strokeWidth={1.6} fill="none" />
        <Polyline points={line((d) => d.ebit)} stroke={K.navy} strokeWidth={1.6} fill="none" />
      </Svg>
      <Legend items={[{ c: K.light, t: 'Revenue', bar: true }, { c: K.orange, t: 'Gross profit' }, { c: K.navy, t: 'Operating profit' }]} />
    </View>
  )
}

export function ForecastChart({ rows, w = 523, h = 130 }: { rows: ForecastRow[]; w?: number; h?: number }) {
  const { lo, hi, ticks } = scale(rows.flatMap((r) => [r.closing, r.net]))
  const y = (v: number) => TOP + (h - TOP - BOTTOM) * (1 - (v - lo) / (hi - lo || 1))
  const slot = (w - LEFT) / Math.max(1, rows.length), bw = slot * 0.5
  const cx = (i: number) => LEFT + slot * i + slot / 2
  const low = rows.reduce((m, r, i) => (r.closing < rows[m].closing ? i : m), 0)
  return (
    <View>
      <Svg width={w} height={h}>
        <Axis w={w} h={h} lo={lo} hi={hi} ticks={ticks} />
        {rows.map((r, i) => (
          <G key={r.week_start}>
            <Rect x={cx(i) - bw / 2} y={Math.min(y(r.net), y(0))} width={bw} height={Math.max(0.5, Math.abs(y(r.net) - y(0)))} fill={r.net < 0 ? '#E8B4AE' : '#B7DCC6'} />
            <SText x={cx(i)} y={h - 4} style={{ fontSize: 5.6, fill: K.mut }} textAnchor="middle">
              {new Date(r.week_start).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })}
            </SText>
          </G>
        ))}
        <Polyline points={rows.map((r, i) => `${cx(i)},${y(r.closing)}`).join(' ')} stroke={K.navy} strokeWidth={1.6} fill="none" />
        {rows.length ? <Rect x={cx(low) - 2.5} y={y(rows[low].closing) - 2.5} width={5} height={5} fill={K.neg} /> : null}
      </Svg>
      <Legend items={[{ c: K.navy, t: 'Closing cash' }, { c: '#B7DCC6', t: 'Net inflow week', bar: true }, { c: '#E8B4AE', t: 'Net outflow week', bar: true }, { c: K.neg, t: 'Low point', bar: true }]} />
    </View>
  )
}

const AGE_COLS = ['#C9D3EC', '#8FA0CF', K.orange, '#D9622B', K.neg]
export function AgingBar({ b, w = 250 }: { b: Buckets; w?: number }) {
  const parts = [['Current', b.current], ['1-30', b.d1_30], ['31-60', b.d31_60], ['61-90', b.d61_90], ['90+', b.d90_plus]] as const
  const tot = parts.reduce((a, [, v]) => a + Math.max(0, v), 0) || 1
  let x = 0
  return (
    <View>
      <Svg width={w} height={12}>
        {parts.map(([l, v], i) => {
          const pw = (Math.max(0, v) / tot) * w
          const r = <Rect key={l} x={x} y={0} width={pw} height={12} fill={AGE_COLS[i]} />
          x += pw
          return r
        })}
      </Svg>
      <View style={{ flexDirection: 'row', marginTop: 5 }}>
        {parts.map(([l, v], i) => (
          <View key={l} style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <View style={{ width: 6, height: 6, backgroundColor: AGE_COLS[i] }} />
              <Text style={{ fontSize: 6.5, color: K.mut }}>{l}</Text>
            </View>
            <Text style={{ fontSize: 8, color: K.ink, marginTop: 2 }}>{compact(v)}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}
