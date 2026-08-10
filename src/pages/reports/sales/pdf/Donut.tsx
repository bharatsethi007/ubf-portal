import { View, Text, Svg, Circle, G } from '@react-pdf/renderer'
import { C } from './pdfTheme'

type Slice = { label: string; value: number; color: string }

type Props = {
  slices: Slice[]
  size?: number
}

export default function Donut({ slices, size = 120 }: Props) {
  const strokeWidth = 14
  const cx = size / 2
  const cy = size / 2
  const r = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * r
  const total = slices.reduce((s, sl) => s + sl.value, 0)

  let angle = 0
  const arcs = slices.map((sl) => {
    const frac = total > 0 ? sl.value / total : 0
    const dash = frac * circ
    const rotation = angle
    angle += frac * 360
    return (
      <G key={sl.label} transform={`rotate(${rotation - 90} ${cx} ${cy})`}>
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={sl.color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${dash} ${circ}`}
        />
      </G>
    )
  })

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ width: size, height: size, position: 'relative' }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Circle cx={cx} cy={cy} r={r} stroke={C.hair} strokeWidth={strokeWidth} fill="none" />
          {arcs}
        </Svg>
        <View style={{
          position: 'absolute', top: 0, left: 0, width: size, height: size,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>{total}</Text>
        </View>
      </View>
      <View style={{ flex: 1, marginLeft: 16 }}>
        {slices.map((sl) => {
          const pct = total > 0 ? ((sl.value / total) * 100).toFixed(1) : '0.0'
          return (
            <View key={sl.label} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <View style={{ width: 8, height: 8, backgroundColor: sl.color, marginRight: 8 }} />
              <Text style={{ flex: 1, fontSize: 8.5, color: C.body }}>{sl.label}</Text>
              <Text style={{ fontSize: 8.5, color: C.ink, width: 36, textAlign: 'right' }}>{sl.value}</Text>
              <Text style={{ fontSize: 8, color: C.muted, width: 40, textAlign: 'right' }}>{pct}%</Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}
